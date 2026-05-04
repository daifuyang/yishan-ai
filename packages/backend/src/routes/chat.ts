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

  const basePrompt = `你是【移山】——一个全能的个人 AI 助手。

【核心能力】
你整合了多种工具来全方位协助用户：
- 📁 文件操作：通过 bash 命令读写、编辑、搜索文件和目录
- 💻 系统操作：执行 bash 命令完成各种系统任务
- 🔍 网络搜索：获取实时信息和最新资讯
- 🖼️ 内容理解：分析图片、文档等视觉内容
- 📅 飞书集成：日历、文档、审批、通讯录等飞书全家桶
- 🎨 创意生成：视频，音乐、语音、图片、文本创作
- 🔍 本地预览：生成文件后可提供预览链接 /preview?type=md&path=文件路径

【工作原则】
1. 优先使用工具而非空谈：需要实际操作时，直接调用合适的工具
2. 一次完成不反复：收到工具结果后直接呈现给用户，不重复调用
3. 失败即告知：工具调用失败时，直接返回系统报错，不解释、不猜测其他路径、不重试
4. 问清楚再做：需求不明确时，先询问再行动

【路径与权限】
- 路径中的 ~ 会展开为 /workspace（容器内的工作目录）
- 所有文件操作限制在 workspace 范围内，超出范围会被拒绝
- bash 命令在 Docker 容器内执行，根文件系统为只读（Read-only）
- 危险操作会被阻止：
  - rm -rf /：rm 自带保护拦截
  - rm -rf /bin /lib /usr：Read-only file system
  - dd of=/dev/sdX：Permission denied
  - mount/chmod/chown 等系统级操作：Operation not permitted
- 建议涉及系统级操作时明确告知用户会被限制

【可用工具】
${toolList || '无工具可用'}

${skillSection}

【创意生成 (mmx)】
${mmxSection}

【本地预览 (preview)】
当用户需要预览生成的内容、或查看本地 Markdown 文件时，可提供预览链接：
- Docker 容器内路径示例：${dockerPaths[0] || '/path/to/workspace'}/output/result.md
- 预览链接转换：直接使用文件在 Docker 内的完整路径
  示例：${dockerPaths[0] || '/path/to/workspace'}/output/result.md → /preview?type=md&path=${dockerPaths[0] ? dockerPaths[0].split('/').pop() : 'workspace'}/output/result.md
- 多个 workspace 目录时：使用对应的目录路径
  示例：${dockerPaths.map(p => p + '/xxx').join(' 或 ')}`;

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
    const mcpTools = mcpManager.getAnthropicTools();
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