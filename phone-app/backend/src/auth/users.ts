import type { Db } from '../db.js';

export interface User {
  id: string;
  email: string | null;
  display_name: string | null;
}

export type AuthProvider = 'apple' | 'google' | 'passkey' | 'magic_link';

export async function findOrCreateUserByAuthMethod(
  db: Db,
  params: {
    provider: AuthProvider;
    provider_subject: string;
    email?: string | null;
    display_name?: string | null;
  },
): Promise<User> {
  return await withTransaction(db, async (client) => {
    const existing = await client.query<{ user_id: string }>(
      `SELECT user_id FROM auth_methods WHERE provider = $1 AND provider_subject = $2`,
      [params.provider, params.provider_subject],
    );
    if (existing.rows.length > 0) {
      const userId = existing.rows[0]!.user_id;
      const user = await client.query<User>(
        `SELECT id, email, display_name FROM users WHERE id = $1`,
        [userId],
      );
      return user.rows[0]!;
    }

    let userId: string | null = null;
    if (params.email) {
      const matched = await client.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
        params.email,
      ]);
      if (matched.rows.length > 0) {
        userId = matched.rows[0]!.id;
      }
    }

    if (!userId) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id`,
        [params.email ?? null, params.display_name ?? null],
      );
      userId = created.rows[0]!.id;
    }

    await client.query(
      `INSERT INTO auth_methods (user_id, provider, provider_subject)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider, provider_subject) DO NOTHING`,
      [userId, params.provider, params.provider_subject],
    );

    const user = await client.query<User>(
      `SELECT id, email, display_name FROM users WHERE id = $1`,
      [userId],
    );
    return user.rows[0]!;
  });
}

export async function findUserById(db: Db, id: string): Promise<User | null> {
  const res = await db.query<User>(`SELECT id, email, display_name FROM users WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function withTransaction<T>(
  db: Db,
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
