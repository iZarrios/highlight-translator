import { extensionFetch, type Fetcher } from '@/lib/extension-fetch';
import type { ProviderProfile } from '@/providers/provider-profile';
import { resolveOpenAIUrl } from '@/providers/provider-profile';

export async function discoverModels(
  provider: ProviderProfile,
  fetcher: Fetcher = extensionFetch,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetcher(resolveOpenAIUrl(provider.baseUrl, 'models'), {
    ...(provider.apiKey
      ? { headers: { authorization: `Bearer ${provider.apiKey}` } }
      : {}),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok)
    throw new Error(`Model discovery failed (${response.status}).`);

  const body = (await response.json()) as { data?: Array<{ id?: unknown }> };
  if (!Array.isArray(body.data))
    throw new Error('The provider returned an invalid model list.');
  return body.data
    .map(({ id }) => id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .sort((left, right) => left.localeCompare(right));
}
