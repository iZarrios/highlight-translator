import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverModels } from '@/model-discovery';
import { createProviderProfile } from '@/provider-profile';

const provider = createProviderProfile({
  name: 'Fixture',
  baseUrl: 'https://models.example.test/v1',
  model: 'model-b',
});

describe('model discovery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the default fetch implementation with the worker global receiver', async () => {
    vi.stubGlobal('fetch', function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(
        new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), {
          status: 200,
        }),
      );
    });

    await expect(discoverModels(provider)).resolves.toEqual(['local-model']);
  });

  it('returns sorted model identifiers from an OpenAI-compatible endpoint', async () => {
    const models = await discoverModels(
      provider,
      async () =>
        new Response(
          JSON.stringify({ data: [{ id: 'model-b' }, { id: 'model-a' }] }),
          {
            status: 200,
          },
        ),
    );

    expect(models).toEqual(['model-a', 'model-b']);
  });
});
