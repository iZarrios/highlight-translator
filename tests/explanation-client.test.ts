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

const result = {
  translation: 'Once in a blue moon',
  explanation: 'It is an idiom about rare events.',
};

function completion(content = JSON.stringify(result)) {
  return JSON.stringify({ choices: [{ message: { content } }] });
}

function event(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

describe('OpenAIExplanationClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the default fetch implementation with the worker global receiver', async () => {
    vi.stubGlobal('fetch', function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(
        new Response(completion(), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    const client = new OpenAIExplanationClient(provider);
    await expect(client.explain({ text: 'hello' })).resolves.toEqual(result);
  });

  it('returns the explanation from a non-streaming completion', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const client = new OpenAIExplanationClient(
      provider,
      async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(completion(), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    );

    await expect(
      client.explain({ text: 'once in a blue moon' }),
    ).resolves.toEqual(result);
    expect(requestBody?.max_tokens).toBeLessThanOrEqual(220);
    expect(requestBody?.response_format).toEqual({
      type: 'json_schema',
      json_schema: expect.objectContaining({
        name: 'translated_explanation',
        strict: true,
        schema: expect.objectContaining({
          required: ['translation', 'explanation'],
          additionalProperties: false,
        }),
      }),
    });
  });

  it('yields separate fields from fragmented structured SSE events', async () => {
    const encoder = new TextEncoder();
    const first = event('{"translation":"Once in a blue');
    const second = event(
      ' moon","explanation":"A rare event with a \\"quoted\\" phrase."}',
    );
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(first.slice(0, 24)));
        controller.enqueue(encoder.encode(first.slice(24) + second));
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

    const chunks: Array<{ field: string; text: string }> = [];
    for await (const chunk of client.streamExplanation({
      text: 'once in a blue moon',
    })) {
      chunks.push(chunk);
    }

    expect(
      chunks
        .filter((chunk) => chunk.field === 'translation')
        .map((chunk) => chunk.text)
        .join(''),
    ).toBe('Once in a blue moon');
    expect(
      chunks
        .filter((chunk) => chunk.field === 'explanation')
        .map((chunk) => chunk.text)
        .join(''),
    ).toBe('A rare event with a "quoted" phrase.');
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
        new Response(completion(), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const chunks: Array<{ field: string; text: string }> = [];
    for await (const chunk of client.streamExplanation({ text: 'hello' }))
      chunks.push(chunk);
    expect(chunks).toEqual([
      { field: 'translation', text: result.translation },
      { field: 'explanation', text: result.explanation },
    ]);
  });

  it('rejects a completion that does not match the schema', async () => {
    const client = new OpenAIExplanationClient(
      provider,
      async () =>
        new Response(completion('{"explanation":"Missing translation"}'), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    await expect(client.explain({ text: 'hello' })).rejects.toThrow(
      'invalid structured',
    );
  });
});
