import type {
  ExplanationChunk,
  ExplanationClient,
  ExplanationField,
  ExplanationRequest,
  ExplanationResult,
} from '@/analysis/explanation-client';
import { explanationResultSchema } from '@/analysis/explanation-client';
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

const explanationResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'translated_explanation',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        translation: { type: 'string', minLength: 1 },
        explanation: { type: 'string', minLength: 1 },
      },
      required: ['translation', 'explanation'],
      additionalProperties: false,
    },
  },
} as const;

function getCompletionRequestBody(
  provider: ProviderProfile,
  request: ExplanationRequest,
  isStreaming: boolean,
) {
  const maxTokens = Math.min(
    1_600,
    Math.max(220, Math.ceil(request.text.length / 2) + 160),
  );
  return JSON.stringify({
    model: provider.model,
    messages: buildExplanationMessages(request),
    response_format: explanationResponseFormat,
    // we disable thinking as most of the time the use case is too simple to need any reasoning
    reasoning_effort: 'none',
    thinking_budget_tokens: 0,
    temperature: 0,
    max_tokens: maxTokens,
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

function parseResult(content: string): ExplanationResult {
  try {
    return explanationResultSchema.parse(JSON.parse(content));
  } catch {
    throw new Error(
      'The provider returned invalid structured translation and explanation JSON.',
    );
  }
}

const escapeValues: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

/** Decodes the valid prefix of one JSON string while its response is streaming. */
function readStringPrefix(
  json: string,
  field: ExplanationField,
): string | undefined {
  const match = new RegExp(`"${field}"\\s*:\\s*"`).exec(json);
  if (!match) return undefined;

  let value = '';
  let index = match.index + match[0].length;
  while (index < json.length) {
    const character = json[index];
    if (character === '"') return value;
    if (character !== '\\') {
      value += character;
      index += 1;
      continue;
    }

    const escapeCode = json[index + 1];
    if (!escapeCode) return value;
    if (escapeCode === 'u') {
      const hex = json.slice(index + 2, index + 6);
      if (hex.length < 4) return value;
      if (!/^[\da-f]{4}$/i.test(hex)) return value;
      value += String.fromCharCode(Number.parseInt(hex, 16));
      index += 6;
      continue;
    }

    const decoded = escapeValues[escapeCode];
    if (decoded === undefined) return value;
    value += decoded;
    index += 2;
  }
  return value;
}

async function* structuredChunks(
  rawChunks: AsyncIterable<string>,
): AsyncIterable<ExplanationChunk> {
  let json = '';
  const emitted: Record<ExplanationField, string> = {
    translation: '',
    explanation: '',
  };
  const fields: ExplanationField[] = ['translation', 'explanation'];

  for await (const rawChunk of rawChunks) {
    json += rawChunk;
    for (const field of fields) {
      const value = readStringPrefix(json, field);
      if (value === undefined || !value.startsWith(emitted[field])) continue;
      const text = value.slice(emitted[field].length);
      if (!text) continue;
      emitted[field] = value;
      yield { field, text };
    }
  }

  const result = parseResult(json);
  for (const field of fields) {
    if (!result[field].startsWith(emitted[field])) {
      throw new Error('The streamed structured response changed unexpectedly.');
    }
    const text = result[field].slice(emitted[field].length);
    if (text) yield { field, text };
  }
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
  ): Promise<ExplanationResult> {
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
    return parseResult(getContentFromCompletion(await response.json()));
  }

  async *streamExplanation(
    request: ExplanationRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ExplanationChunk> {
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
      const result = parseResult(
        getContentFromCompletion(await response.json()),
      );
      yield { field: 'translation', text: result.translation };
      yield { field: 'explanation', text: result.explanation };
      return;
    }
    yield* structuredChunks(readServerSentEvents(response));
  }
}
