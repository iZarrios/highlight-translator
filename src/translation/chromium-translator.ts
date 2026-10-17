import type {
  SelectionTranslator,
  TranslationProgress,
  TranslationResult,
} from '@/translation/translator';

type Availability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable';

type DownloadProgressEvent = Event & { loaded: number; total: number };
type Monitor = EventTarget;

type LanguageDetectorApi = {
  availability(): Promise<Availability>;
  create(options?: { monitor?: (monitor: Monitor) => void }): Promise<{
    detect(
      text: string,
    ): Promise<Array<{ detectedLanguage: string; confidence: number }>>;
  }>;
};

type TranslatorApi = {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<Availability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: Monitor) => void;
  }): Promise<{ translate(text: string): Promise<string> }>;
};

export type ChromiumLanguageApis = {
  languageDetector: LanguageDetectorApi;
  translator: TranslatorApi;
};

function browserApis(): ChromiumLanguageApis | undefined {
  const scope = globalThis as typeof globalThis & {
    LanguageDetector?: LanguageDetectorApi;
    Translator?: TranslatorApi;
  };
  if (!scope.LanguageDetector || !scope.Translator) return undefined;
  return {
    languageDetector: scope.LanguageDetector,
    translator: scope.Translator,
  };
}

function monitorDownloads(callback?: (progress: TranslationProgress) => void) {
  if (!callback) return undefined;
  return (monitor: Monitor) => {
    monitor.addEventListener('downloadprogress', (event) => {
      const progress = event as DownloadProgressEvent;
      callback({ loaded: progress.loaded, total: progress.total });
    });
  };
}

export class ChromiumTranslator implements SelectionTranslator {
  constructor(
    private readonly apis: ChromiumLanguageApis | undefined = browserApis(),
  ) {}

  async translateToEnglish(
    text: string,
    onDownloadProgress?: (progress: TranslationProgress) => void,
  ): Promise<TranslationResult> {
    if (!this.apis) {
      throw new Error(
        'On-device translation is not available in this browser.',
      );
    }

    const detectorAvailability =
      await this.apis.languageDetector.availability();
    if (detectorAvailability === 'unavailable') {
      throw new Error('On-device language detection is unavailable.');
    }

    const detectorMonitor = monitorDownloads(onDownloadProgress);
    const detector = await this.apis.languageDetector.create(
      detectorMonitor ? { monitor: detectorMonitor } : {},
    );
    const candidates = await detector.detect(text);
    const sourceLanguage = candidates[0]?.detectedLanguage;
    if (!sourceLanguage)
      throw new Error('The source language could not be detected.');

    if (sourceLanguage.toLowerCase().startsWith('en')) {
      return { sourceLanguage, translatedText: text, engine: 'identity' };
    }

    const availability = await this.apis.translator.availability({
      sourceLanguage,
      targetLanguage: 'en',
    });
    if (availability === 'unavailable') {
      throw new Error(
        `On-device translation from ${sourceLanguage} to English is unavailable.`,
      );
    }

    const translationMonitor = monitorDownloads(onDownloadProgress);
    const translator = await this.apis.translator.create({
      sourceLanguage,
      targetLanguage: 'en',
      ...(translationMonitor ? { monitor: translationMonitor } : {}),
    });

    return {
      sourceLanguage,
      translatedText: await translator.translate(text),
      engine: 'chromium',
    };
  }
}
