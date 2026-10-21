// Kept apart from settings.ts: defining a versioned storage item touches the
// extension runtime at import time, which unit tests do not provide.
import { storage } from '#imports';
import { type AppSettings, DEFAULT_SETTINGS, parseSettings } from '@/settings';

const settingsItem = storage.defineItem<AppSettings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  set(settings: AppSettings): Promise<void>;
  watch(listener: (settings: AppSettings) => void): () => void;
}

export const settingsRepository: SettingsRepository = {
  async get() {
    return parseSettings(await settingsItem.getValue());
  },
  async set(settings) {
    await settingsItem.setValue(parseSettings(settings));
  },
  watch(listener) {
    return settingsItem.watch((value) => listener(parseSettings(value)));
  },
};
