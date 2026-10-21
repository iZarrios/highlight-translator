import { browser } from 'wxt/browser';
import { extensionFetch } from '@/extension-fetch';
import { createHistoryRepository } from '@/history';
import { discoverModels } from '@/model-discovery';
import { OpenAIExplanationClient } from '@/openai-explanation-client';
import type {
  ExplanationCancel,
  ExplanationServerMessage,
  ExplanationStart,
  RuntimeRequest,
  RuntimeResponse,
} from '@/protocol';
import { classifyEndpoint, createProviderProfile } from '@/provider-profile';
import { activeProvider } from '@/settings';
import { settingsRepository } from '@/settings-storage';

const history = createHistoryRepository();
const runtimeRequestTypes = new Set<RuntimeRequest['type']>([
  'lookup:config',
  'settings:get',
  'settings:set',
  'provider:test',
  'history:add',
  'history:list',
  'history:favorite',
  'history:remove',
  'history:clear',
]);

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'Request cancelled.';
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

async function handleRequest(request: RuntimeRequest): Promise<unknown> {
  switch (request.type) {
    case 'lookup:config': {
      const settings = await settingsRepository.get();
      const provider = activeProvider(settings);
      return {
        historyEnabled: settings.historyEnabled,
        savePageDetails: settings.savePageDetails,
        ...(provider
          ? {
              provider: {
                id: provider.id,
                name: provider.name,
                model: provider.model,
                location: classifyEndpoint(provider.baseUrl),
              },
            }
          : {}),
      };
    }
    case 'settings:get':
      return settingsRepository.get();
    case 'settings:set':
      await settingsRepository.set(request.settings);
      return settingsRepository.get();
    case 'provider:test': {
      const provider = createProviderProfile(request.provider);
      const startedAt = performance.now();
      const models = await discoverModels(
        provider,
        extensionFetch,
        AbortSignal.timeout(10_000),
      );
      return { latencyMs: Math.round(performance.now() - startedAt), models };
    }
    case 'history:add': {
      const settings = await settingsRepository.get();
      if (!settings.historyEnabled) return undefined;
      const entry = await history.add(request.entry, settings.retentionLimit);
      await browser.runtime
        .sendMessage({ type: 'history:changed' })
        .catch(() => undefined);
      return entry;
    }
    case 'history:list':
      return history.list(request.query);
    case 'history:favorite':
      await history.setFavorite(request.id, request.favorite);
      return undefined;
    case 'history:remove':
      await history.remove(request.id);
      return undefined;
    case 'history:clear':
      await history.clear();
      return undefined;
  }
}

function isRuntimeRequest(value: unknown): value is RuntimeRequest {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  return runtimeRequestTypes.has(
    (value as { type: RuntimeRequest['type'] }).type,
  );
}

export function startBackground(): void {
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);

  browser.runtime.onMessage.addListener(
    (request: unknown): Promise<RuntimeResponse> | undefined => {
      if (!isRuntimeRequest(request)) return undefined;
      return handleRequest(request)
        .then((value) => ({ ok: true as const, value }))
        .catch((error: unknown) => ({
          ok: false as const,
          error: errorMessage(error),
        }));
    },
  );

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'explanation-stream') return;
    const controllers = new Map<string, AbortController>();

    const post = (message: ExplanationServerMessage) =>
      port.postMessage(message);
    port.onMessage.addListener(
      async (message: ExplanationStart | ExplanationCancel) => {
        if (message.type === 'cancel') {
          controllers.get(message.requestId)?.abort();
          controllers.delete(message.requestId);
          return;
        }

        const controller = new AbortController();
        controllers.set(message.requestId, controller);
        let wordMapping: Promise<void> | undefined;
        try {
          const settings = await settingsRepository.get();
          const provider = activeProvider(settings);
          if (!provider)
            throw new Error('Configure and select an AI provider first.');
          const client = new OpenAIExplanationClient(provider);
          const request = {
            text: message.text,
            ...(message.nearbyContext
              ? { nearbyContext: message.nearbyContext }
              : {}),
          };
          // The mapping only needs the final translation, so it runs while
          // the explanation is still being generated.
          const startWordMapping = (translation: string) => {
            wordMapping ??= client
              .mapWords({ text: message.text, translation }, controller.signal)
              .then((groups) =>
                post({
                  type: 'word-mapping',
                  requestId: message.requestId,
                  groups,
                }),
              )
              .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                post({
                  type: 'word-mapping-error',
                  requestId: message.requestId,
                  error: errorMessage(error),
                });
              });
          };

          if (settings.streamResults) {
            let translation = '';
            for await (const chunk of client.streamExplanation(
              request,
              controller.signal,
            )) {
              if (chunk.field === 'translation') translation += chunk.text;
              else if (translation) startWordMapping(translation);
              post({
                type: 'chunk',
                requestId: message.requestId,
                field: chunk.field,
                text: chunk.text,
              });
            }
            if (translation) startWordMapping(translation);
          } else {
            const result = await client.explain(request, controller.signal);
            startWordMapping(result.translation);
            post({
              type: 'chunk',
              requestId: message.requestId,
              field: 'translation',
              text: result.translation,
            });
            post({
              type: 'chunk',
              requestId: message.requestId,
              field: 'explanation',
              text: result.explanation,
            });
          }
          post({ type: 'done', requestId: message.requestId });
        } catch (error) {
          if (!controller.signal.aborted) {
            post({
              type: 'error',
              requestId: message.requestId,
              error: errorMessage(error),
            });
          }
        } finally {
          await wordMapping;
          controllers.delete(message.requestId);
        }
      },
    );

    port.onDisconnect.addListener(() => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    });
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-lookup') return;
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id)
      await browser.tabs
        .sendMessage(tab.id, { type: 'selection:lookup' })
        .catch(() => undefined);
  });
}
