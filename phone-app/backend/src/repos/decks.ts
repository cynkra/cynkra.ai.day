import type { Deck } from '@phone-app/shared';
import type { Db } from '../db.js';

const DECK_COLUMNS = `
  id, owner_id, name, topic, target_language, explanation_style,
  default_enrichment_mode, schema_version,
  created_at, updated_at
`;

export async function findDeckById(db: Db, ownerId: string, deckId: string): Promise<Deck | null> {
  const res = await db.query<Deck>(
    `SELECT ${DECK_COLUMNS} FROM decks WHERE owner_id = $1 AND id = $2`,
    [ownerId, deckId],
  );
  return res.rows[0] ?? null;
}

export async function listDecksByOwner(db: Db, ownerId: string): Promise<Deck[]> {
  const res = await db.query<Deck>(
    `SELECT ${DECK_COLUMNS} FROM decks WHERE owner_id = $1 ORDER BY topic NULLS LAST, name`,
    [ownerId],
  );
  return res.rows;
}
