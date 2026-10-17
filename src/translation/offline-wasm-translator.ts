import { browser } from 'wxt/browser';
import { sendRuntimeRequest } from '@/messaging/protocol';
import type {
  OfflineTranslation,
  SelectionTranslator,
  TranslationProgress,
  TranslationResult,
} from '@/translation/translator';

export type OfflineTranslationRunner = {
  translate(
    text: string,
    onProgress?: (progress: TranslationProgress) => void,
  ): Promise<OfflineTranslation>;
};

const extensionRunner: OfflineTranslationRunner = {
  translate: (text) =>
    sendRuntimeRequest({ type: 'translation:offline', text }),
};

async function detectLanguage(text: string): Promise<string> {
  const result = await browser.i18n.detectLanguage(text);
  return result.languages[0]?.language ?? 'unknown';
}

export class OfflineWasmTranslator implements SelectionTranslator {
  constructor(
    private readonly runner: OfflineTranslationRunner = extensionRunner,
    private readonly detector: (
      text: string,
    ) => Promise<string> = detectLanguage,
  ) {}

  async translateToEnglish(
    text: string,
    onDownloadProgress?: (progress: TranslationProgress) => void,
  ): Promise<TranslationResult> {
    const sourceLanguage = await this.detector(text);
    if (sourceLanguage.toLowerCase().startsWith('en')) {
      return { sourceLanguage, translatedText: text, engine: 'identity' };
    }
    const translation = await this.runner.translate(text, onDownloadProgress);
    return {
      sourceLanguage,
      ...translation,
      engine: 'offline-wasm',
    };
  }
}
