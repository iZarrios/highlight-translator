import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from 'idb';
import type {
  HistoryEntry,
  HistoryQuery,
  HistoryRepository,
  NewHistoryEntry,
} from '@/history/history-entry';

const DATABASE_NAME = 'highlight-translator';
const DATABASE_VERSION = 1;
const STORE_NAME = 'history';
const DEFAULT_RETENTION_LIMIT = 1_000;

interface HistoryDatabase extends DBSchema {
  history: {
    key: string;
    value: HistoryEntry;
    indexes: { 'by-created-at': number };
  };
}

function openHistoryDatabase(): Promise<IDBPDatabase<HistoryDatabase>> {
  return openDB<HistoryDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by-created-at', 'createdAt');
    },
  });
}

function id(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `history-${Date.now()}-${Math.random()}`
  );
}

function searchableText(entry: HistoryEntry): string {
  return [
    entry.selectedText,
    entry.translation,
    entry.explanation,
    entry.pageTitle,
    entry.pageUrl,
    entry.sourceLanguage,
  ]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase();
}

async function enforceRetention(
  database: IDBPDatabase<HistoryDatabase>,
  retentionLimit: number,
): Promise<void> {
  const entries = (await database.getAll(STORE_NAME)).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  let excess = entries.length - Math.max(1, retentionLimit);
  if (excess <= 0) return;

  const transaction = database.transaction(STORE_NAME, 'readwrite');
  for (const entry of entries) {
    if (excess <= 0) break;
    if (entry.favorite) continue;
    await transaction.store.delete(entry.id);
    excess -= 1;
  }
  await transaction.done;
}

class IndexedDbHistoryRepository implements HistoryRepository {
  async add(
    entry: NewHistoryEntry,
    retentionLimit = DEFAULT_RETENTION_LIMIT,
  ): Promise<HistoryEntry> {
    const stored: HistoryEntry = { ...entry, id: entry.id ?? id() };
    const database = await openHistoryDatabase();
    try {
      await database.put(STORE_NAME, stored);
      await enforceRetention(database, retentionLimit);
      return stored;
    } finally {
      database.close();
    }
  }

  async list(query: HistoryQuery = {}): Promise<HistoryEntry[]> {
    const database = await openHistoryDatabase();
    try {
      const textQuery = query.query?.trim().toLocaleLowerCase();
      const entries = (await database.getAll(STORE_NAME))
        .filter((entry) => !query.favoritesOnly || entry.favorite)
        .filter(
          (entry) => !textQuery || searchableText(entry).includes(textQuery),
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      return query.limit ? entries.slice(0, query.limit) : entries;
    } finally {
      database.close();
    }
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const database = await openHistoryDatabase();
    try {
      const entry = await database.get(STORE_NAME, id);
      if (!entry) return;
      await database.put(STORE_NAME, { ...entry, favorite });
    } finally {
      database.close();
    }
  }

  async remove(id: string): Promise<void> {
    const database = await openHistoryDatabase();
    try {
      await database.delete(STORE_NAME, id);
    } finally {
      database.close();
    }
  }

  async clear(): Promise<void> {
    const database = await openHistoryDatabase();
    try {
      await database.clear(STORE_NAME);
    } finally {
      database.close();
    }
  }
}

export function createHistoryRepository(): HistoryRepository {
  return new IndexedDbHistoryRepository();
}

export function deleteHistoryDatabase(): Promise<void> {
  return deleteDB(DATABASE_NAME);
}
