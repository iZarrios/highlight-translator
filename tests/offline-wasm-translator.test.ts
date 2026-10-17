import { describe, expect, it } from 'vitest';
import { OfflineWasmTranslator } from '@/translation/offline-wasm-translator';

describe('OfflineWasmTranslator', () => {
  it('translates non-English text with the local runner', async () => {
    const translator = new OfflineWasmTranslator(
      {
        translate: async () => ({
          translatedText: 'Good morning',
          executionBackend: 'webgpu',
        }),
      },
      async () => 'fr',
    );

    await expect(translator.translateToEnglish('Bonjour')).resolves.toEqual({
      sourceLanguage: 'fr',
      translatedText: 'Good morning',
      engine: 'offline-wasm',
      executionBackend: 'webgpu',
    });
  });

  it('does not load the model for English text', async () => {
    const translator = new OfflineWasmTranslator(
      {
        translate: async () => {
          throw new Error('runner should not be used');
        },
      },
      async () => 'en',
    );

    await expect(translator.translateToEnglish('Hello')).resolves.toEqual({
      sourceLanguage: 'en',
      translatedText: 'Hello',
      engine: 'identity',
    });
  });
});
