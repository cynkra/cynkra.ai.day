import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { issueToken, listTokens, revokeToken } from './pat.js';

export async function registerTokenRoutes(app: FastifyInstance): Promise<void> {
  const { db } = app.deps;

  const issueBody = z.object({
    name: z.string().trim().min(1).max(100),
  });

  app.post('/auth/tokens', async (req, reply) => {
    const userId = app.requireJwt(req);
    const parsed = issueBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
      return;
    }
    const issued = await issueToken(db, userId, parsed.data.name);
    reply.code(201).send(issued);
  });

  app.get('/auth/tokens', async (req, reply) => {
    const userId = app.requireJwt(req);
    const tokens = await listTokens(db, userId);
    reply.send({
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        created_at: t.created_at,
        last_used_at: t.last_used_at,
        revoked_at: t.revoked_at,
      })),
    });
  });

  app.delete('/auth/tokens/:id', async (req, reply) => {
    const userId = app.requireJwt(req);
    const params = req.params as { id?: string };
    if (!params.id) {
      reply.code(400).send({ error: 'invalid_request' });
      return;
    }
    const revoked = await revokeToken(db, userId, params.id);
    if (!revoked) {
      reply.code(404).send({ error: 'not_found' });
      return;
    }
    reply.code(204).send();
  });
}
