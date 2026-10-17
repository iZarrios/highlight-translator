import { describe, expect, it, vi } from 'vitest';
import { ChromiumTranslator } from '@/translation/chromium-translator';

describe('ChromiumTranslator', () => {
  it('detects the source language and translates to English on-device', async () => {
    const translate = vi.fn().mockResolvedValue('Good morning');
    const translator = new ChromiumTranslator({
      languageDetector: {
        availability: async () => 'available',
        create: async () => ({
          detect: async () => [{ detectedLanguage: 'fr', confidence: 0.99 }],
        }),
      },
      translator: {
        availability: async () => 'available',
        create: async () => ({ translate }),
      },
    });

    await expect(translator.translateToEnglish('Bonjour')).resolves.toEqual({
      sourceLanguage: 'fr',
      translatedText: 'Good morning',
      engine: 'chromium',
    });
  });

  it('does not translate text already detected as English', async () => {
    const translator = new ChromiumTranslator({
      languageDetector: {
        availability: async () => 'available',
        create: async () => ({
          detect: async () => [{ detectedLanguage: 'en', confidence: 0.97 }],
        }),
      },
      translator: {
        availability: async () => 'available',
        create: async () => ({ translate: async () => 'unused' }),
      },
    });

    await expect(translator.translateToEnglish('Hello')).resolves.toEqual({
      sourceLanguage: 'en',
      translatedText: 'Hello',
      engine: 'identity',
    });
  });
});
