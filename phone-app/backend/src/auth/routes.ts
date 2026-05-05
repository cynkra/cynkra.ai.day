import { randomBytes, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { issueJwt } from './jwt.js';
import { findOrCreateUserByAuthMethod } from './users.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.deps;

  // 2.4 Sign in with Apple — stubbed: decodes the identity token's `sub`
  // without verifying Apple's signature. Real verification (JWKS fetch +
  // signature check) is deferred; the route shape and DB linkage are real.
  const appleBody = z.object({
    identity_token: z.string().min(1),
    email: z.string().email().optional(),
  });

  app.post('/auth/apple', async (req, reply) => {
    const parsed = appleBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
      return;
    }
    const sub = decodeJwtSubUnsafe(parsed.data.identity_token);
    if (!sub) {
      reply.code(401).send({ error: 'invalid_identity_token' });
      return;
    }
    const user = await findOrCreateUserByAuthMethod(db, {
      provider: 'apple',
      provider_subject: sub,
      email: parsed.data.email ?? null,
    });
    const token = await issueJwt(app.deps.config, user.id);
    reply.send({ token, user });
  });

  // 2.5 Google OAuth — stubbed start/callback. Real PKCE exchange is
  // deferred; in dev we accept ?dev_subject=<id> on /auth/google/callback
  // to mint a session for testing.
  app.get('/auth/google/start', async (req, reply) => {
    const state = randomBytes(16).toString('hex');
    reply.send({
      authorization_url: `https://accounts.google.com/o/oauth2/v2/auth?stub=true&state=${state}`,
      state,
      stub: true,
    });
  });

  app.get('/auth/google/callback', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const subject = query.dev_subject;
    if (!subject) {
      reply.code(501).send({ error: 'google_oauth_not_implemented' });
      return;
    }
    const user = await findOrCreateUserByAuthMethod(db, {
      provider: 'google',
      provider_subject: subject,
      email: query.dev_email ?? null,
    });
    const token = await issueJwt(app.deps.config, user.id);
    reply.send({ token, user });
  });

  // 2.6 Passkey/WebAuthn — stubbed. Real challenge/credential handling is
  // deferred; the route shapes match @simplewebauthn/server's contract.
  app.post('/auth/passkey/register/options', async (req, reply) => {
    const body = (req.body ?? {}) as { user_handle?: string };
    reply.send({
      challenge: randomBytes(32).toString('base64url'),
      rp: { id: app.deps.config.WEBAUTHN_RP_ID, name: app.deps.config.WEBAUTHN_RP_NAME },
      user: {
        id: body.user_handle ?? randomBytes(16).toString('base64url'),
        name: body.user_handle ?? 'user',
        displayName: body.user_handle ?? 'user',
      },
      stub: true,
    });
  });

  app.post('/auth/passkey/register/verify', async (req, reply) => {
    const body = (req.body ?? {}) as { user_handle?: string; credential_id?: string };
    if (!body.user_handle || !body.credential_id) {
      reply.code(400).send({ error: 'invalid_request' });
      return;
    }
    const user = await findOrCreateUserByAuthMethod(db, {
      provider: 'passkey',
      provider_subject: body.user_handle,
    });
    const token = await issueJwt(app.deps.config, user.id);
    reply.send({ token, user, stub: true });
  });

  app.post('/auth/passkey/login/options', async (_req, reply) => {
    reply.send({
      challenge: randomBytes(32).toString('base64url'),
      rpId: app.deps.config.WEBAUTHN_RP_ID,
      stub: true,
    });
  });

  app.post('/auth/passkey/login/verify', async (req, reply) => {
    const body = (req.body ?? {}) as { user_handle?: string };
    if (!body.user_handle) {
      reply.code(400).send({ error: 'invalid_request' });
      return;
    }
    const user = await findOrCreateUserByAuthMethod(db, {
      provider: 'passkey',
      provider_subject: body.user_handle,
    });
    const token = await issueJwt(app.deps.config, user.id);
    reply.send({ token, user, stub: true });
  });

  // 2.7 Magic-link fallback. Stub mailer: the unhashed token is logged
  // and returned in the dev response so the developer can complete the flow.
  const linkBody = z.object({ email: z.string().email() });

  app.post('/auth/request-link', async (req, reply) => {
    const parsed = linkBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
      return;
    }
    const user = await findOrCreateUserByAuthMethod(db, {
      provider: 'magic_link',
      provider_subject: parsed.data.email,
      email: parsed.data.email,
    });
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + app.deps.config.MAGIC_LINK_TTL_SECONDS * 1000);
    await db.query(
      `INSERT INTO magic_link_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );
    const link = `${app.deps.config.MAGIC_LINK_BASE_URL}?token=${rawToken}`;
    app.log.info({ email: parsed.data.email, link }, 'magic-link issued (stub mailer)');
    reply.send({ ok: true, ...(app.deps.config.NODE_ENV !== 'production' ? { link } : {}) });
  });

  app.get('/auth/verify', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    if (!query.token) {
      reply.code(400).send({ error: 'invalid_request' });
      return;
    }
    const tokenHash = sha256(query.token);
    const found = await db.query<{
      id: string;
      user_id: string;
      expires_at: Date;
      consumed_at: Date | null;
    }>(`SELECT id, user_id, expires_at, consumed_at FROM magic_link_tokens WHERE token_hash = $1`, [
      tokenHash,
    ]);
    const row = found.rows[0];
    if (!row || row.consumed_at !== null || row.expires_at.getTime() < Date.now()) {
      reply.code(401).send({ error: 'invalid_or_expired_token' });
      return;
    }
    await db.query(`UPDATE magic_link_tokens SET consumed_at = now() WHERE id = $1`, [row.id]);
    const jwt = await issueJwt(app.deps.config, row.user_id);
    reply.send({ token: jwt });
  });
}

function decodeJwtSubUnsafe(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadBuf = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadBuf) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function sha256(input: string): Buffer {
  return createHash('sha256').update(input, 'utf8').digest();
}
