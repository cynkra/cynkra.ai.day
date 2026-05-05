import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { verifyJwt } from './jwt.js';
import { verifyToken as verifyPat } from './pat.js';

export type AuthMethod = 'jwt' | 'pat';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null;
    authMethod: AuthMethod | null;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest) => string;
    requireJwt: (req: FastifyRequest) => string;
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

function isPublic(url: string): boolean {
  return PUBLIC_PATHS.has(url);
}

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  app.decorateRequest('userId', null);
  app.decorateRequest('authMethod', null);

  app.decorate('requireAuth', (req: FastifyRequest): string => {
    if (!req.userId) {
      const err = new Error('unauthenticated') as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }
    return req.userId;
  });

  app.decorate('requireJwt', (req: FastifyRequest): string => {
    if (!req.userId || req.authMethod !== 'jwt') {
      const err = new Error('jwt_required') as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }
    return req.userId;
  });

  app.addHook('onRequest', async (req, reply) => {
    const url = req.routeOptions.url ?? req.url;
    if (isPublic(url)) {
      return;
    }

    const header = req.headers.authorization;
    let userId: string | null = null;
    let method: AuthMethod | null = null;

    if (header?.startsWith('Bearer ')) {
      const jwt = header.slice('Bearer '.length).trim();
      try {
        const claims = await verifyJwt(app.deps.config, jwt);
        userId = claims.sub;
        method = 'jwt';
      } catch {
        // fall through to 401
      }
    } else if (header?.startsWith('Token ')) {
      const raw = header.slice('Token '.length).trim();
      const resolved = await verifyPat(app.deps.db, raw);
      if (resolved) {
        userId = resolved;
        method = 'pat';
      }
    } else if (req.cookies?.session) {
      try {
        const claims = await verifyJwt(app.deps.config, req.cookies.session);
        userId = claims.sub;
        method = 'jwt';
      } catch {
        // fall through to 401
      }
    }

    if (!userId) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }

    req.userId = userId;
    req.authMethod = method;
  });
}

export const registerAuthPlugin = fp(authPluginImpl, { name: 'auth-plugin' });
