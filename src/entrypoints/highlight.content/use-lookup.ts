import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { ExplanationServerMessage } from '@/messaging/protocol';
import { sendRuntimeRequest } from '@/messaging/protocol';
import type { EndpointLocation } from '@/providers/provider-profile';
import type { SelectionSnapshot } from '@/selection/read-selection';
import { ChromiumTranslator } from '@/translation/chromium-translator';
import { OfflineWasmTranslator } from '@/translation/offline-wasm-translator';
import { TranslationCoordinator } from '@/translation/translation-coordinator';
import type { TranslationResult } from '@/translation/translator';

type AsyncValue<T> =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; value: T }
  | { status: 'error'; error: string };

export type LookupResult = {
  translation: AsyncValue<TranslationResult> & { progress?: number };
  explanation: AsyncValue<string>;
  provider?: { name: string; model: string; location: EndpointLocation };
};

const initialResult: LookupResult = {
  translation: { status: 'idle' },
  explanation: { status: 'idle' },
};

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

export function useLookup(selection?: SelectionSnapshot): LookupResult {
  const [result, setResult] = useState<LookupResult>(initialResult);

  useEffect(() => {
    if (!selection) {
      setResult(initialResult);
      return;
    }

    let cancelled = false;
    let translationResult: TranslationResult | undefined;
    let explanationText = '';
    const requestId = crypto.randomUUID();
    const port = browser.runtime.connect({ name: 'explanation-stream' });
    const configPromise = sendRuntimeRequest({ type: 'lookup:config' });

    setResult({
      translation: { status: 'loading', progress: 0 },
      explanation: { status: 'loading' },
    });
    void configPromise
      .then((config) => {
        const provider = config.provider;
        if (!cancelled && provider) {
          setResult((current) => ({ ...current, provider }));
        }
      })
      .catch(() => undefined);

    const progress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (cancelled) return;
      setResult((current) => ({
        ...current,
        translation: {
          status: 'loading',
          ...(total > 0
            ? { progress: Math.round((loaded / total) * 100) }
            : {}),
        },
      }));
    };
    const providerTranslator = {
      translateToEnglish: (text: string) =>
        sendRuntimeRequest({ type: 'translation:provider', text }),
    };
    const translation = configPromise
      .then((config) =>
        new TranslationCoordinator(config.translationMode, {
          browser: new ChromiumTranslator(),
          offline: new OfflineWasmTranslator(),
          provider: providerTranslator,
        }).translateToEnglish(selection.text, progress),
      )
      .then((value) => {
        translationResult = value;
        if (!cancelled) {
          setResult((current) => ({
            ...current,
            translation: { status: 'success', value },
          }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setResult((current) => ({
            ...current,
            translation: { status: 'error', error: message(error) },
          }));
        }
      });

    const explanation = new Promise<void>((resolve) => {
      port.onMessage.addListener((event: ExplanationServerMessage) => {
        if (event.requestId !== requestId || cancelled) return;
        if (event.type === 'chunk') {
          explanationText += event.text;
          setResult((current) => ({
            ...current,
            explanation: { status: 'success', value: explanationText },
          }));
        } else if (event.type === 'done') {
          if (!explanationText) {
            setResult((current) => ({
              ...current,
              explanation: {
                status: 'error',
                error: 'The provider returned an empty explanation.',
              },
            }));
          }
          resolve();
        } else {
          setResult((current) => ({
            ...current,
            explanation: { status: 'error', error: event.error },
          }));
          resolve();
        }
      });
      port.onDisconnect.addListener(() => resolve());
      port.postMessage({
        type: 'start',
        requestId,
        text: selection.text,
        ...(selection.nearbyContext
          ? { nearbyContext: selection.nearbyContext }
          : {}),
      });
    });

    void Promise.allSettled([translation, explanation]).then(async () => {
      if (cancelled || (!translationResult && !explanationText)) return;
      try {
        const config = await configPromise;
        if (!config.historyEnabled || cancelled) return;
        await sendRuntimeRequest({
          type: 'history:add',
          entry: {
            selectedText: selection.text,
            ...(translationResult?.sourceLanguage
              ? { sourceLanguage: translationResult.sourceLanguage }
              : {}),
            ...(translationResult?.translatedText
              ? { translation: translationResult.translatedText }
              : {}),
            ...(explanationText ? { explanation: explanationText } : {}),
            ...(config.savePageDetails
              ? {
                  pageTitle: document.title.slice(0, 300),
                  pageUrl: location.href.slice(0, 2_048),
                }
              : {}),
            ...(config.provider?.id ? { providerId: config.provider.id } : {}),
            ...(config.provider?.model ? { model: config.provider.model } : {}),
            createdAt: Date.now(),
            favorite: false,
          },
        });
      } catch {
        // History failure must not replace a successful lookup with an error.
      }
    });

    return () => {
      cancelled = true;
      try {
        port.postMessage({ type: 'cancel', requestId });
      } catch {
        // The background may already have closed the port after an extension reload.
      }
      port.disconnect();
    };
  }, [selection]);

  return result;
}
