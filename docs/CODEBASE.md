# 移山 AI (yishan-ai) 代码库分析

## 项目结构

```
yishan-ai/
├── packages/
│   ├── backend/          # Fastify TypeScript 后端
│   │   └── src/
│   │       ├── server.ts          # 服务入口
│   │       ├── app.ts             # Fastify 路由注册
│   │       ├── lib/
│   │       │   ├── stream-processor.ts   # 核心：消息流处理、AI 调用、工具执行
│   │       │   ├── ai-client.ts          # Anthropic/MiniMax API 客户端
│   │       │   ├── mcp-manager.ts        # MCP (Model Context Protocol) 管理器
│   │       │   ├── skill-manager.ts      # Skill 技能管理器
│   │       │   ├── config-manager.ts     # 配置管理器
│   │       │   ├── logger.ts             # 日志系统
│   │       │   └── fs-provider.ts        # 文件系统提供者
│   │       ├── routes/
│   │       │   ├── chat.ts               # 聊天 API (SSE 流式响应)
│   │       │   ├── sessions.ts           # Session 管理
│   │       │   ├── mcp.ts                # MCP 服务器管理
│   │       │   ├── skills.ts             # Skill 管理
│   │       │   ├── config.ts             # 配置 API
│   │       │   └── ...
│   │       ├── tools/                    # 内置工具集
│   │       │   ├── registry.ts           # 工具注册中心
│   │       │   ├── types.ts              # 工具类型定义
│   │       │   ├── index.ts              # 工具初始化
│   │       │   ├── bash.ts               # Bash 命令工具
│   │       │   ├── read.ts               # 读文件工具
│   │       │   ├── write.ts              # 写文件工具
│   │       │   ├── edit.ts               # 编辑文件工具
│   │       │   ├── glob.ts               # 文件搜索工具
│   │       │   ├── grep.ts               # 内容搜索工具
│   │       │   ├── list.ts               # 目录列表工具
│   │       │   ├── webfetch.ts           # 网页获取工具
│   │       │   ├── websearch.ts          # 网络搜索工具
│   │       │   ├── todo.ts / task.ts     # 待办/任务工具
│   │       │   └── docker-sandbox.ts     # Docker 沙箱
│   │       ├── stores/
│   │       │   ├── session-store.ts       # Session 状态管理
│   │       │   └── message-store.ts       # 消息存储
│   │       ├── db/
│   │       │   └── migrations.ts          # 数据库迁移
│   │       └── plugins/
│   └── frontend/         # Next.js 前端
├── shared/              # 共享类型和 Schema
├── ~/.yishan-ai/        # 用户配置目录
│   ├── config.json       # 应用配置
│   ├── mcp.json         # MCP 服务器配置
│   ├── skills/          # 用户自定义 Skills
│   ├── logs/            # 日志目录 (session-{id}-{date}.log)
│   └── data/            # 数据目录 (SQLite DB)
```

## 核心流程：消息处理

### 1. Chat 路由 (`routes/chat.ts`)
- `POST /api/sessions/:id/chat/stream` - 提交聊天任务
- `GET /api/sessions/:id/chat/subscribe` - SSE 订阅流式响应
- `POST /api/sessions/:id/chat/stop` - 停止任务

### 2. Stream Processor (`lib/stream-processor.ts`)
核心类 `StreamProcessor` 处理所有 AI 流式交互：

```
submitTask() → processTask() → [循环]
  ├── 调用 AI API (client.messages.stream)
  ├── 解析流式事件 (content_block_delta, content_block_start, content_block_stop, message_stop)
  ├── 检测工具调用 (tool_use)
  ├── 执行工具 (callTool())
  ├── 保存结果到数据库
  └── 循环直到无工具调用
```

### 3. 工具执行 (`callTool()`)
1. 先从 `toolRegistry` 查找内置工具
2. 未找到则调用 `mcpManager.callTool()` (MCP 协议)

## 关键类型定义

### Tool 接口 (`tools/types.ts`)
```typescript
interface Tool {
  id: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute(args: unknown, ctx: ToolContext): Promise<ExecuteResult>
}
```

### ToolContext
```typescript
interface ToolContext {
  sessionId: string
  messageId: string
  agent: string
  abort: AbortSignal
  directory: string
  worktree: string
}
```

## 常见错误分析

### 错误 1: "invalid params, function name or parameters is empty (2013)"
**来源**: `stream-processor.ts` 中 `processTask()` 调用 AI API 时

**原因**:
- 发送给 API 的 `tools` 数组中某个工具的 `name` 或 `inputSchema` 为空
- 检查 `mcpManager.getTools()` 返回的工具定义

**排查方法**:
```bash
# 查看日志
cat ~/.yishan-ai/logs/session-{sessionId}-{date}.log
```

### 错误 2: "Name or service not known" / "No route to host"
**来源**: 网络连接问题

**原因**:
- DNS 解析失败
- 代理服务器不可达 (如 `192.168.71.100:7890`)
- WSL 与 Windows 主机网络不通

## 日志位置

- **应用日志**: `~/.yishan-ai/logs/session-{sessionId}-{date}.log`
- **错误日志**: `/home/dfy/workspace/yishan-ai/exception.*.spx.error.log` (Azure TTS SDK)
- **工作区日志**: `/home/dfy/workspace/yishan-ai/log-*.log`

## 环境变量

关键环境变量 (见 `configManager`):
- `MINIMAX_API_KEY` - MiniMax API Key
- `MINIMAX_BASE_URL` - API 基础 URL (默认 `https://api.minimaxaxi.com/anthropic`)
- `DEFAULT_MODEL` - 默认模型
- `DATABASE_URL` - 数据库连接字符串
- `NODE_ENV` - 环境 (development/production)

## MCP 配置

`~/.yishan-ai/mcp.json`:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@some/mcp-server"],
      "enabled": true
    }
  }
}
```

## Skill 配置

`~/.yishan-ai/skills/` 目录下每个子目录包含:
- `SKILL.md` - Skill 定义文件 (含 frontmatter 元数据)
- 其他辅助文件

Skill 元数据格式:
```markdown
---
name: skill-name
description: 技能描述
---

技能内容...
```

## 快速命令

```bash
# 开发模式
pnpm dev

# 构建
pnpm build

# 启动生产服务
pnpm start
```
