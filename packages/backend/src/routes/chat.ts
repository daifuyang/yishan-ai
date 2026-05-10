import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { configManager } from '../lib/config-manager.js';
import { closeLogger, createLogger } from '../lib/logger.js';
import { getMcpManager } from '../lib/mcp-manager.js';
import { prisma, streamProcessor } from '../lib/stream-processor.js';
import { buildSystemPrompt } from '../session/system-prompt.js';
import { toolRegistry } from '../tools/index.js';

function getDockerWorkspacePaths(): string[] {
  const config = configManager.getAll();
  return config.workspace?.directories || [];
}

const SendMessageSchema = z.object({
  content: z.union([z.string(), z.array(z.unknown())]),
  model: z.string().optional(),
  mode: z.enum(['plan', 'build']).default('build'),
});

type SendMessageBody = z.infer<typeof SendMessageSchema>;

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string }; Body: SendMessageBody }>(
    '/api/sessions/:id/chat/stream',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: SendMessageBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const body = request.body;
      const { content, model, mode } = body;

      const log = createLogger(id);

      const session = await prisma.session.findUnique({ where: { id } });
      if (!session) {
        log.warn('CHAT', 'Session not found', { sessionId: id });
        closeLogger(id);
        return reply.code(404).send({ error: 'Session not found' });
      }

      if (streamProcessor.isTaskRunning(id)) {
        log.warn('CHAT', 'Task already running', { sessionId: id });
        closeLogger(id);
        return reply.code(409).send({ error: 'Task already running, please wait' });
      }

      const mcpManager = getMcpManager();
      const mcpTools = mcpManager.getTools();
      const builtInTools = toolRegistry.list().map((t) => ({
        name: t.id,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      const dockerPaths = getDockerWorkspacePaths();
      const toolList = [...builtInTools, ...mcpTools]
        .map((t) => `  - ${t.name}: ${t.description}`)
        .join('\n');

      const { basePrompt, planReminder, buildSwitch } = await buildSystemPrompt({
        mode,
        workDir: dockerPaths[0] || '',
        sandboxDirs: dockerPaths,
        toolList,
      });

      const userMessage = typeof content === 'string' ? content : JSON.stringify(content);

      log.info('CHAT', 'Submitting task', { sessionId: id, model: model || session.model });

      const { messageId, queued } = await streamProcessor.submitTask({
        sessionId: id,
        userMessage,
        mode,
        systemPrompt: basePrompt,
        planReminder,
        buildSwitch,
        tools: [...mcpTools, ...builtInTools],
      });

      if (queued) {
        closeLogger(id);
        return reply.code(409).send({ error: 'Task queued, please wait' });
      }

      log.info('CHAT', 'Task submitted', { sessionId: id, messageId });
      return { ok: true, messageId };
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/api/sessions/:id/chat/subscribe',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const log = createLogger(id);

      const session = await prisma.session.findUnique({ where: { id } });
      if (!session) {
        log.warn('CHAT', 'Session not found for SSE', { sessionId: id });
        closeLogger(id);
        return reply.code(404).send({ error: 'Session not found' });
      }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const { cleanup, broadcast } = streamProcessor.subscribe(id, reply);

      if (session.status === 'streaming' && session.streamingContent) {
        broadcast('content_catchup', session.streamingContent);
      } else if (session.status === 'completed') {
        broadcast('stream_started');
        broadcast('done');
        closeLogger(id);
        return;
      } else if (session.status === 'failed') {
        broadcast('error', 'Session failed');
        closeLogger(id);
        return;
      }

      broadcast('stream_started');

      request.raw.on('close', () => {
        log.debug('CHAT', 'SSE connection closed', { sessionId: id });
        cleanup();
        closeLogger(id);
      });
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/sessions/:id/chat/stop',
    async (request: FastifyRequest<{ Params: { id: string } }>, _reply: FastifyReply) => {
      const { id } = request.params;
      const log = createLogger(id);

      const cancelled = streamProcessor.cancelTask(id);

      if (cancelled) {
        log.info('CHAT', 'Task cancelled', { sessionId: id });
        return { ok: true };
      }

      log.warn('CHAT', 'No task to cancel', { sessionId: id });
      return { ok: false, error: 'No task running' };
    }
  );
};

export default chatRoutes;
