import type { TranslationMode } from '@/settings/settings';
import type {
  SelectionTranslator,
  TranslationProgress,
  TranslationResult,
} from '@/translation/translator';

export type TranslationAdapters = {
  browser: SelectionTranslator;
  offline: SelectionTranslator;
  provider: SelectionTranslator;
};

export class TranslationCoordinator implements SelectionTranslator {
  constructor(
    private readonly mode: TranslationMode,
    private readonly adapters: TranslationAdapters,
  ) {}

  async translateToEnglish(
    text: string,
    onProgress?: (progress: TranslationProgress) => void,
  ): Promise<TranslationResult> {
    if (this.mode !== 'automatic') {
      const adapter =
        this.mode === 'browser'
          ? this.adapters.browser
          : this.mode === 'offline-wasm'
            ? this.adapters.offline
            : this.adapters.provider;
      return adapter.translateToEnglish(text, onProgress);
    }

    const failures: string[] = [];
    for (const [name, adapter] of [
      ['Browser translation', this.adapters.browser],
      ['Offline WASM', this.adapters.offline],
      ['Configured provider', this.adapters.provider],
    ] as const) {
      try {
        return await adapter.translateToEnglish(text, onProgress);
      } catch (error) {
        failures.push(
          `${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    throw new Error(failures.join('\n'));
  }
}
