import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { AlignedGroup } from '@/analysis/alignment';
import type { ExplanationServerMessage } from '@/messaging/protocol';
import { sendRuntimeRequest } from '@/messaging/protocol';
import type { EndpointLocation } from '@/providers/provider-profile';
import type { SelectionSnapshot } from '@/selection/read-selection';

type AsyncValue<T> =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; value: T }
  | { status: 'error'; error: string };

export type LookupResult = {
  translation: AsyncValue<string>;
  explanation: AsyncValue<string>;
  alignment: AsyncValue<AlignedGroup[]>;
  provider?: { name: string; model: string; location: EndpointLocation };
};

const initialResult: LookupResult = {
  translation: { status: 'idle' },
  explanation: { status: 'idle' },
  alignment: { status: 'idle' },
};

export function useLookup(selection?: SelectionSnapshot): LookupResult {
  const [result, setResult] = useState<LookupResult>(initialResult);

  useEffect(() => {
    if (!selection) {
      setResult(initialResult);
      return;
    }

    let cancelled = false;
    let translationText = '';
    let explanationText = '';
    const requestId = crypto.randomUUID();
    const port = browser.runtime.connect({ name: 'explanation-stream' });
    const configPromise = sendRuntimeRequest({ type: 'lookup:config' });

    setResult({
      translation: { status: 'loading' },
      explanation: { status: 'loading' },
      alignment: { status: 'loading' },
    });
    void configPromise
      .then((config) => {
        const provider = config.provider;
        if (!cancelled && provider) {
          setResult((current) => ({ ...current, provider }));
        }
      })
      .catch(() => undefined);

    const lookup = new Promise<void>((resolve) => {
      if (cancelled) {
        resolve();
        return;
      }

      port.onMessage.addListener((event: ExplanationServerMessage) => {
        if (event.requestId !== requestId || cancelled) return;
        if (event.type === 'chunk') {
          if (event.field === 'translation') {
            translationText += event.text;
            setResult((current) => ({
              ...current,
              translation: {
                status: 'success',
                value: translationText,
              },
            }));
          } else {
            explanationText += event.text;
            setResult((current) => ({
              ...current,
              explanation: { status: 'success', value: explanationText },
            }));
          }
        } else if (event.type === 'alignment') {
          setResult((current) => ({
            ...current,
            alignment: { status: 'success', value: event.groups },
          }));
        } else if (event.type === 'alignment-error') {
          setResult((current) => ({
            ...current,
            alignment: { status: 'error', error: event.error },
          }));
        } else if (event.type === 'done') {
          if (!translationText || !explanationText) {
            setResult((current) => ({
              ...current,
              ...(!translationText
                ? {
                    translation: {
                      status: 'error' as const,
                      error: 'The provider returned an empty translation.',
                    },
                  }
                : {}),
              ...(!explanationText
                ? {
                    explanation: {
                      status: 'error' as const,
                      error: 'The provider returned an empty explanation.',
                    },
                  }
                : {}),
            }));
          }
          resolve();
        } else {
          setResult((current) => ({
            ...current,
            translation: { status: 'error', error: event.error },
            explanation: { status: 'error', error: event.error },
            alignment: { status: 'idle' },
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

    void lookup.then(async () => {
      if (cancelled || (!translationText && !explanationText)) return;
      try {
        const config = await configPromise;
        if (!config.historyEnabled || cancelled) return;
        await sendRuntimeRequest({
          type: 'history:add',
          entry: {
            selectedText: selection.text,
            ...(translationText ? { translation: translationText } : {}),
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
