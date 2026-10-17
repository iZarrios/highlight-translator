import { browser } from 'wxt/browser';
import type {
  OfflineTranslation,
  TranslationProgress,
} from '@/translation/translator';

type WorkerRequest = { type: 'translate'; id: string; text: string };
type WorkerResponse =
  | { type: 'progress'; id: string; loaded: number; total: number }
  | {
      type: 'result';
      id: string;
      translatedText: string;
      backend: 'webgpu' | 'wasm';
    }
  | { type: 'error'; id: string; error: string };

type PendingTranslation = {
  resolve(result: OfflineTranslation): void;
  reject(error: Error): void;
  onProgress?: (progress: TranslationProgress) => void;
};

export class OfflineWorkerRunner {
  private worker: Worker | undefined;
  private readonly pending = new Map<string, PendingTranslation>();

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(browser.runtime.getURL('/offline/worker.js'), {
      type: 'module',
    });
    worker.addEventListener(
      'message',
      (event: MessageEvent<WorkerResponse>) => {
        const request = this.pending.get(event.data.id);
        if (!request) return;
        if (event.data.type === 'progress') {
          request.onProgress?.({
            loaded: event.data.loaded,
            total: event.data.total,
          });
          return;
        }
        this.pending.delete(event.data.id);
        if (event.data.type === 'result') {
          request.resolve({
            translatedText: event.data.translatedText,
            executionBackend: event.data.backend,
          });
        } else request.reject(new Error(event.data.error));
      },
    );
    worker.addEventListener('error', () => {
      const error = new Error(
        'Offline translation assets are unavailable. Run pnpm offline:model:install, rebuild, and reload the extension.',
      );
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
      worker.terminate();
      this.worker = undefined;
    });
    this.worker = worker;
    return worker;
  }

  translate(
    text: string,
    onProgress?: (progress: TranslationProgress) => void,
  ): Promise<OfflineTranslation> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        ...(onProgress ? { onProgress } : {}),
      });
      this.getWorker().postMessage({
        type: 'translate',
        id,
        text,
      } satisfies WorkerRequest);
    });
  }
}
