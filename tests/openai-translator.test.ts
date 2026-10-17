import { describe, expect, it } from 'vitest';
import { createProviderProfile } from '@/providers/provider-profile';
import { OpenAITranslator } from '@/translation/openai-translator';

const provider = createProviderProfile({
  name: 'Local LFM',
  baseUrl: 'http://127.0.0.1:10000/v1',
  model: 'lfm-local',
});

describe('OpenAITranslator', () => {
  it('returns only the provider translation', async () => {
    const translator = new OpenAITranslator(
      provider,
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hello world.' } }],
          }),
          { status: 200 },
        ),
    );

    await expect(
      translator.translateToEnglish('Bonjour le monde.', 'fr'),
    ).resolves.toEqual({
      sourceLanguage: 'fr',
      translatedText: 'Hello world.',
      engine: 'provider',
    });
  });

  it('does not send already-English text to the provider', async () => {
    const translator = new OpenAITranslator(provider, async () => {
      throw new Error('fetch should not run');
    });

    await expect(
      translator.translateToEnglish('Already English.', 'en'),
    ).resolves.toEqual({
      sourceLanguage: 'en',
      translatedText: 'Already English.',
      engine: 'identity',
    });
  });
});
