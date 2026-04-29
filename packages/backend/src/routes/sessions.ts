import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  listSessions,
  getSession,
  createSession,
  updateSessionTitle,
  deleteSession,
} from '../stores/session-store.js';
import { getMessages } from '../stores/message-store.js';

const CreateSessionSchema = z.object({
  model: z.string(),
  title: z.string().optional(),
});

const UpdateSessionSchema = z.object({
  title: z.string(),
});

const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/sessions', async () => {
    return listSessions();
  });

  fastify.post('/api/sessions', async (request: any) => {
    const body = CreateSessionSchema.parse(request.body);
    return createSession(body.model, body.title);
  });

  fastify.get('/api/sessions/:id', async (request: any) => {
    const { id } = request.params;
    const session = getSession(id);
    if (!session) {
      return { error: 'Session not found' };
    }
    const messages = getMessages(id);
    return { session, messages };
  });

  fastify.patch('/api/sessions/:id', async (request: any) => {
    const { id } = request.params;
    const body = UpdateSessionSchema.parse(request.body);
    updateSessionTitle(id, body.title);
    return getSession(id);
  });

  fastify.delete('/api/sessions/:id', async (request: any) => {
    const { id } = request.params;
    deleteSession(id);
    return { ok: true };
  });
};

export default sessionsRoutes;