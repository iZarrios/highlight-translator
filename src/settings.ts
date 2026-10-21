import { z } from 'zod';
import {
  createProviderProfile,
  type ProviderProfile,
} from '@/provider-profile';

export type AppSettings = {
  providers: ProviderProfile[];
  activeProviderId?: string;
  streamResults: boolean;
  historyEnabled: boolean;
  savePageDetails: boolean;
  retentionLimit: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  streamResults: true,
  historyEnabled: true,
  savePageDetails: false,
  retentionLimit: 1_000,
};

const storedSettingsSchema = z
  .object({
    providers: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          baseUrl: z.string(),
          model: z.string(),
          apiKey: z.string().optional(),
          enabled: z.boolean().optional(),
        }),
      )
      .optional(),
    activeProviderId: z.string().optional(),
    streamResults: z.boolean().optional(),
    // Read the previous key once so existing installations keep their choice.
    streamExplanations: z.boolean().optional(),
    historyEnabled: z.boolean().optional(),
    savePageDetails: z.boolean().optional(),
    retentionLimit: z.number().int().min(1).max(50_000).optional(),
  })
  .partial();

export function parseSettings(value: unknown): AppSettings {
  const parsed = storedSettingsSchema.safeParse(value ?? {});
  if (!parsed.success) return { ...DEFAULT_SETTINGS };

  const providers = (parsed.data.providers ?? []).flatMap((provider) => {
    try {
      return [createProviderProfile(provider)];
    } catch {
      return [];
    }
  });
  const activeProviderId = providers.some(
    ({ id }) => id === parsed.data.activeProviderId,
  )
    ? parsed.data.activeProviderId
    : undefined;

  return {
    providers,
    streamResults:
      parsed.data.streamResults ??
      parsed.data.streamExplanations ??
      DEFAULT_SETTINGS.streamResults,
    historyEnabled:
      parsed.data.historyEnabled ?? DEFAULT_SETTINGS.historyEnabled,
    savePageDetails:
      parsed.data.savePageDetails ?? DEFAULT_SETTINGS.savePageDetails,
    retentionLimit:
      parsed.data.retentionLimit ?? DEFAULT_SETTINGS.retentionLimit,
    ...(activeProviderId ? { activeProviderId } : {}),
  };
}

export function activeProvider(
  settings: AppSettings,
): ProviderProfile | undefined {
  return settings.providers.find(
    (provider) => provider.enabled && provider.id === settings.activeProviderId,
  );
}
