import type {
  ExplanationClient,
  ExplanationRequest,
} from '@/analysis/explanation-client';
import { buildExplanationMessages } from '@/analysis/prompt';
import { extensionFetch, type Fetcher } from '@/lib/extension-fetch';
import type { ProviderProfile } from '@/providers/provider-profile';
import { resolveOpenAIUrl } from '@/providers/provider-profile';

function requestHeaders(provider: ProviderProfile): HeadersInit {
  return {
    'content-type': 'application/json',
    ...(provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {}),
  };
}

const responseError = async (response: Response): Promise<Error> => {
  let detail = `${response.status} ${response.statusText}`.trim();

  try {
    const { error } = (await response.json()) as {
      error?: string | { message?: string };
    };

    switch (typeof error) {
      case 'string':
        detail = error;
        break;
      case 'object':
        detail = error?.message ?? detail;
        break;
    }
  } catch {
    // Keep the HTTP status for non-JSON errors.
  }

  return new Error(`Explanation request failed: ${detail}`);
};

function getCompletionRequestBody(
  provider: ProviderProfile,
  request: ExplanationRequest,
  isStreaming: boolean,
) {
  return JSON.stringify({
    model: provider.model,
    messages: buildExplanationMessages(request),
    temperature: 0.2,
    max_tokens: 180,
    stream: isStreaming,
  });
}

function getContentFromCompletion(value: unknown): string {
  const body = value as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('The provider returned an empty or invalid explanation.');
  }
  return content.trim();
}

function contentFromEvent(value: unknown): string {
  const body = value as { choices?: Array<{ delta?: { content?: unknown } }> };
  const content = body.choices?.[0]?.delta?.content;
  return typeof content === 'string' ? content : '';
}

async function* readServerSentEvents(
  response: Response,
): AsyncIterable<string> {
  if (!response.body) throw new Error('The provider returned an empty stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';

    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');

      if (!data) continue;
      if (data.trim() === '[DONE]') return;
      const content = contentFromEvent(JSON.parse(data));
      if (content) yield content;
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const data = buffer.replace(/^data:\s?/, '').trim();
    if (data && data !== '[DONE]') {
      const content = contentFromEvent(JSON.parse(data));
      if (content) yield content;
    }
  }
}

export class OpenAIExplanationClient implements ExplanationClient {
  constructor(
    private readonly provider: ProviderProfile,
    private readonly fetcher: Fetcher = extensionFetch,
  ) {}

  async explain(
    request: ExplanationRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await this.fetcher(
      resolveOpenAIUrl(this.provider.baseUrl, 'chat/completions'),
      {
        method: 'POST',
        headers: requestHeaders(this.provider),
        body: getCompletionRequestBody(this.provider, request, false),
        ...(signal ? { signal } : {}),
      },
    );
    if (!response.ok) throw await responseError(response);
    return getContentFromCompletion(await response.json());
  }

  async *streamExplanation(
    request: ExplanationRequest,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const response = await this.fetcher(
      resolveOpenAIUrl(this.provider.baseUrl, 'chat/completions'),
      {
        method: 'POST',
        headers: requestHeaders(this.provider),
        body: getCompletionRequestBody(this.provider, request, true),
        ...(signal ? { signal } : {}),
      },
    );
    if (!response.ok) throw await responseError(response);
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      yield getContentFromCompletion(await response.json());
      return;
    }
    yield* readServerSentEvents(response);
  }
}
