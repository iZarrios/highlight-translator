import { browser } from 'wxt/browser';
import type { AlignedGroup } from '@/analysis/alignment';
import type {
  HistoryEntry,
  HistoryQuery,
  NewHistoryEntry,
} from '@/history/history-entry';
import type {
  EndpointLocation,
  ProviderInput,
} from '@/providers/provider-profile';
import type { AppSettings } from '@/settings/settings';

export type RuntimeRequest =
  | { type: 'lookup:config' }
  | { type: 'settings:get' }
  | { type: 'settings:set'; settings: AppSettings }
  | { type: 'provider:test'; provider: ProviderInput }
  | { type: 'history:add'; entry: NewHistoryEntry }
  | { type: 'history:list'; query?: HistoryQuery }
  | { type: 'history:favorite'; id: string; favorite: boolean }
  | { type: 'history:remove'; id: string }
  | { type: 'history:clear' };

export type RuntimeResponse<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type RuntimeResponseMap = {
  'lookup:config': LookupConfig;
  'settings:get': AppSettings;
  'settings:set': AppSettings;
  'provider:test': { latencyMs: number; models: string[] };
  'history:add': HistoryEntry | undefined;
  'history:list': HistoryEntry[];
  'history:favorite': undefined;
  'history:remove': undefined;
  'history:clear': undefined;
};

export type LookupConfig = {
  historyEnabled: boolean;
  savePageDetails: boolean;
  provider?: {
    id: string;
    name: string;
    model: string;
    location: EndpointLocation;
  };
};

export type ExplanationStart = {
  type: 'start';
  requestId: string;
  text: string;
  nearbyContext?: string;
};

export type ExplanationCancel = { type: 'cancel'; requestId: string };

export type ExplanationServerMessage =
  | {
      type: 'chunk';
      requestId: string;
      field: 'translation' | 'explanation';
      text: string;
    }
  | { type: 'done'; requestId: string }
  | { type: 'alignment'; requestId: string; groups: AlignedGroup[] }
  | { type: 'alignment-error'; requestId: string; error: string }
  | { type: 'error'; requestId: string; error: string };

export async function sendRuntimeRequest<T extends RuntimeRequest>(
  request: T,
): Promise<RuntimeResponseMap[T['type']]> {
  const response = (await browser.runtime.sendMessage(
    request,
  )) as RuntimeResponse<RuntimeResponseMap[T['type']]>;
  if (response.ok) return response.value;
  throw new Error(
    'error' in response
      ? response.error
      : 'The extension returned an invalid response.',
  );
}
