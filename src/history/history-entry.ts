export type HistoryEntry = {
  id: string;
  selectedText: string;
  sourceLanguage?: string;
  translation?: string;
  explanation?: string;
  pageTitle?: string;
  pageUrl?: string;
  providerId?: string;
  model?: string;
  createdAt: number;
  favorite: boolean;
};

export type NewHistoryEntry = Omit<HistoryEntry, 'id'> & { id?: string };

export type HistoryQuery = {
  query?: string;
  favoritesOnly?: boolean;
  limit?: number;
};

export interface HistoryRepository {
  add(entry: NewHistoryEntry, retentionLimit?: number): Promise<HistoryEntry>;
  list(query?: HistoryQuery): Promise<HistoryEntry[]>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
