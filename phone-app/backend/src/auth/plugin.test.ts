import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { registerAuthPlugin } from './plugin.js';
import { registerTokenRoutes } from './token-routes.js';
import { issueJwt } from './jwt.js';
import { PAT_PREFIX } from './pat.js';
import type { Config } from '../config.js';

const TEST_CONFIG: Config = {
  NODE_ENV: 'test',
  PORT: 0,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgres://x',
  JWT_SIGNING_KEY: 'test-signing-key-must-be-at-least-32-chars-long',
  JWT_ISSUER: 'phone-app',
  JWT_AUDIENCE: 'phone-app',
  JWT_TTL_SECONDS: 3600,
  ANTHROPIC_MODEL: 'claude-sonnet-4-6',
  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_RP_NAME: 'Test',
  WEBAUTHN_ORIGIN: 'http://localhost',
  MAGIC_LINK_TTL_SECONDS: 900,
  MAGIC_LINK_BASE_URL: 'http://localhost/auth/verify',
  DAILY_LLM_BUDGET: 200,
  DAILY_EXTERNAL_BUDGET: 1000,
};

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

  return {
    rows,
    addExistingToken(userId: string, rawToken: string, opts: { revoked?: boolean } = {}) {
      const hash = createHash('sha256').update(rawToken, 'utf8').digest();
      rows.push({
        id: `pat-${++seq}`,
        user_id: userId,
        token_hash: hash,
        name: 'test',
        created_at: new Date().toISOString(),
        last_used_at: null,
        revoked_at: opts.revoked ? new Date().toISOString() : null,
      });
    },
    query: async (
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

      if (trimmed.startsWith('SELECT id, user_id, revoked_at')) {
        const [hash] = params as [Buffer];
        const row = rows.find((r) => bufEq(r.token_hash, hash));
        return {
          rows: row ? [{ id: row.id, user_id: row.user_id, revoked_at: row.revoked_at }] : [],
          rowCount: row ? 1 : 0,
        };
      }

      if (trimmed.startsWith('UPDATE personal_access_tokens')) {
        return { rows: [], rowCount: 0 };
      }

      if (trimmed.startsWith('SELECT id, user_id, name, created_at')) {
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

      throw new Error(`Unexpected SQL in plugin test: ${trimmed}`);
    },
  };
}

async function buildTestApp(deps: {
  config: Config;
  db: ReturnType<typeof makeFakeDb>;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('deps', { config: deps.config, db: deps.db as never });
  await app.register(cookie);
  await registerAuthPlugin(app);
  await registerTokenRoutes(app);
  // a JWT-or-PAT-protected endpoint to exercise the auth branches
  app.get('/protected', async (req) => ({
    userId: req.userId,
    method: req.authMethod,
  }));
  return app;
}

describe('auth plugin: JWT and PAT branches', () => {
  it('rejects requests without an Authorization header', async () => {
    const db = makeFakeDb();
    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const res = await app.inject({ method: 'GET', url: '/protected' });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  it('accepts Authorization: Bearer <jwt>', async () => {
    const db = makeFakeDb();
    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const jwt = await issueJwt(TEST_CONFIG, 'user-A');
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${jwt}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { userId: string; method: string };
    assert.equal(body.userId, 'user-A');
    assert.equal(body.method, 'jwt');
    await app.close();
  });

  it('accepts Authorization: Token <raw> for non-PAT-management endpoints', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addExistingToken('user-A', raw);

    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Token ${raw}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { userId: string; method: string };
    assert.equal(body.userId, 'user-A');
    assert.equal(body.method, 'pat');
    await app.close();
  });

  it('rejects an unknown PAT with HTTP 401', async () => {
    const db = makeFakeDb();
    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Token ${PAT_PREFIX}does-not-exist` },
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  it('rejects a revoked PAT with HTTP 401', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addExistingToken('user-A', raw, { revoked: true });

    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Token ${raw}` },
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  it('rejects PAT auth on POST /auth/tokens (PAT cannot manage PATs)', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addExistingToken('user-A', raw);

    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/tokens',
      headers: {
        authorization: `Token ${raw}`,
        'content-type': 'application/json',
      },
      payload: { name: 'attempted-escalation' },
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  it('rejects PAT auth on DELETE /auth/tokens/:id', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addExistingToken('user-A', raw);

    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/tokens/some-id',
      headers: { authorization: `Token ${raw}` },
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  it('accepts JWT auth on POST /auth/tokens and returns the raw token once', async () => {
    const db = makeFakeDb();
    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const jwt = await issueJwt(TEST_CONFIG, 'user-A');

    const res = await app.inject({
      method: 'POST',
      url: '/auth/tokens',
      headers: {
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
      },
      payload: { name: 'iPhone' },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json() as { id: string; name: string; raw_token: string };
    assert.match(body.raw_token, new RegExp(`^${PAT_PREFIX}`));
    assert.equal(body.name, 'iPhone');
    await app.close();
  });

  it('GET /auth/tokens via JWT returns metadata only', async () => {
    const db = makeFakeDb();
    db.addExistingToken('user-A', `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`);
    const app = await buildTestApp({ config: TEST_CONFIG, db });
    const jwt = await issueJwt(TEST_CONFIG, 'user-A');

    const res = await app.inject({
      method: 'GET',
      url: '/auth/tokens',
      headers: { authorization: `Bearer ${jwt}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { tokens: Array<Record<string, unknown>> };
    assert.equal(body.tokens.length, 1);
    assert.ok(!('raw_token' in body.tokens[0]!));
    assert.ok(!('token_hash' in body.tokens[0]!));
    await app.close();
  });
});
