import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { registerAuthPlugin } from '../auth/plugin.js';
import { registerCardsRoutes } from './cards.js';
import { PAT_PREFIX } from '../auth/pat.js';
import { SCHEMA_VERSION } from '@phone-app/shared';
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

interface PatRow {
  id: string;
  user_id: string;
  token_hash: Buffer;
  revoked_at: string | null;
}
interface DeckRow {
  id: string;
  owner_id: string;
  name: string;
  default_enrichment_mode: string;
}
interface CardRow {
  id: string;
  owner_id: string;
  deck_id: string;
  source_text: string;
  source_url: string | null;
  content_type: string;
  enrichment_mode: string;
  translation: string | null;
  explanation: string | null;
  status: string;
  last_error: string | null;
  stability: number | null;
  difficulty: number | null;
  srs_state: string;
  step: number;
  last_reviewed_at: string | null;
  next_due_at: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

function bufEq(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.equals(b);
}

function makeFakeDb() {
  const pats: PatRow[] = [];
  const decks: DeckRow[] = [];
  const cards: CardRow[] = [];
  let seq = 0;

  function exec(sql: string, params: unknown[] = []) {
    const trimmed = sql.trim();

    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }

    // PAT verify
    if (trimmed.startsWith('SELECT id, user_id, revoked_at FROM personal_access_tokens')) {
      const [hash] = params as [Buffer];
      const row = pats.find((r) => bufEq(r.token_hash, hash));
      return {
        rows: row ? [{ id: row.id, user_id: row.user_id, revoked_at: row.revoked_at }] : [],
        rowCount: row ? 1 : 0,
      };
    }
    if (trimmed.startsWith('UPDATE personal_access_tokens')) {
      return { rows: [], rowCount: 0 };
    }

    // Idempotent card lookup
    if (
      trimmed.startsWith('SELECT') &&
      trimmed.includes('FROM cards WHERE id = $1 AND owner_id = $2')
    ) {
      const [id, owner_id] = params as [string, string];
      const row = cards.find((c) => c.id === id && c.owner_id === owner_id);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    // Inbox auto-create
    if (trimmed.startsWith("SELECT id FROM decks WHERE owner_id = $1 AND name = 'Inbox'")) {
      const [owner_id] = params as [string];
      const row = decks.find((d) => d.owner_id === owner_id && d.name === 'Inbox');
      return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
    }
    if (trimmed.startsWith('INSERT INTO decks')) {
      const [owner_id, schema_version] = params as [string, number];
      const id = randomUUID();
      decks.push({ id, owner_id, name: 'Inbox', default_enrichment_mode: 'llm' });
      void schema_version;
      return { rows: [{ id }], rowCount: 1 };
    }

    // Deck lookup for default_enrichment_mode
    if (trimmed.startsWith('SELECT default_enrichment_mode FROM decks')) {
      const [deck_id, owner_id] = params as [string, string];
      const row = decks.find((d) => d.id === deck_id && d.owner_id === owner_id);
      return {
        rows: row ? [{ default_enrichment_mode: row.default_enrichment_mode }] : [],
        rowCount: row ? 1 : 0,
      };
    }

    // Card insert
    if (trimmed.startsWith('INSERT INTO cards')) {
      const [
        id,
        owner_id,
        deck_id,
        source_text,
        source_url,
        content_type,
        enrichment_mode,
        translation,
        explanation,
        status,
        schema_version,
      ] = params as [
        string,
        string,
        string,
        string,
        string | null,
        string,
        string,
        string | null,
        string | null,
        string,
        number,
      ];
      const now = new Date().toISOString();
      const row: CardRow = {
        id,
        owner_id,
        deck_id,
        source_text,
        source_url,
        content_type,
        enrichment_mode,
        translation,
        explanation,
        status,
        last_error: null,
        stability: null,
        difficulty: null,
        srs_state: 'new',
        step: 0,
        last_reviewed_at: null,
        next_due_at: null,
        schema_version,
        created_at: now,
        updated_at: now,
      };
      cards.push(row);
      return { rows: [row], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${trimmed}`);
  }

  const fakeClient = {
    query: async (sql: string, params: unknown[] = []) => exec(sql, params),
    release: () => {},
  };

  return {
    pats,
    decks,
    cards,
    addPat(userId: string, raw: string) {
      const hash = createHash('sha256').update(raw, 'utf8').digest();
      pats.push({ id: `pat-${++seq}`, user_id: userId, token_hash: hash, revoked_at: null });
    },
    addDeck(deck: Omit<DeckRow, 'id'> & { id?: string }): DeckRow {
      const row: DeckRow = { ...deck, id: deck.id ?? randomUUID() };
      decks.push(row);
      return row;
    },
    query: async (sql: string, params: unknown[] = []) => exec(sql, params),
    connect: async () => fakeClient,
  };
}

async function buildTestApp(db: ReturnType<typeof makeFakeDb>): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('deps', { config: TEST_CONFIG, db: db as never });
  await app.register(cookie);
  await registerAuthPlugin(app);
  await registerCardsRoutes(app);
  return app;
}

describe('POST /cards via PAT', () => {
  it('creates a card scoped to the PAT owner', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addPat('user-A', raw);

    const app = await buildTestApp(db);
    const cardId = randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: '/cards',
      headers: { authorization: `Token ${raw}`, 'content-type': 'application/json' },
      payload: {
        id: cardId,
        source_text: 'Schadenfreude',
        content_type: 'text',
        schema_version: SCHEMA_VERSION,
      },
    });

    assert.equal(res.statusCode, 201, res.body);
    const body = res.json() as { id: string; owner_id: string; deck_id: string };
    assert.equal(body.id, cardId);
    assert.equal(body.owner_id, 'user-A');
    assert.equal(db.cards.length, 1);
    assert.equal(db.cards[0]!.owner_id, 'user-A');
    await app.close();
  });

  it('auto-creates the Inbox deck on first capture', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addPat('user-A', raw);

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/cards',
      headers: { authorization: `Token ${raw}`, 'content-type': 'application/json' },
      payload: {
        id: randomUUID(),
        source_text: 'foo',
        content_type: 'text',
        schema_version: SCHEMA_VERSION,
      },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(db.decks.length, 1);
    assert.equal(db.decks[0]!.name, 'Inbox');
    assert.equal(db.decks[0]!.owner_id, 'user-A');
    await app.close();
  });

  it('returns the same card on idempotent retry', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addPat('user-A', raw);

    const app = await buildTestApp(db);
    const cardId = randomUUID();
    const payload = {
      id: cardId,
      source_text: 'Schadenfreude',
      content_type: 'text',
      schema_version: SCHEMA_VERSION,
    };
    const headers = { authorization: `Token ${raw}`, 'content-type': 'application/json' };

    const first = await app.inject({ method: 'POST', url: '/cards', headers, payload });
    const second = await app.inject({ method: 'POST', url: '/cards', headers, payload });

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 200);
    assert.equal(first.json().id, second.json().id);
    assert.equal(db.cards.length, 1);
    await app.close();
  });

  it('rejects unsupported schema_version', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addPat('user-A', raw);

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/cards',
      headers: { authorization: `Token ${raw}`, 'content-type': 'application/json' },
      payload: {
        id: randomUUID(),
        source_text: 'foo',
        content_type: 'text',
        schema_version: 999,
      },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'unsupported_schema_version');
    assert.equal(db.cards.length, 0);
    await app.close();
  });

  it('rejects external mode for content_type=code', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addPat('user-A', raw);
    const deck = db.addDeck({
      owner_id: 'user-A',
      name: 'Code',
      default_enrichment_mode: 'llm',
    });

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/cards',
      headers: { authorization: `Token ${raw}`, 'content-type': 'application/json' },
      payload: {
        id: randomUUID(),
        deck_id: deck.id,
        source_text: 'console.log("hi")',
        content_type: 'code',
        enrichment_mode: 'external',
        schema_version: SCHEMA_VERSION,
      },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'external_mode_unsupported_for_content_type');
    assert.equal(db.cards.length, 0);
    await app.close();
  });

  it('rejects external mode for content_type=formula', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addPat('user-A', raw);
    const deck = db.addDeck({
      owner_id: 'user-A',
      name: 'Formulas',
      default_enrichment_mode: 'llm',
    });

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/cards',
      headers: { authorization: `Token ${raw}`, 'content-type': 'application/json' },
      payload: {
        id: randomUUID(),
        deck_id: deck.id,
        source_text: '$\\hat{\\beta}$',
        content_type: 'formula',
        enrichment_mode: 'external',
        schema_version: SCHEMA_VERSION,
      },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'external_mode_unsupported_for_content_type');
    await app.close();
  });

  it('manual mode produces a ready card immediately (no enrichment pending)', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addPat('user-A', raw);

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/cards',
      headers: { authorization: `Token ${raw}`, 'content-type': 'application/json' },
      payload: {
        id: randomUUID(),
        source_text: 'Schadenfreude',
        content_type: 'text',
        enrichment_mode: 'manual',
        translation: 'joy at another’s misfortune',
        schema_version: SCHEMA_VERSION,
      },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.status, 'ready');
    assert.equal(body.enrichment_mode, 'manual');
    await app.close();
  });

  it('llm mode lands the card in enriching status', async () => {
    const db = makeFakeDb();
    const raw = `${PAT_PREFIX}${randomBytes(32).toString('base64url')}`;
    db.addPat('user-A', raw);

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/cards',
      headers: { authorization: `Token ${raw}`, 'content-type': 'application/json' },
      payload: {
        id: randomUUID(),
        source_text: 'foo',
        content_type: 'text',
        enrichment_mode: 'llm',
        schema_version: SCHEMA_VERSION,
      },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().status, 'enriching');
    await app.close();
  });
});
