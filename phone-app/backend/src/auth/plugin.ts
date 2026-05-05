import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { verifyJwt } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest) => string;
  }
}

const PUBLIC_PATHS = new Set([
  '/health',
  '/auth/apple',
  '/auth/google/start',
  '/auth/google/callback',
  '/auth/passkey/register/options',
  '/auth/passkey/register/verify',
  '/auth/passkey/login/options',
  '/auth/passkey/login/verify',
  '/auth/request-link',
  '/auth/verify',
]);

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  app.decorateRequest('userId', null);

  app.decorate('requireAuth', (req: FastifyRequest): string => {
    if (!req.userId) {
      const err = new Error('unauthenticated') as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }
    return req.userId;
  });

  app.addHook('onRequest', async (req, reply) => {
    const url = req.routeOptions.url ?? req.url;
    if (PUBLIC_PATHS.has(url) || url.startsWith('/auth/')) {
      return;
    }

    const header = req.headers.authorization;
    const cookie = req.cookies?.session;
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : (cookie ?? null);

    if (!token) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    try {
      const claims = await verifyJwt(app.deps.config, token);
      req.userId = claims.sub;
    } catch {
      reply.code(401).send({ error: 'unauthenticated' });
    }
  });
}

export const registerAuthPlugin = fp(authPluginImpl, { name: 'auth-plugin' });
