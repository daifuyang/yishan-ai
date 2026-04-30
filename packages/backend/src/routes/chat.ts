import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getSession, updateSessionStatus, autoTitle } from '../stores/session-store.js';
import { appendMessage, getAnthropicMessages } from '../stores/message-store.js';
import { streamHub } from '../lib/stream-hub.js';
import { getMcpManager, MCPServer, MCPTool } from '../lib/mcp-manager.js';

function generateSystemPrompt(tools: MCPTool[], servers: MCPServer[]): string {
  const toolList = tools.map(t => `  - ${t.name}: ${t.description}`).join('\n');
  const serverNames = servers.map(s => s.name).join(', ');

  return `你是一个 AI 助手。当用户询问关于文件操作的问题时，你应该优先使用可用的 MCP 工具来完成。

当前已连接的 MCP 服务器: ${serverNames || '无'}

可用的 MCP 工具：
${toolList || '无工具可用'}

重要规则：
1. 当用户询问目录列表、文件内容时，必须使用 list_directory、read_file、read_text_file 等 MCP 工具
2. 不要返回 shell 命令（如 ls、cat 等）
3. 直接使用工具获取的信息回答用户问题
4. 如果工具执行失败，告知用户并尝试其他方式`;
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

    const mcpManager = getMcpManager();
    const mcpTools = mcpManager.getAnthropicTools();
    const connectedServers = mcpManager.getServers().filter(s => s.status === 'connected');

    const systemPrompt = generateSystemPrompt(mcpTools, connectedServers);

    console.error('[CHAT] Starting worker with', { toolsCount: mcpTools.length, systemPromptLength: systemPrompt.length });
    streamHub.startWorker(id, messages, { model: sessionModel, systemPrompt }, mcpTools);

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

    const handleToolCall = async (data: { tool: string; args: Record<string, unknown> }) => {
      try {
        const mcpManager = getMcpManager();
        const result = await mcpManager.callTool(data.tool, data.args);
        streamHub.sendToWorker('tool_result', { result });
      } catch (err: any) {
        streamHub.sendToWorker('tool_error', { error: err.message });
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
    streamHub.on('tool_call', handleToolCall);

    request.raw.on('close', () => {
      streamHub.off('delta', handleDelta);
      streamHub.off('done', handleDone);
      streamHub.off('error', handleError);
      streamHub.off('tool_call', handleToolCall);
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