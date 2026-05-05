import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SCHEMA_VERSION, ENRICHMENT_MODES, CONTENT_TYPES } from '@phone-app/shared';
import type { Db } from '../db.js';
import { withTransaction } from '../auth/users.js';

const createBody = z.object({
  id: z.string().uuid(),
  deck_id: z.string().uuid().optional(),
  source_text: z.string().min(1),
  source_url: z.string().url().nullish(),
  content_type: z.enum(CONTENT_TYPES).default('text'),
  enrichment_mode: z.enum(ENRICHMENT_MODES).optional(),
  translation: z.string().nullish(),
  explanation: z.string().nullish(),
  schema_version: z.number().int(),
});

export async function registerCardsRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.deps;

  app.post('/cards', async (req, reply) => {
    const userId = app.requireAuth(req);

    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
      return;
    }
    const input = parsed.data;

    if (input.schema_version !== SCHEMA_VERSION) {
      reply.code(400).send({ error: 'unsupported_schema_version' });
      return;
    }

    const result = await withTransaction(db, async (client) => {
      // Idempotent retry: if a card with this id already exists for this owner, return it.
      const existing = await client.query<CardRow>(
        `SELECT ${CARD_COLUMNS} FROM cards WHERE id = $1 AND owner_id = $2`,
        [input.id, userId],
      );
      if (existing.rows.length > 0) {
        return { card: existing.rows[0]!, created: false };
      }

      const deckId = input.deck_id ?? (await ensureInboxDeck(client, userId));

      const deckRes = await client.query<{ default_enrichment_mode: string }>(
        `SELECT default_enrichment_mode FROM decks WHERE id = $1 AND owner_id = $2`,
        [deckId, userId],
      );
      const deck = deckRes.rows[0];
      if (!deck) {
        const err = new Error('deck_not_found') as Error & { httpCode: number };
        err.httpCode = 404;
        throw err;
      }

      const mode = input.enrichment_mode ?? deck.default_enrichment_mode;

      if (
        mode === 'external' &&
        (input.content_type === 'formula' || input.content_type === 'code')
      ) {
        const err = new Error('external_mode_unsupported_for_content_type') as Error & {
          httpCode: number;
        };
        err.httpCode = 400;
        throw err;
      }

      const status = mode === 'manual' ? 'ready' : 'enriching';

      const inserted = await client.query<CardRow>(
        `INSERT INTO cards (
          id, owner_id, deck_id, source_text, source_url, content_type,
          enrichment_mode, translation, explanation, status, schema_version
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        RETURNING ${CARD_COLUMNS}`,
        [
          input.id,
          userId,
          deckId,
          input.source_text,
          input.source_url ?? null,
          input.content_type,
          mode,
          input.translation ?? null,
          input.explanation ?? null,
          status,
          input.schema_version,
        ],
      );
      return { card: inserted.rows[0]!, created: true };
    }).catch((err: Error & { httpCode?: number; code?: string }) => {
      if (err.httpCode) {
        reply.code(err.httpCode).send({ error: err.message });
        return null;
      }
      throw err;
    });

    if (!result) return;
    reply.code(result.created ? 201 : 200).send(result.card);
  });
}

const CARD_COLUMNS = `
  id, owner_id, deck_id, source_text, source_url, content_type, enrichment_mode,
  translation, explanation, status, last_error, stability, difficulty, srs_state,
  step, last_reviewed_at, next_due_at, schema_version, created_at, updated_at
`;

interface CardRow {
  id: string;
  owner_id: string;
  deck_id: string;
}

async function ensureInboxDeck(client: import('pg').PoolClient, userId: string): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM decks WHERE owner_id = $1 AND name = 'Inbox'`,
    [userId],
  );
  if (existing.rows.length > 0) {
    return existing.rows[0]!.id;
  }
  const created = await client.query<{ id: string }>(
    `INSERT INTO decks (id, owner_id, name, default_enrichment_mode, schema_version)
     VALUES (gen_random_uuid(), $1, 'Inbox', 'llm', $2)
     RETURNING id`,
    [userId, SCHEMA_VERSION],
  );
  return created.rows[0]!.id;
}

// Re-export for tests
export { ensureInboxDeck };

// Cast Db to a typed wrapper that exposes withTransaction's signature
// (the helper itself is imported above but TypeScript needs the Db type explicit
// here to keep the file self-contained for downstream tests).
export type CardsDb = Db;
