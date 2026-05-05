import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, verifyToken, revokeToken, listTokens, PAT_PREFIX } from './pat.js';

interface FakeRow {
  id: string;
  user_id: string;
  token_hash: Buffer;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function makeFakeDb() {
  const rows: FakeRow[] = [];
  let seq = 0;

  function bufEq(a: Buffer, b: Buffer): boolean {
    return a.length === b.length && a.equals(b);
  }

  const query = async (
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rows: unknown[]; rowCount: number }> => {
    const trimmed = sql.trim();

    if (trimmed.startsWith('INSERT INTO personal_access_tokens')) {
      const [user_id, token_hash, name] = params as [string, Buffer, string];
      const id = `pat-${++seq}`;
      const created_at = new Date().toISOString();
      rows.push({
        id,
        user_id,
        token_hash,
        name,
        created_at,
        last_used_at: null,
        revoked_at: null,
      });
      return { rows: [{ id, created_at }], rowCount: 1 };
    }

    if (trimmed.startsWith('SELECT id, user_id, revoked_at FROM personal_access_tokens')) {
      const [hash] = params as [Buffer];
      const row = rows.find((r) => bufEq(r.token_hash, hash));
      return {
        rows: row ? [{ id: row.id, user_id: row.user_id, revoked_at: row.revoked_at }] : [],
        rowCount: row ? 1 : 0,
      };
    }

    if (trimmed.startsWith('UPDATE personal_access_tokens') && trimmed.includes('last_used_at')) {
      const [id] = params as [string];
      const row = rows.find((r) => r.id === id);
      if (row) row.last_used_at = new Date().toISOString();
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    if (trimmed.startsWith('UPDATE personal_access_tokens') && trimmed.includes('revoked_at')) {
      const [id, user_id] = params as [string, string];
      const row = rows.find((r) => r.id === id && r.user_id === user_id);
      if (row && row.revoked_at === null) row.revoked_at = new Date().toISOString();
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    if (trimmed.startsWith('SELECT id, user_id, name, created_at, last_used_at, revoked_at')) {
      const [user_id] = params as [string];
      const matching = rows
        .filter((r) => r.user_id === user_id)
        .map((r) => ({
          id: r.id,
          user_id: r.user_id,
          name: r.name,
          created_at: r.created_at,
          last_used_at: r.last_used_at,
          revoked_at: r.revoked_at,
        }));
      return { rows: matching, rowCount: matching.length };
    }

    throw new Error(`Unexpected SQL: ${trimmed}`);
  };

  return { rows, query: query as unknown as never };
}

describe('personal access tokens', () => {
  let db: ReturnType<typeof makeFakeDb>;

  beforeEach(() => {
    db = makeFakeDb();
  });

  it('issuance returns the raw token exactly once and stores only its hash', async () => {
    const issued = await issueToken(db as never, 'user-A', 'iPhone');

    assert.match(issued.raw_token, new RegExp(`^${PAT_PREFIX}`));
    assert.equal(issued.name, 'iPhone');
    assert.equal(typeof issued.id, 'string');

    const stored = db.rows[0]!;
    assert.notEqual(
      stored.token_hash.toString('utf8'),
      issued.raw_token,
      'raw token must NOT be stored',
    );
    assert.equal(stored.token_hash.length, 32, 'SHA-256 produces 32 raw bytes');
    assert.equal(stored.user_id, 'user-A');
    assert.equal(stored.revoked_at, null);
  });

  it('issuance trims the name and rejects empty names', async () => {
    const issued = await issueToken(db as never, 'user-A', '  iPad  ');
    assert.equal(issued.name, 'iPad');

    await assert.rejects(() => issueToken(db as never, 'user-A', '   '));
  });

  it('verifyToken accepts a valid token and resolves to the owner', async () => {
    const issued = await issueToken(db as never, 'user-A', 'iPhone');
    const userId = await verifyToken(db as never, issued.raw_token);
    assert.equal(userId, 'user-A');
  });

  it('verifyToken updates last_used_at on success (best-effort)', async () => {
    const issued = await issueToken(db as never, 'user-A', 'iPhone');
    await verifyToken(db as never, issued.raw_token);
    // Allow the fire-and-forget update to flush.
    await new Promise((r) => setImmediate(r));
    assert.ok(db.rows[0]!.last_used_at, 'last_used_at should be set after verification');
  });

  it('verifyToken rejects a revoked token', async () => {
    const issued = await issueToken(db as never, 'user-A', 'iPhone');
    await revokeToken(db as never, 'user-A', issued.id);

    const userId = await verifyToken(db as never, issued.raw_token);
    assert.equal(userId, null);
  });

  it('verifyToken rejects an unknown token', async () => {
    const userId = await verifyToken(db as never, `${PAT_PREFIX}not-real`);
    assert.equal(userId, null);
  });

  it('verifyToken rejects empty/garbage input without throwing', async () => {
    assert.equal(await verifyToken(db as never, ''), null);
    assert.equal(await verifyToken(db as never, 'plain-no-prefix'), null);
  });

  it('revokeToken is idempotent and scoped to the owner', async () => {
    const issued = await issueToken(db as never, 'user-A', 'iPhone');

    assert.equal(await revokeToken(db as never, 'user-A', issued.id), true);
    assert.equal(await revokeToken(db as never, 'user-A', issued.id), true); // still affects row
    // Cross-user revoke does NOT affect the row
    assert.equal(await revokeToken(db as never, 'user-B', issued.id), false);
  });

  it('listTokens returns metadata only, never raw tokens', async () => {
    await issueToken(db as never, 'user-A', 'iPhone');
    await issueToken(db as never, 'user-A', 'iPad');

    const tokens = await listTokens(db as never, 'user-A');
    assert.equal(tokens.length, 2);
    for (const t of tokens) {
      assert.ok('id' in t);
      assert.ok('name' in t);
      assert.ok('created_at' in t);
      assert.ok(!('raw_token' in t), 'raw token must NEVER appear in listTokens output');
      assert.ok(!('token_hash' in t), 'token hash must NEVER appear in listTokens output');
    }
  });

  it('listTokens scopes to the owner', async () => {
    await issueToken(db as never, 'user-A', 'A1');
    await issueToken(db as never, 'user-B', 'B1');

    const aTokens = await listTokens(db as never, 'user-A');
    assert.equal(aTokens.length, 1);
    assert.equal(aTokens[0]!.user_id, 'user-A');
  });
});
