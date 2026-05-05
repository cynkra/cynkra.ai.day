import { randomBytes, createHash } from 'node:crypto';
import type { Db } from '../db.js';

export interface PatRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface IssuedToken {
  id: string;
  name: string;
  raw_token: string;
  created_at: string;
}

export const PAT_PREFIX = 'pat_';

function hashToken(raw: string): Buffer {
  return createHash('sha256').update(raw, 'utf8').digest();
}

function generateRawToken(): string {
  return PAT_PREFIX + randomBytes(32).toString('base64url');
}

export async function issueToken(db: Db, userId: string, name: string): Promise<IssuedToken> {
  if (!name.trim()) {
    throw new Error('PAT name must be non-empty');
  }
  const raw = generateRawToken();
  const hash = hashToken(raw);
  const res = await db.query<{ id: string; created_at: string }>(
    `INSERT INTO personal_access_tokens (user_id, token_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [userId, hash, name.trim()],
  );
  const row = res.rows[0]!;
  return {
    id: row.id,
    name: name.trim(),
    raw_token: raw,
    created_at: row.created_at,
  };
}

export async function verifyToken(db: Db, raw: string): Promise<string | null> {
  if (!raw || typeof raw !== 'string') return null;
  const hash = hashToken(raw);
  const res = await db.query<{ id: string; user_id: string; revoked_at: string | null }>(
    `SELECT id, user_id, revoked_at FROM personal_access_tokens WHERE token_hash = $1`,
    [hash],
  );
  const row = res.rows[0];
  if (!row || row.revoked_at !== null) return null;

  void db
    .query(`UPDATE personal_access_tokens SET last_used_at = now() WHERE id = $1`, [row.id])
    .catch(() => {});

  return row.user_id;
}

export async function revokeToken(db: Db, userId: string, tokenId: string): Promise<boolean> {
  const res = await db.query(
    `UPDATE personal_access_tokens
     SET revoked_at = COALESCE(revoked_at, now())
     WHERE id = $1 AND user_id = $2`,
    [tokenId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listTokens(db: Db, userId: string): Promise<PatRow[]> {
  const res = await db.query<PatRow>(
    `SELECT id, user_id, name, created_at, last_used_at, revoked_at
     FROM personal_access_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return res.rows;
}
