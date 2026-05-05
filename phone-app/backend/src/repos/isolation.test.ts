import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findCardById, listCardsByDeck } from './cards.js';
import { findDeckById, listDecksByOwner } from './decks.js';

type FakeDb = {
  query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>;
  calls: Array<{ sql: string; params: unknown[] }>;
};

function fakeDb(rows: unknown[] = []): FakeDb {
  const calls: FakeDb['calls'] = [];
  return {
    calls,
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows };
    },
  };
}

describe('per-user isolation: every cards/decks query is scoped by owner_id', () => {
  it('findCardById passes owner_id as the first parameter', async () => {
    const db = fakeDb([]);
    await findCardById(db as never, 'user-A', 'card-1');
    assert.equal(db.calls.length, 1);
    assert.match(db.calls[0]!.sql, /owner_id\s*=\s*\$1/);
    assert.deepEqual(db.calls[0]!.params, ['user-A', 'card-1']);
  });

  it('listCardsByDeck filters by owner_id and deck_id', async () => {
    const db = fakeDb([]);
    await listCardsByDeck(db as never, 'user-A', 'deck-1');
    assert.match(db.calls[0]!.sql, /owner_id\s*=\s*\$1/);
    assert.match(db.calls[0]!.sql, /deck_id\s*=\s*\$2/);
  });

  it('findDeckById filters by owner_id', async () => {
    const db = fakeDb([]);
    await findDeckById(db as never, 'user-A', 'deck-1');
    assert.match(db.calls[0]!.sql, /owner_id\s*=\s*\$1/);
    assert.deepEqual(db.calls[0]!.params, ['user-A', 'deck-1']);
  });

  it('listDecksByOwner filters by owner_id', async () => {
    const db = fakeDb([]);
    await listDecksByOwner(db as never, 'user-A');
    assert.match(db.calls[0]!.sql, /owner_id\s*=\s*\$1/);
  });

  it('cross-user lookup returns null (route layer SHALL translate this to HTTP 404)', async () => {
    const db = fakeDb([]); // no rows for user-B's card when queried as user-A
    const result = await findCardById(db as never, 'user-A', 'user-bs-card');
    assert.equal(result, null);
  });
});
