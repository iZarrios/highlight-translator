import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createHistoryRepository, deleteHistoryDatabase } from '@/history';

describe('history repository', () => {
  afterEach(() => deleteHistoryDatabase());

  it('stores newest entries first and searches their text', async () => {
    const history = createHistoryRepository();
    await history.add({
      selectedText: 'bonjour',
      translation: 'hello',
      explanation: 'A French greeting.',
      createdAt: 100,
      favorite: false,
    });
    await history.add({
      selectedText: 'au revoir',
      translation: 'goodbye',
      explanation: 'A French farewell.',
      createdAt: 200,
      favorite: false,
    });

    expect((await history.list()).map((entry) => entry.selectedText)).toEqual([
      'au revoir',
      'bonjour',
    ]);
    expect(
      (await history.list({ query: 'greeting' })).map(
        (entry) => entry.selectedText,
      ),
    ).toEqual(['bonjour']);
  });

  it('enforces the configured retention limit without deleting favorites', async () => {
    const history = createHistoryRepository();
    await history.add(
      { selectedText: 'keep', createdAt: 1, favorite: true },
      2,
    );
    await history.add(
      { selectedText: 'drop', createdAt: 2, favorite: false },
      2,
    );
    await history.add(
      { selectedText: 'new', createdAt: 3, favorite: false },
      2,
    );

    expect((await history.list()).map((entry) => entry.selectedText)).toEqual([
      'new',
      'keep',
    ]);
  });
});
