import { describe, expect, it } from 'vitest';
import { parseSettings } from '@/settings/settings';

describe('settings', () => {
  it('uses privacy-preserving defaults', () => {
    expect(parseSettings(undefined)).toMatchObject({
      translationMode: 'automatic',
      streamExplanations: true,
      historyEnabled: true,
      savePageDetails: false,
      retentionLimit: 1_000,
    });
  });

  it('preserves an explicit local translation mode', () => {
    expect(parseSettings({ translationMode: 'offline-wasm' })).toMatchObject({
      translationMode: 'offline-wasm',
    });
  });

  it('repairs a removed active provider reference', () => {
    expect(
      parseSettings({
        activeProviderId: 'missing',
        providers: [],
      }).activeProviderId,
    ).toBeUndefined();
  });
});
