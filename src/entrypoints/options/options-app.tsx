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
          <img src="/icons/icon-48.png" alt="" className="mb-3 size-12" />
          <h1 className="text-3xl font-semibold tracking-tight">
            Highlight Translator
          </h1>
          <p className="mt-2 text-muted-foreground">
            Translation and concise explanations from an OpenAI-compatible
            endpoint you control.
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
          <Toggle
            checked={settings.streamResults}
            onChange={(streamResults) =>
              void persist({ ...settings, streamResults })
            }
            label="Stream AI results"
            description="Show translation and explanation text as they are generated. Disable this for providers with unreliable streaming."
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
