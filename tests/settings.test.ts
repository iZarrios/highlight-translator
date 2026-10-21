import { describe, expect, it } from 'vitest';
import { parseSettings } from '@/settings';

describe('settings', () => {
  it('uses privacy-preserving defaults', () => {
    expect(parseSettings(undefined)).toMatchObject({
      streamResults: true,
      historyEnabled: true,
      savePageDetails: false,
      retentionLimit: 1_000,
    });
  });

  it('migrates the previous streaming preference', () => {
    expect(parseSettings({ streamExplanations: false }).streamResults).toBe(
      false,
    );
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
