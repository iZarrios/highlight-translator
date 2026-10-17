import { describe, expect, it } from 'vitest';
import { TranslationCoordinator } from '@/translation/translation-coordinator';
import type { SelectionTranslator } from '@/translation/translator';

const fails = (message: string): SelectionTranslator => ({
  translateToEnglish: async () => {
    throw new Error(message);
  },
});

const succeeds = (
  engine: 'offline-wasm' | 'provider',
): SelectionTranslator => ({
  translateToEnglish: async (text) => ({
    sourceLanguage: 'fr',
    translatedText: `translated: ${text}`,
    engine,
  }),
});

describe('TranslationCoordinator', () => {
  it('falls back from browser translation to offline WASM', async () => {
    const coordinator = new TranslationCoordinator('automatic', {
      browser: fails('unavailable'),
      offline: succeeds('offline-wasm'),
      provider: fails('should not run'),
    });

    await expect(
      coordinator.translateToEnglish('bonjour'),
    ).resolves.toMatchObject({
      engine: 'offline-wasm',
    });
  });

  it('falls back to the provider when local engines are unavailable', async () => {
    const coordinator = new TranslationCoordinator('automatic', {
      browser: fails('unavailable'),
      offline: fails('assets missing'),
      provider: succeeds('provider'),
    });

    await expect(
      coordinator.translateToEnglish('bonjour'),
    ).resolves.toMatchObject({
      engine: 'provider',
    });
  });

  it('does not silently fall back in an explicit mode', async () => {
    const coordinator = new TranslationCoordinator('offline-wasm', {
      browser: succeeds('provider'),
      offline: fails('assets missing'),
      provider: succeeds('provider'),
    });

    await expect(coordinator.translateToEnglish('bonjour')).rejects.toThrow(
      'assets missing',
    );
  });
});
