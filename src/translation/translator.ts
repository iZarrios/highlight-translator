export type OfflineTranslation = {
  translatedText: string;
  executionBackend: 'webgpu' | 'wasm';
};

export type TranslationResult = {
  sourceLanguage: string;
  translatedText: string;
  engine: 'chromium' | 'identity' | 'offline-wasm' | 'provider';
  executionBackend?: 'webgpu' | 'wasm';
};

export type TranslationProgress = {
  loaded: number;
  total: number;
};

export interface SelectionTranslator {
  translateToEnglish(
    text: string,
    onDownloadProgress?: (progress: TranslationProgress) => void,
  ): Promise<TranslationResult>;
}
