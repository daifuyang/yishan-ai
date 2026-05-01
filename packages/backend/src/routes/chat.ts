import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getSession } from '../stores/session-store.js';
import { streamHub } from '../lib/stream-hub.js';
import { getMcpManager, MCPTool, MCPServer } from '../lib/mcp-manager.js';

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

    const mcpManager = getMcpManager();
    const mcpTools = mcpManager.getAnthropicTools();
    const connectedServers = mcpManager.getServers().filter((s: MCPServer) => s.status === 'connected');
    const systemPrompt = generateSystemPrompt(mcpTools, connectedServers);

    const messageId = streamHub.start({
      sessionId: id,
      userMessage: typeof content === 'string' ? content : JSON.stringify(content),
      options: { model: model || session.model, systemPrompt },
      tools: mcpTools,
    });

    return { ok: true, messageId };
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

    const { cleanup } = streamHub.pipeToSSE(reply, getMcpManager());

    request.raw.on('close', () => {
      cleanup();
    });
  });

  fastify.post('/api/sessions/:id/chat/stop', async (request: any, reply: any) => {
    const stopped = streamHub.stop();
    return { ok: true, aborted: stopped };
  });

  fastify.addHook('onClose', async () => {
    if (streamHub.isRunning()) {
      streamHub.stop();
    }
  });
};

export default chatRoutes;
