import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { streamProcessor, prisma } from '../lib/stream-processor.js';
import { getMcpManager, MCPTool, MCPServer } from '../lib/mcp-manager.js';
import { getSkillManager, Skill } from '../lib/skill-manager.js';
import { createLogger, closeLogger } from '../lib/logger.js';
import { configManager } from '../lib/config-manager.js';

function getDockerWorkspacePaths(): string[] {
  const config = configManager.getAll();
  return config.workspace?.directories || [];
}

function generateSystemPrompt(tools: MCPTool[], servers: MCPServer[], skills: Skill[], mode: 'plan' | 'build' = 'build', dockerPaths: string[] = []): string {
  const toolList = tools.map(t => `  - ${t.name}: ${t.description}`).join('\n');

  const skillSection = skills.length > 0
    ? `\n\n【飞书 Skills】\n${skills.map(s => `【${s.metadata.name}】\n${s.content}`).join('\n\n')}`
    : '';

  const sandboxDirs = dockerPaths.length > 0
    ? dockerPaths.map(p => `\`${p}\``).join('、')
    : '需配置';

  const basePrompt = `你是【移山】——一个全能的个人 AI 助手。

【核心能力】
- 📁 文件操作：读写、编辑、搜索文件和目录
- 💻 bash 命令：在沙箱内执行系统命令
- 🔍 网络搜索：获取实时信息
- 🖼️ 内容理解：分析图片、文档等视觉内容
- 📅 飞书集成：日历、文档、审批等
- 🎨 创意生成：视频、音乐、语音、图片、文本

【沙箱机制】
- 沙箱目录：${sandboxDirs} 是挂载的宿主机目录
- 在沙箱内删除修改文件 = 操作宿主机文件，不会损坏系统
- 沙箱外路径（/bin、/lib 等）是容器只读系统目录
- 当前工作目录：${dockerPaths[0] ? `\`${dockerPaths[0]}\`` : '需配置'}

【路径说明】
- ~ 是 Linux home 目录（bash 标准展开）
- 多沙箱时需确认用户想操作哪一个

【预览文件】
- 沙箱内文件：/preview?type=md&path=相对路径

【工作原则】
1. 优先使用工具而非空谈
2. 失败即告知，不猜测重试
3. 需求不明先询问

【可用工具】
${toolList || '无工具可用'}

${skillSection}`;

  if (mode === 'plan') {
    return `${basePrompt}

---

## 【Plan Mode - 只读规划模式】

CRITICAL: You are in READ-ONLY phase. STRICTLY FORBIDDEN:
- ANY file edits, modifications, or system changes
- Do NOT use commands that modify files: sed, tee, echo, write, edit, rm (except for inspection)
- Do NOT create or delete any files
- You may ONLY: read files, search code, analyze problems, and construct plans

Your responsibility: Think, read, search, and construct a well-formed plan.
Ask clarifying questions when weighing tradeoffs. Present your plan to the user clearly.
When the user says "/build" or switches to build mode, you may then execute changes.`;
  }

  return `${basePrompt}

---

## 【Build Mode】

You are now in build mode. You may execute all tools to complete the user's task.
After completing the requested changes, ask if the user is satisfied or needs adjustments.`;
}

const SendMessageSchema = z.object({
  content: z.union([z.string(), z.array(z.any())]),
  model: z.string().optional(),
  mode: z.enum(['plan', 'build']).default('build'),
});

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/sessions/:id/chat/stream', async (request: any, reply: any) => {
    const { id } = request.params;
    const body = SendMessageSchema.parse(request.body);
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
    const connectedServers = mcpManager.getServers().filter((s: MCPServer) => s.status === 'connected');
    const skillManager = getSkillManager();
    const enabledSkills = await skillManager.getEnabledSkills();
    const dockerPaths = getDockerWorkspacePaths();
    const systemPrompt = generateSystemPrompt(mcpTools, connectedServers, enabledSkills, mode, dockerPaths);

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