import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getSession } from '../stores/session-store.js';
import { streamHub } from '../lib/stream-hub.js';
import { getMcpManager, MCPTool, MCPServer } from '../lib/mcp-manager.js';
import { getSkillManager, Skill } from '../lib/skill-manager.js';
import { createLogger, closeLogger } from '../lib/logger.js';

function generateCorrelationId(): string {
  return Math.random().toString(36).substring(2, 18);
}

function generateSystemPrompt(tools: MCPTool[], servers: MCPServer[], skills: Skill[]): string {
  const toolList = tools.map(t => `  - ${t.name}: ${t.description}`).join('\n');
  const serverNames = servers.map(s => s.name).join(', ');

  const skillSection = skills.length > 0
    ? `\n\n可用的 Skills：\n${skills.map(s => `【${s.metadata.name}】\n${s.content}`).join('\n\n')}`
    : '';

  return `你是一个 AI 助手。当用户询问关于文件操作的问题时，你应该优先使用可用的 MCP 工具来完成。

当前已连接的 MCP 服务器: ${serverNames || '无'}

可用的 MCP 工具：
${toolList || '无工具可用'}
${skillSection}

重要规则：
1. 当用户询问目录列表、文件内容时，必须使用 list_directory、read_file、read_text_file 等 MCP 工具
2. 不要返回 shell 命令（如 ls、cat 等）
3. 直接使用工具获取的信息回答用户问题
4. 如果工具执行失败，告知用户并尝试其他方式
5. 如果用户的问题与某个 Skill 相关，优先使用该 Skill 的指令来执行`;
}

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

    const correlationId = generateCorrelationId();
    const log = createLogger(id, correlationId);

    log.info('CHAT', 'Received chat request', {
      correlationId,
      sessionId: id,
      model: model || 'default',
      messageLength: typeof content === 'string' ? content.length : JSON.stringify(content).length,
    });

    const session = getSession(id);
    if (!session) {
      log.warn('CHAT', 'Session not found', { sessionId: id });
      closeLogger(id);
      return reply.code(404).send({ error: 'Session not found' });
    }

    log.debug('CHAT', 'Session found', { sessionId: id, sessionModel: session.model });

    const mcpManager = getMcpManager();
    const mcpTools = mcpManager.getAnthropicTools();
    log.debug('CHAT', 'Retrieved MCP tools', { toolCount: mcpTools.length });

    const connectedServers = mcpManager.getServers().filter((s: MCPServer) => s.status === 'connected');
    log.debug('CHAT', 'Filtered connected servers', { connectedCount: connectedServers.length });

    const skillManager = getSkillManager();
    const enabledSkills = await skillManager.getEnabledSkills();
    log.debug('CHAT', 'Retrieved enabled skills', { skillCount: enabledSkills.length });

    const systemPrompt = generateSystemPrompt(mcpTools, connectedServers, enabledSkills);
    log.debug('CHAT', 'Generated system prompt', { promptLength: systemPrompt.length });

    log.info('CHAT', 'Starting stream for session', {
      sessionId: id,
      model: model || session.model,
      toolCount: mcpTools.length,
      skillCount: enabledSkills.length,
    });

    const messageId = streamHub.start({
      sessionId: id,
      userMessage: typeof content === 'string' ? content : JSON.stringify(content),
      options: { model: model || session.model, systemPrompt, correlationId },
      tools: mcpTools,
    });

    log.info('CHAT', 'Stream started', { sessionId: id, messageId });

    return { ok: true, messageId };
  });

  fastify.get('/api/sessions/:id/chat/subscribe', async (request: any, reply: any) => {
    const { id } = request.params;
    const log = createLogger(id);
    log.debug('CHAT', 'SSE subscription started', { sessionId: id });

    const session = getSession(id);

    if (!session) {
      log.warn('CHAT', 'Session not found for SSE', { sessionId: id });
      closeLogger(id);
      return reply.code(404).send({ error: 'Session not found' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const { cleanup } = streamHub.pipeToSSE(reply, getMcpManager());

    request.raw.on('close', () => {
      log.debug('CHAT', 'SSE connection closed', { sessionId: id });
      cleanup();
    });
  });

  fastify.post('/api/sessions/:id/chat/stop', async (request: any, reply: any) => {
    const { id } = request.params;
    const log = createLogger(id);
    log.info('CHAT', 'Stop stream requested', { sessionId: id });

    const stopped = streamHub.stop();
    log.info('CHAT', 'Stream stop result', { sessionId: id, aborted: stopped });

    return { ok: true, aborted: stopped };
  });

  fastify.addHook('onClose', async () => {
    if (streamHub.isRunning()) {
      streamHub.stop();
    }
  });
};

export default chatRoutes;
