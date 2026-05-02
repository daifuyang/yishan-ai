import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { streamProcessor, prisma } from '../lib/stream-processor.js';
import { getMcpManager, MCPTool, MCPServer } from '../lib/mcp-manager.js';
import { getSkillManager, Skill } from '../lib/skill-manager.js';
import { createLogger, closeLogger } from '../lib/logger.js';

function generateSystemPrompt(tools: MCPTool[], servers: MCPServer[], skills: Skill[]): string {
  const toolList = tools.map(t => `  - ${t.name}: ${t.description}`).join('\n');
  const serverNames = servers.map(s => s.name).join(', ');

  const skillSection = skills.length > 0
    ? `\n\n可用的 Skills：\n${skills.map(s => `【${s.metadata.name}】\n${s.content}`).join('\n\n')}`
    : '';

  const mmxSection = `

MiniMax CLI (mmx) - 当用户请求以下内容时，可使用 mmx 命令：
- 视频生成/制作：用户说"生成一段视频..."、"制作一个视频..."
- 音乐创作/生成：用户说"生成一首音乐..."、"创作一首歌..."、"写一首...风格的曲子"
- 语音合成/朗读：用户说"朗读..."、"用...声音朗读..."、"文字转语音..."、"语音合成..."
- 图片生成/绘制：用户说"生成一张图..."、"画一幅..."、"创建图片..."
- 文本生成/创作：用户说"写一首诗..."、"生成文本..."、"创作..."

调用方式：通过 bash 执行 mmx 命令
  - 视频：mmx video generate --prompt "描述"
  - 音乐：mmx music generate --prompt "描述" --out 文件名.mp3
  - 语音：mmx speech synthesize --text "文本" --out 文件名.mp3
  - 图片：mmx image "描述"
  - 文本：mmx text chat --message "内容"

生成的文件保存在 minimax-output/ 文件夹中`;

  return `你是一个 AI 助手。当用户询问关于文件操作的问题时，你应该优先使用可用的 MCP 工具来完成。

当前已连接的 MCP 服务器: ${serverNames || '无'}

可用的 MCP 工具：
${toolList || '无工具可用'}
${skillSection}
${mmxSection}

重要规则：
1. 当用户询问目录列表、文件内容时，必须使用 list_directory、read_file、read_text_file 等 MCP 工具
2. 不要返回 shell 命令（如 ls、cat 等）
3. 直接使用工具获取的信息回答用户问题
4. 如果工具执行失败，告知用户并尝试其他方式
5. 如果用户的问题与某个 Skill 相关，优先使用该 Skill 的指令来执行
6. 如果用户请求视频、音乐、语音、图片生成，优先使用 mmx 命令`;
}

const SendMessageSchema = z.object({
  content: z.union([z.string(), z.array(z.any())]),
  model: z.string().optional(),
});

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/sessions/:id/chat/stream', async (request: any, reply: any) => {
    const { id } = request.params;
    const body = SendMessageSchema.parse(request.body);
    const { content, model } = body;

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
    const mcpTools = mcpManager.getAnthropicTools();
    const connectedServers = mcpManager.getServers().filter((s: MCPServer) => s.status === 'connected');
    const skillManager = getSkillManager();
    const enabledSkills = await skillManager.getEnabledSkills();
    const systemPrompt = generateSystemPrompt(mcpTools, connectedServers, enabledSkills);

    const userMessage = typeof content === 'string' ? content : JSON.stringify(content);

    log.info('CHAT', 'Submitting task', { sessionId: id, model: model || session.model });

    const { messageId, queued } = await streamProcessor.submitTask({
      sessionId: id,
      userMessage,
      systemPrompt,
      tools: mcpTools,
    });

    if (queued) {
      closeLogger(id);
      return reply.code(409).send({ error: 'Task queued, please wait' });
    }

    log.info('CHAT', 'Task submitted', { sessionId: id, messageId });
    return { ok: true, messageId };
  });

  fastify.get('/api/sessions/:id/chat/subscribe', async (request: any, reply: any) => {
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
      'Connection': 'keep-alive',
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
  });

  fastify.post('/api/sessions/:id/chat/stop', async (request: any, reply: any) => {
    const { id } = request.params;
    const log = createLogger(id);

    const cancelled = streamProcessor.cancelTask(id);

    if (cancelled) {
      log.info('CHAT', 'Task cancelled', { sessionId: id });
      return { ok: true };
    }

    log.warn('CHAT', 'No task to cancel', { sessionId: id });
    return { ok: false, error: 'No task running' };
  });
};

export default chatRoutes;