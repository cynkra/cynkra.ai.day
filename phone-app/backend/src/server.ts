import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import type { Config } from './config.js';
import { createDb, type Db } from './db.js';
import { registerAuthPlugin } from './auth/plugin.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerTokenRoutes } from './auth/token-routes.js';
import { registerCardsRoutes } from './routes/cards.js';

export interface AppDeps {
  config: Config;
  db: Db;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
}

export async function buildServer(config: Config, db?: Db): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    },
    trustProxy: true,
  });

  const resolvedDb = db ?? createDb(config);

  app.decorate('deps', { config, db: resolvedDb });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await registerAuthPlugin(app);

  app.get('/health', async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerTokenRoutes(app);
  await registerCardsRoutes(app);

  return app;
}
