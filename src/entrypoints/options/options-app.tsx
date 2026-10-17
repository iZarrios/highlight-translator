import { useEffect, useState } from 'react';
import {
  fieldClass,
  ProviderSettings,
} from '@/entrypoints/options/provider-settings';
import { sendRuntimeRequest } from '@/messaging/protocol';
import { type AppSettings, DEFAULT_SETTINGS } from '@/settings/settings';

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 border-b border-border py-4 last:border-0">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function OptionsApp() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    void sendRuntimeRequest({ type: 'settings:get' })
      .then(setSettings)
      .catch((error) => setNotice(String(error)));
  }, []);

  const persist = async (next: AppSettings) => {
    const saved = await sendRuntimeRequest({
      type: 'settings:set',
      settings: next,
    });
    setSettings(saved);
    setNotice('Settings saved.');
  };

  return (
    <main className="min-h-screen bg-background px-5 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-xl">Aa</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Highlight Translator
          </h1>
          <p className="mt-2 text-muted-foreground">
            On-device translation with explanations from an AI endpoint you
            control.
          </p>
        </header>

        {notice ? (
          <div
            role="status"
            className="mb-5 rounded-xl border border-border bg-card px-4 py-3 text-sm"
          >
            {notice}
          </div>
        ) : null}

        <ProviderSettings
          settings={settings}
          persist={persist}
          notify={setNotice}
        />

        <section className="rounded-2xl border border-border bg-card px-5 shadow-sm">
          <h2 className="pt-5 text-lg font-semibold">Behavior and privacy</h2>
          <label className="block border-b border-border py-4 text-sm font-medium">
            Translation engine
            <select
              className={fieldClass}
              value={settings.translationMode}
              onChange={(event) =>
                void persist({
                  ...settings,
                  translationMode: event.target
                    .value as AppSettings['translationMode'],
                })
              }
            >
              <option value="automatic">
                Automatic — browser, offline WASM, then provider
              </option>
              <option value="offline-wasm">Offline WASM only</option>
              <option value="provider">Configured AI provider only</option>
              <option value="browser">Chrome built-in only</option>
            </select>
            <span className="mt-2 block text-xs font-normal leading-5 text-muted-foreground">
              Offline WASM never sends highlighted text over the network. The
              provider option sends it only to the active endpoint shown above.
            </span>
          </label>
          <Toggle
            checked={settings.streamExplanations}
            onChange={(streamExplanations) =>
              void persist({ ...settings, streamExplanations })
            }
            label="Stream explanations"
            description="Show explanation text as it is generated. Disable this for providers with unreliable streaming."
          />
          <Toggle
            checked={settings.historyEnabled}
            onChange={(historyEnabled) =>
              void persist({ ...settings, historyEnabled })
            }
            label="Save lookup history"
            description="Store highlighted text, translations, and explanations locally in this browser profile."
          />
          <Toggle
            checked={settings.savePageDetails}
            onChange={(savePageDetails) =>
              void persist({ ...settings, savePageDetails })
            }
            label="Save page title and URL"
            description="Off by default because browsing locations can be sensitive."
          />
          <label className="block py-4 text-sm font-medium">
            History retention
            <select
              className={fieldClass}
              value={settings.retentionLimit}
              onChange={(event) =>
                void persist({
                  ...settings,
                  retentionLimit: Number(event.target.value),
                })
              }
            >
              <option value={100}>100 entries</option>
              <option value={500}>500 entries</option>
              <option value={1000}>1,000 entries</option>
              <option value={5000}>5,000 entries</option>
            </select>
          </label>
        </section>
      </div>
    </main>
  );
}
