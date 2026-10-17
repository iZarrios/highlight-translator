import {
  CheckCircle2,
  Cloud,
  HardDrive,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { sendRuntimeRequest } from '@/messaging/protocol';
import {
  classifyEndpoint,
  createProviderProfile,
  type ProviderProfile,
} from '@/providers/provider-profile';
import type { AppSettings } from '@/settings/settings';

type ProviderDraft = {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
};

const blankProvider: ProviderDraft = {
  name: '',
  baseUrl: 'http://127.0.0.1:11434/v1',
  model: '',
  apiKey: '',
};

export const fieldClass =
  'mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20';

function isUnencryptedNonLocalEndpoint(value: string): boolean {
  try {
    return (
      new URL(value).protocol === 'http:' &&
      classifyEndpoint(value) !== 'device'
    );
  } catch {
    return false;
  }
}

function ProviderList({
  settings,
  onSelect,
  onRemove,
}: {
  settings: AppSettings;
  onSelect(provider: ProviderProfile): void;
  onRemove(provider: ProviderProfile): void;
}) {
  if (settings.providers.length === 0) {
    return (
      <div className="rounded-xl bg-muted px-4 py-5 text-center text-sm text-muted-foreground">
        No provider configured yet. Translation still works on-device.
      </div>
    );
  }

  return settings.providers.map((provider) => (
    <div
      key={provider.id}
      className="flex items-center gap-3 rounded-xl border border-border px-3 py-3"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
        {classifyEndpoint(provider.baseUrl) !== 'remote' ? (
          <HardDrive className="size-4" />
        ) : (
          <Cloud className="size-4" />
        )}
      </span>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onSelect(provider)}
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {provider.name}
          {settings.activeProviderId === provider.id ? (
            <CheckCircle2
              className="size-3.5 text-green-600"
              aria-label="Active"
            />
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {provider.model} · {provider.baseUrl}
        </span>
      </button>
      <Button
        type="button"
        variant="danger"
        size="icon"
        aria-label={`Remove ${provider.name}`}
        onClick={() => onRemove(provider)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  ));
}

export function ProviderSettings({
  settings,
  persist,
  notify,
}: {
  settings: AppSettings;
  persist(settings: AppSettings): Promise<void>;
  notify(message: string | undefined): void;
}) {
  const [draft, setDraft] = useState<ProviderDraft>(blankProvider);
  const [models, setModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const discoverProviderModels = async () => {
    setTesting(true);
    notify(undefined);
    try {
      const candidate = createProviderProfile({
        ...draft,
        name: draft.name || 'Connection test',
        model: draft.model || 'model-discovery',
      });
      const granted = await browser.permissions.request({
        origins: [candidate.originPermission],
      });
      if (!granted)
        throw new Error('Permission to contact this endpoint was not granted.');
      const result = await sendRuntimeRequest({
        type: 'provider:test',
        provider: {
          ...draft,
          name: draft.name || 'Connection test',
          model: candidate.model,
        },
      });
      if (result.models.length === 0) {
        throw new Error(
          'The endpoint returned no models. Enter a model ID manually.',
        );
      }
      setModels(result.models);
      setDraft((current) => ({
        ...current,
        model: result.models.includes(current.model)
          ? current.model
          : (result.models[0] ?? ''),
      }));
      notify(
        `Connected in ${result.latencyMs} ms. Found ${result.models.length} model(s).`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Connection failed.');
    } finally {
      setTesting(false);
    }
  };

  const addProvider = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const provider = createProviderProfile(draft);
      const granted = await browser.permissions.request({
        origins: [provider.originPermission],
      });
      if (!granted)
        throw new Error('Permission to contact this endpoint was not granted.');
      await persist({
        ...settings,
        providers: [...settings.providers, provider],
        activeProviderId: settings.activeProviderId ?? provider.id,
      });
      setDraft(blankProvider);
      setModels([]);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Provider could not be saved.',
      );
    }
  };

  const removeProvider = async (provider: ProviderProfile) => {
    const providers = settings.providers.filter(({ id }) => id !== provider.id);
    const activeProviderId =
      settings.activeProviderId === provider.id
        ? providers[0]?.id
        : settings.activeProviderId;
    await persist({
      providers,
      translationMode: settings.translationMode,
      streamExplanations: settings.streamExplanations,
      historyEnabled: settings.historyEnabled,
      savePageDetails: settings.savePageDetails,
      retentionLimit: settings.retentionLimit,
      ...(activeProviderId ? { activeProviderId } : {}),
    });
    const originStillUsed = providers.some(
      ({ originPermission }) => originPermission === provider.originPermission,
    );
    if (!originStillUsed) {
      await browser.permissions
        .remove({ origins: [provider.originPermission] })
        .catch(() => false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Explanation providers</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add any HTTP or HTTPS server implementing the OpenAI Chat Completions
        interface.
      </p>
      <div className="mt-4 space-y-2">
        <ProviderList
          settings={settings}
          onSelect={(provider) =>
            void persist({ ...settings, activeProviderId: provider.id })
          }
          onRemove={(provider) => void removeProvider(provider)}
        />
      </div>

      <form
        onSubmit={addProvider}
        className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2"
      >
        <label className="text-sm font-medium">
          Name
          <input
            className={fieldClass}
            required
            placeholder="Local Ollama"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </label>
        <label className="text-sm font-medium">
          Base URL
          <input
            className={fieldClass}
            required
            type="url"
            value={draft.baseUrl}
            onChange={(event) => {
              setModels([]);
              setDraft({ ...draft, baseUrl: event.target.value, model: '' });
            }}
          />
          {isUnencryptedNonLocalEndpoint(draft.baseUrl) ? (
            <span className="mt-2 block rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-normal text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              This remote HTTP connection is unencrypted. Highlighted text and
              credentials may be intercepted.
            </span>
          ) : null}
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          API key{' '}
          <span className="font-normal text-muted-foreground">
            (optional, stored locally)
          </span>
          <input
            className={fieldClass}
            type="password"
            autoComplete="off"
            value={draft.apiKey}
            onChange={(event) =>
              setDraft({ ...draft, apiKey: event.target.value })
            }
          />
        </label>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="provider-model">
            Model
          </label>
          {models.length > 0 ? (
            <>
              <select
                id="provider-model"
                className={fieldClass}
                required
                value={draft.model}
                onChange={(event) =>
                  setDraft({ ...draft, model: event.target.value })
                }
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {models.length} model{models.length === 1 ? '' : 's'}{' '}
                  available
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setModels([]);
                    setDraft({ ...draft, model: '' });
                  }}
                >
                  Enter manually
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-end gap-2">
              <input
                id="provider-model"
                className={fieldClass}
                required
                placeholder="Select Load models, or enter a model ID"
                value={draft.model}
                onChange={(event) =>
                  setDraft({ ...draft, model: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                className="shrink-0"
                onClick={() => void discoverProviderModels()}
                disabled={testing || draft.baseUrl.trim().length === 0}
              >
                {testing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}{' '}
                Load models
              </Button>
            </div>
          )}
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">
            <Plus className="size-4" /> Add provider
          </Button>
        </div>
      </form>
    </section>
  );
}
