import { z } from 'zod';

const providerInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, 'Provider name is required.'),
  baseUrl: z.string().trim().min(1, 'Endpoint URL is required.'),
  model: z.string().trim().min(1, 'Model is required.'),
  apiKey: z.string().optional(),
  enabled: z.boolean().optional(),
});

export type ProviderInput = z.input<typeof providerInputSchema>;

export type ProviderProfile = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  enabled: boolean;
  originPermission: string;
};

export type EndpointLocation = 'device' | 'network' | 'remote';

export function classifyEndpoint(baseUrl: string): EndpointLocation {
  const hostname = normalizeBaseUrl(baseUrl).hostname.toLocaleLowerCase();
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return 'device';
  if (
    !hostname.includes('.') ||
    hostname.endsWith('.local') ||
    hostname === 'host.docker.internal' ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^\[f[cd][0-9a-f]{2}:/i.test(hostname)
  ) {
    return 'network';
  }
  return 'remote';
}

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Provider URLs must use HTTP or HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('Provider URLs cannot contain embedded credentials.');
  }
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url;
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `provider-${Date.now()}`;
}

export function createProviderProfile(input: ProviderInput): ProviderProfile {
  const parsed = providerInputSchema.parse(input);
  const url = normalizeBaseUrl(parsed.baseUrl);
  const baseUrl = url.toString().replace(/\/$/, '');

  return {
    id: parsed.id ?? makeId(),
    name: parsed.name,
    baseUrl,
    model: parsed.model,
    ...(parsed.apiKey ? { apiKey: parsed.apiKey } : {}),
    enabled: parsed.enabled ?? true,
    originPermission: `${url.origin}/*`,
  };
}

export function resolveOpenAIUrl(
  baseUrl: string,
  resource: 'models' | 'chat/completions',
): string {
  const url = normalizeBaseUrl(baseUrl);
  const resourceSuffix = `/${resource}`;

  if (url.pathname.endsWith(resourceSuffix)) {
    return url.toString().replace(/\/$/, '');
  }

  for (const alternate of ['/chat/completions', '/models']) {
    if (url.pathname.endsWith(alternate)) {
      url.pathname = url.pathname.slice(0, -alternate.length);
      break;
    }
  }

  const path = url.pathname === '/' ? '/v1' : url.pathname;
  url.pathname = `${path.replace(/\/$/, '')}${resourceSuffix}`;
  return url.toString();
}
