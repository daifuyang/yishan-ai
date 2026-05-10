import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getMessages, restoreMessages, softDeleteMessagesAfter } from '../stores/message-store.js';
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  updateSessionPin,
  updateSessionTitle,
} from '../stores/session-store.js';

const CreateSessionSchema = z.object({
  model: z.string(),
  title: z.string().optional(),
});

const UpdateSessionSchema = z.object({
  title: z.string().optional(),
  isPinned: z.boolean().optional(),
});

type CreateSessionBody = z.infer<typeof CreateSessionSchema>;
type UpdateSessionBody = z.infer<typeof UpdateSessionSchema>;

const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/sessions', async () => {
    return listSessions();
  });

  fastify.post<{ Body: CreateSessionBody }>(
    '/api/sessions',
    async (request: FastifyRequest<{ Body: CreateSessionBody }>) => {
      const body = request.body;
      return createSession(body.model, body.title);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/api/sessions/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, _reply: FastifyReply) => {
      const { id } = request.params;
      const session = await getSession(id);
      if (!session) {
        return { error: 'Session not found' };
      }
      const messages = await getMessages(id);
      return { session, messages };
    }
  );

  fastify.patch<{ Params: { id: string }; Body: UpdateSessionBody }>(
    '/api/sessions/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateSessionBody }>,
      _reply: FastifyReply
    ) => {
      const { id } = request.params;
      const body = request.body;
      if (body.title !== undefined) {
        await updateSessionTitle(id, body.title);
      }
      if (body.isPinned !== undefined) {
        await updateSessionPin(id, body.isPinned);
      }
      return getSession(id);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api/sessions/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, _reply: FastifyReply) => {
      const { id } = request.params;
      await deleteSession(id);
      return { ok: true };
    }
  );

  fastify.delete<{ Params: { id: string }; Querystring: { from?: string; restore?: string } }>(
    '/api/sessions/:id/messages',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { from?: string; restore?: string };
      }>,
      _reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { from, restore } = request.query;

      if (!from) {
        return { error: 'Missing "from" query parameter' };
      }

      const session = await getSession(id);
      if (!session) {
        return { error: 'Session not found' };
      }

      if (restore === 'true') {
        await restoreMessages(id, from);
      } else {
        await softDeleteMessagesAfter(id, from);
      }

      const messages = await getMessages(id);
      return { messages };
    }
  );
};

export default sessionsRoutes;
