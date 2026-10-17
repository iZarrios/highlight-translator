import { browser } from 'wxt/browser';
import type {
  OfflineHostRequest,
  OfflineHostResponse,
} from '@/messaging/protocol';
import { OfflineWorkerRunner } from '@/translation/offline-worker-runner';

const runner = new OfflineWorkerRunner();

function isOfflineHostRequest(value: unknown): value is OfflineHostRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<OfflineHostRequest>;
  return (
    request.target === 'offscreen' &&
    request.type === 'offline:translate' &&
    typeof request.text === 'string'
  );
}

browser.runtime.onMessage.addListener(
  (request: unknown): Promise<OfflineHostResponse> | undefined => {
    if (!isOfflineHostRequest(request)) return undefined;
    return runner
      .translate(request.text)
      .then((value) => ({ ok: true as const, value }))
      .catch((error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      }));
  },
);
