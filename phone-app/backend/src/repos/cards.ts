import type { Card } from '@phone-app/shared';
import type { Db } from '../db.js';

const CARD_COLUMNS = `
  id, owner_id, deck_id, source_text, source_url, content_type, enrichment_mode,
  translation, explanation, status, last_error,
  stability, difficulty, srs_state, step, last_reviewed_at, next_due_at,
  schema_version, created_at, updated_at
`;

export async function findCardById(db: Db, ownerId: string, cardId: string): Promise<Card | null> {
  const res = await db.query<Card>(
    `SELECT ${CARD_COLUMNS} FROM cards WHERE owner_id = $1 AND id = $2`,
    [ownerId, cardId],
  );
  return res.rows[0] ?? null;
}

export async function listCardsByDeck(db: Db, ownerId: string, deckId: string): Promise<Card[]> {
  const res = await db.query<Card>(
    `SELECT ${CARD_COLUMNS} FROM cards WHERE owner_id = $1 AND deck_id = $2 ORDER BY created_at`,
    [ownerId, deckId],
  );
  return res.rows;
}
