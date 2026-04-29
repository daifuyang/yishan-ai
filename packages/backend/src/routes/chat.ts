import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getSession, updateSessionStatus, autoTitle } from '../stores/session-store.js';
import { appendMessage, getAnthropicMessages } from '../stores/message-store.js';
import { streamHub } from '../lib/stream-hub.js';

const SendMessageSchema = z.object({
  content: z.union([z.string(), z.array(z.any())]),
  model: z.string().optional(),
  mode: z.enum(['plan', 'build']).optional(),
});

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/sessions/:id/chat/stream', async (request: any, reply: any) => {
    const { id } = request.params;
    const body = SendMessageSchema.parse(request.body);
    const { content, model } = body;

    const session = getSession(id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const userContent = typeof content === 'string' ? content : JSON.stringify(content);
    appendMessage(id, 'user', typeof content === 'string' ? content : content);
    autoTitle(id, userContent);
    updateSessionStatus(id, 'streaming', '');

    const anthropicMessages = getAnthropicMessages(id);
    const messages = anthropicMessages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const sessionModel = model || session.model;

    streamHub.startWorker(id, messages, { model: sessionModel, systemPrompt: undefined });

    return { ok: true };
  });

  fastify.get('/api/sessions/:id/chat/subscribe', async (request: any, reply: any) => {
    const { id } = request.params;
    const session = getSession(id);

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    if (session.status === 'idle') {
      reply.raw.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      reply.raw.end();
      return;
    }

    if (session.status === 'failed') {
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Session failed' })}\n\n`);
      reply.raw.end();
      return;
    }

    if (session.streamingContent) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'content_catchup', content: session.streamingContent })}\n\n`);
    }

    const handleDelta = (data: any) => {
      if (data.delta?.type === 'text_delta') {
        reply.raw.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: data.delta })}\n\n`);
      }
    };

    const handleDone = () => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      reply.raw.end();
      streamHub.off('delta', handleDelta);
      streamHub.off('done', handleDone);
      streamHub.off('error', handleError);
    };

    const handleError = (data: any) => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: data.message })}\n\n`);
      reply.raw.end();
      streamHub.off('delta', handleDelta);
      streamHub.off('done', handleDone);
      streamHub.off('error', handleError);
    };

    streamHub.on('delta', handleDelta);
    streamHub.on('done', handleDone);
    streamHub.on('error', handleError);

    request.raw.on('close', () => {
      streamHub.off('delta', handleDelta);
      streamHub.off('done', handleDone);
      streamHub.off('error', handleError);
    });
  });

  fastify.post('/api/sessions/:id/chat/stop', async (request: any, reply: any) => {
    const { id } = request.params;
    const session = getSession(id);

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const stopped = streamHub.stopWorker();

    if (session.streamingContent) {
      appendMessage(id, 'assistant', [{ type: 'text', text: session.streamingContent }]);
    }

    updateSessionStatus(id, 'idle', null);

    return { ok: true, aborted: stopped };
  });

  fastify.addHook('onClose', async () => {
    if (streamHub.isRunning()) {
      streamHub.stopWorker();
    }
  });
};

export default chatRoutes;