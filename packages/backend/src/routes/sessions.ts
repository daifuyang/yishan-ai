import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  listSessions,
  getSession,
  createSession,
  updateSessionTitle,
  updateSessionPin,
  deleteSession,
} from '../stores/session-store.js';
import { getMessages, softDeleteMessagesAfter, restoreMessages } from '../stores/message-store.js';

const CreateSessionSchema = z.object({
  model: z.string(),
  title: z.string().optional(),
});

const UpdateSessionSchema = z.object({
  title: z.string().optional(),
  isPinned: z.boolean().optional(),
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
    if (body.title !== undefined) {
      updateSessionTitle(id, body.title);
    }
    if (body.isPinned !== undefined) {
      updateSessionPin(id, body.isPinned);
    }
    return getSession(id);
  });

  fastify.delete('/api/sessions/:id', async (request: any) => {
    const { id } = request.params;
    deleteSession(id);
    return { ok: true };
  });

  fastify.delete('/api/sessions/:id/messages', async (request: any) => {
    const { id } = request.params;
    const { from, restore } = request.query;

    if (!from) {
      return { error: 'Missing "from" query parameter' };
    }

    const session = getSession(id);
    if (!session) {
      return { error: 'Session not found' };
    }

    if (restore === 'true') {
      restoreMessages(id, from);
    } else {
      softDeleteMessagesAfter(id, from);
    }

    const messages = getMessages(id);
    return { messages };
  });
};

export default sessionsRoutes;