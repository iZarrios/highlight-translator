import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIExplanationClient } from '@/analysis/openai-explanation-client';
import { createProviderProfile } from '@/providers/provider-profile';

const provider = createProviderProfile({
  id: 'local',
  name: 'Local',
  baseUrl: 'http://127.0.0.1:11434/v1',
  model: 'qwen3:8b',
  apiKey: 'secret',
});

describe('OpenAIExplanationClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the default fetch implementation with the worker global receiver', async () => {
    vi.stubGlobal('fetch', function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Bound correctly.' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const client = new OpenAIExplanationClient(provider);
    await expect(client.explain({ text: 'hello' })).resolves.toBe(
      'Bound correctly.',
    );
  });

  it('returns the explanation from a non-streaming completion', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const client = new OpenAIExplanationClient(
      provider,
      async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            choices: [
              { message: { content: 'It is an idiom about rare events.' } },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    );

    await expect(client.explain({ text: 'once in a blue moon' })).resolves.toBe(
      'It is an idiom about rare events.',
    );
    expect(requestBody?.max_tokens).toBeLessThanOrEqual(180);
  });

  it('yields text from fragmented SSE events', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"A rare"}}]}\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            '\ndata: {"choices":[{"delta":{"content":" event."}}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const client = new OpenAIExplanationClient(
      provider,
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
    );

    const chunks: string[] = [];
    for await (const chunk of client.streamExplanation({
      text: 'once in a blue moon',
    })) {
      chunks.push(chunk);
    }

    expect(chunks.join('')).toBe('A rare event.');
  });

  it('turns an OpenAI error response into a useful error', async () => {
    const client = new OpenAIExplanationClient(
      provider,
      async () =>
        new Response(
          JSON.stringify({ error: { message: 'model not found' } }),
          { status: 404 },
        ),
    );

    await expect(client.explain({ text: 'hello' })).rejects.toThrow(
      'model not found',
    );
  });

  it('accepts providers that ignore streaming and return a normal completion', async () => {
    const client = new OpenAIExplanationClient(
      provider,
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Normal response.' } }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );

    const chunks: string[] = [];
    for await (const chunk of client.streamExplanation({ text: 'hello' }))
      chunks.push(chunk);
    expect(chunks).toEqual(['Normal response.']);
  });
});
