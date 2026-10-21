import {
  Clock3,
  Download,
  ExternalLink,
  Heart,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import type { HistoryEntry } from '@/history';
import { sendRuntimeRequest } from '@/protocol';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/components/button';

function downloadHistory(entries: HistoryEntry[]) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `highlight-translator-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function HistoryCard({
  entry,
  refresh,
}: {
  entry: HistoryEntry;
  refresh(): Promise<void>;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium leading-5">
          {entry.selectedText}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(entry.favorite && 'text-red-500')}
          aria-label={
            entry.favorite ? 'Remove from favorites' : 'Add to favorites'
          }
          onClick={async () => {
            await sendRuntimeRequest({
              type: 'history:favorite',
              id: entry.id,
              favorite: !entry.favorite,
            });
            await refresh();
          }}
        >
          <Heart className={cn('size-4', entry.favorite && 'fill-current')} />
        </Button>
      </div>

      {entry.translation ? (
        <div className="mt-3 rounded-lg bg-muted px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            English {entry.sourceLanguage ? `· ${entry.sourceLanguage}` : ''}
          </div>
          <p className="mt-1 text-sm leading-5">{entry.translation}</p>
        </div>
      ) : null}
      {entry.explanation ? (
        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
          {entry.explanation}
        </p>
      ) : null}

      <footer className="mt-3 flex items-center gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
        <Clock3 className="size-3" />
        <span>{formatDate(entry.createdAt)}</span>
        <span className="min-w-0 flex-1 truncate">
          {entry.pageTitle ? `· ${entry.pageTitle}` : ''}
        </span>
        {entry.pageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open source page"
            onClick={() => void browser.tabs.create({ url: entry.pageUrl })}
          >
            <ExternalLink className="size-3.5" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="danger"
          size="icon"
          aria-label="Delete history entry"
          onClick={async () => {
            await sendRuntimeRequest({ type: 'history:remove', id: entry.id });
            await refresh();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </footer>
    </article>
  );
}

export function HistoryApp() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const history = await sendRuntimeRequest({ type: 'history:list' });
    setEntries(history);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const listener = (message: unknown) => {
      if ((message as { type?: string })?.type === 'history:changed')
        void refresh();
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [refresh]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (favoritesOnly && !entry.favorite) return false;
      if (!normalized) return true;
      return [
        entry.selectedText,
        entry.translation,
        entry.explanation,
        entry.pageTitle,
        entry.pageUrl,
      ]
        .filter(Boolean)
        .join('\n')
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [entries, favoritesOnly, query]);

  return (
    <main className="min-h-screen bg-background p-3 font-sans text-foreground">
      <header className="sticky top-0 z-10 -mx-3 -mt-3 border-b border-border bg-background/95 px-3 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-32.png" alt="" className="size-8" />
            <div>
              <h1 className="text-lg font-semibold">Lookup history</h1>
              <p className="text-xs text-muted-foreground">
                {entries.length} saved entries · local only
              </p>
            </div>
          </div>
          <div className="flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Export history"
              onClick={() => downloadHistory(entries)}
            >
              <Download className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open settings"
              onClick={() => void browser.runtime.openOptionsPage()}
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring/30">
          <Search className="size-4 text-muted-foreground" />
          <input
            type="search"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Search highlights and explanations"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={cn(
            'mt-2 rounded-full px-2.5 py-1 text-xs transition',
            favoritesOnly
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          Favorites
        </button>
      </header>

      <div className="mt-3 space-y-3">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading history…
          </p>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium">No matching highlights</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select text on a webpage to begin.
            </p>
          </div>
        ) : null}
        {filtered.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} refresh={refresh} />
        ))}
      </div>

      {entries.length > 0 ? (
        <Button
          type="button"
          variant="danger"
          className="mt-5 w-full"
          onClick={async () => {
            if (
              !window.confirm(
                'Delete all lookup history? This cannot be undone.',
              )
            )
              return;
            await sendRuntimeRequest({ type: 'history:clear' });
            await refresh();
          }}
        >
          <Trash2 className="size-4" /> Clear all history
        </Button>
      ) : null}
    </main>
  );
}
