# 17. 问题排查 Runbook

## 快速诊断

### 检查服务状态

```bash
# 检查前后端进程
ps aux | grep -E 'next|node.*backend' | grep -v grep

# 检查端口占用
lsof -i :4800 -i :4810

# 检查 MCP 服务器状态
curl -s http://localhost:4800/api/mcp/servers | jq .
curl -s http://localhost:4800/api/mcp/tools | jq '. | length'
```

## 问题 1：MCP 工具无法使用

### 症状
AI 回复"没有可用的文件操作工具连接到当前会话"

### 排查步骤

1. 检查 MCP 服务器状态
```bash
curl -s http://localhost:4800/api/mcp/servers | jq .
```
期望：`status: "connected"`，`tools` 数组非空

2. 检查工具列表
```bash
curl -s http://localhost:4800/api/mcp/tools | jq .
```
期望：返回包含 `list_directory`、`read_file` 等工具

### 根因 1：MCP 服务器未自动连接

**现象**：`status: "disconnected"`

**修复**：后端启动时添加自动连接

文件：`packages/backend/src/routes/mcp.ts`

```typescript
// 修改前
await mcpManager.loadConfig();

// 修改后
await mcpManager.loadConfig();
await mcpManager.reconnectAll();
```

### 根因 2：Node.js 版本不匹配

**现象**：`better-sqlite3` 模块 `NODE_MODULE_VERSION` 错误

**修复**：
```bash
# 使用 Node 22
nvm use 22
npm rebuild better-sqlite3
```

### 根因 3：API Key 或网络问题

**排查**：
```bash
curl -s -X POST "https://api.minimaxi.com/anthropic/v1/messages" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"MiniMax-M2.7","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

## 问题 2：前端 SSE 流无响应

### 症状
发送消息后，AI 一直显示"正在回复..."，但没有内容输出

### 排查步骤

1. 检查 session 状态
```bash
curl -s http://localhost:4800/api/sessions/{sessionId} | jq '.session.status'
```
- `streaming`：后端正在处理
- `idle`：处理完成但可能无内容
- `failed`：处理失败

2. 检查后端 worker 日志
```bash
tmux capture-pane -t backend -p -S -50
```
查看是否有 `[STREAM_HUB] message from worker` 日志

3. 直接测试 API
```bash
# 创建 session
SESSION_ID=$(curl -s -X POST http://localhost:4800/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"model":"MiniMax-M2.7-highspeed"}' | jq -r '.id')

# 发送消息
curl -s -X POST "http://localhost:4800/api/sessions/$SESSION_ID/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"content":"say hi","model":"MiniMax-M2.7-highspeed"}'

# 订阅流
curl -s -N "http://localhost:4800/api/sessions/$SESSION_ID/chat/subscribe"
```
期望：返回 SSE 格式的 `data: {...}` 行

### 根因 1：Worker 未发送 tool_call 事件

**现象**：后端日志显示 `makeApiCall_stream_created` 但无后续 `delta`

**原因**：`chat-stream.worker.ts` 缺少 `content_block_stop` 事件处理

**修复**：在 `content_block_stop` 时发送 `tool_call`
```typescript
} else if (event.type === 'content_block_stop') {
  if (pendingToolCall && pendingToolCall.input) {
    process.send?.({
      type: 'tool_call',
      data: { tool: pendingToolCall.name, args: JSON.parse(pendingToolCall.input) }
    });
  }
}
```

### 根因 2：tool_use_id 错误

**现象**：API 返回 `invalid params, tool call id is invalid`

**原因**：`makeFollowUpCall` 使用了 `toolName` 而非 API 返回的 `tool_use_id`

**修复**：捕获并使用 API 返回的 `id`
```typescript
// content_block_start 时捕获 id
pendingToolCall = {
  name: block?.name,
  id: block?.id,  // 捕获 API 返回的 id
  input: '',
};

// handleToolResult / handleToolError 时使用
messages.push({
  role: 'user',
  content: [{
    type: 'tool_result',
    tool_use_id: toolUseId,  // 使用捕获的 id
    content: ...
  }]
});
```

## 问题 3：tmux 会话管理

### 启动前后端（推荐方式）

```bash
# 创建独立 session
tmux new-session -d -s frontend
tmux new-session -d -s backend

# 启动前端
tmux send-keys -t frontend 'cd /path/to/yishan-ai && pnpm dev:frontend' Enter

# 启动后端（需要 Node 22）
tmux send-keys -t backend 'source ~/.nvm/nvm.sh && nvm use 22 && cd /path/to/yishan-ai/packages/backend && pnpm dev' Enter
```

### 查看日志

```bash
tmux attach -t frontend   # 前端
tmux attach -t backend    # 后端
# 分离: Ctrl+B, D
```

### 常用命令

```bash
tmux list-sessions         # 列出所有 session
tmux kill-session -t <name> # 删除 session
tmux send-keys -t <session> 'command' Enter  # 发送命令
```

## 问题 4：数据库锁定

**现象**：`SQLITE_BUSY` 或数据库错误

**修复**：
```bash
# 重启后端（会自动清理锁定）
tmux send-keys -t backend C-c
tmux send-keys -t backend 'pnpm dev' Enter
```

## 问题 5：构建失败

### better-sqlite3 编译错误

```bash
cd packages/backend
npm rebuild better-sqlite3
# 或
rm -rf node_modules/.pnpm/better-sqlite3*
pnpm install
```

### TypeScript 编译错误

```bash
cd packages/backend
npx tsc --noEmit  # 检查错误
pnpm build:ts     # 重新编译
```

## 重构记录

### 2024-04-30: Tool 调用逻辑重构

**问题**：MCP 工具调用流程存在问题，导致 AI 无法使用 tools

**修复**：
1. `mcp.ts`：添加 `reconnectAll()` 实现启动时自动连接
2. `chat-stream.worker.ts`：添加 `content_block_stop` 处理发送 `tool_call`
3. `chat-stream.worker.ts`：捕获 API 返回的 `tool_use_id`
4. `chat-stream.worker.ts`：提取 `finalizeToolCall()` 消除重复代码

**文件变更**：
- `packages/backend/src/routes/mcp.ts` - 第 7 行
- `packages/backend/src/workers/chat-stream.worker.ts` - 第 36-70, 143-158 行

**验证**：
```bash
# 测试 MCP 工具
curl -s -X POST http://localhost:4800/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"list_directory","args":{"path":"/Users/bytedance"}}'

# 测试完整流程
SESSION_ID=$(curl -s -X POST http://localhost:4800/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"model":"MiniMax-M2.7-highspeed"}' | jq -r '.id')

curl -s -X POST "http://localhost:4800/api/sessions/$SESSION_ID/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"content":"列出 /Users/bytedance/workspace 下的文件","model":"MiniMax-M2.7-highspeed"}' &

curl -s -N "http://localhost:4800/api/sessions/$SESSION_ID/chat/subscribe"
```
期望：返回目录列表