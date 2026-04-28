# 11. API & 路由设计

## 11.0 设计原则：后端为唯一状态主体

**核心理念：后端独立推进，前端随时可断可连。**

- **后端（Fastify + SQLite）是所有状态的唯一真相源**，会话、消息、流式进度全部存储在后端
- **前端只做两件事**：展示后端状态 + 发送用户指令
- **前端关闭不影响后端运行**：用户发起对话后，后端独立调用 MiniMax API 完成流式生成，无论前端是否在线
- **前端重新打开即恢复**：通过 session status 判断会话状态，如果正在 streaming 则自动订阅实时输出
- **前端不做任何持久化**：zustand store 仅为后端数据的本地镜像，刷新即从后端重新加载

```
前端 = 终端/监视器（随时插拔）
后端 = 永不停歇的引擎（PM2 守护）
```

## 11.1 后端 API 路由表

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| **会话管理** | | | | |
| GET | `/api/sessions` | 获取会话列表 | — | `Session[]` |
| POST | `/api/sessions` | 创建新会话 | `{ model }` | `Session` |
| GET | `/api/sessions/:id` | 获取会话详情+消息 | — | `{ session, messages }` |
| DELETE | `/api/sessions/:id` | 删除会话（CASCADE） | — | `{ ok: true }` |
| PATCH | `/api/sessions/:id` | 更新会话（标题等） | `{ title }` | `Session` |
| **对话** | | | | |
| POST | `/api/sessions/:id/chat` | 同步对话 | `{ content, model? }` | `ChatResponse` |
| POST | `/api/sessions/:id/chat/stream` | 发起流式对话（后端独立执行） | `{ content, model?, mode? }` | `{ ok: true }` |
| GET | `/api/sessions/:id/chat/subscribe` | 订阅进行中的流式输出（SSE） | — | SSE Stream |
| POST | `/api/sessions/:id/chat/stop` | 停止流式生成（terminate Worker） | — | `{ ok: true, aborted }` |
| **Plan / Build 模式** | | | | |
| POST | `/api/sessions/:id/chat/stream?mode=plan` | AI 生成执行计划，不执行工具调用 | `{ content }` | SSE Stream (plan) |
| POST | `/api/sessions/:id/chat/stream?mode=build` | AI 直接执行，工具调用自动运行 | `{ content }` | SSE Stream (build) |
| POST | `/api/sessions/:id/plan/:planId/approve` | 确认 plan 并触发 build 执行 | `{ steps?: string[] }` | SSE Stream (build) |
| GET | `/api/sessions/:id/plan/:planId` | 查询 plan 状态 | — | `Plan` |
| **后台任务** | | | | |
| POST | `/api/tasks` | 提交后台任务 | `{ type, payload }` | `{ taskId }` |
| GET | `/api/tasks/:id` | 查询任务状态 | — | `Task` |
| **系统** | | | | |
| GET | `/api/health` | 健康检查 | — | `{ status: 'ok' }` |
| GET | `/api/models` | 获取可用模型列表 | — | `Model[]` |

## 11.2 前端路由（Next.js App Router + 静态导出）

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | `app/page.tsx` | 重定向到最近会话，或空态引导创建 |
| `/chat/:sessionId` | `app/chat/[sessionId]/page.tsx` | 会话主页面（消息列表 + 输入框） |

URL query 参数：

| 参数 | 示例 | 说明 |
|------|------|------|
| `model` | `/chat/:id?model=MiniMax-M2.5` | 可选，覆盖会话默认模型 |

文件结构：

```
packages/frontend/src/app/
├── layout.tsx                    → 全局布局（sidebar 会话列表 + 右侧内容区）
├── page.tsx                      → /
└── chat/
    └── [sessionId]/
        └── page.tsx              → /chat/:sessionId
```

| 项 | 方案 |
|----|------|
| sessionId 格式 | UUID，作为 URL path segment |
| 新建会话 | POST `/api/sessions` → `router.push(/chat/${id})` |
| 切换会话 | sidebar 点击 → `router.push(/chat/${id})` |
| 刷新/分享 | URL 含完整 sessionId，状态可恢复 |
| SPA 回退 | Fastify `setNotFoundHandler` 对非 `/api/` 路径返回 `index.html` |

## 11.3 全局状态（zustand）

```
stores/
├── session-store.ts     → 会话列表、当前选中会话
└── chat-store.ts        → 当前会话的消息列表、流式状态
```

**session-store**：

| 状态/方法 | 类型 | 说明 |
|-----------|------|------|
| `sessions` | `Session[]` | 会话列表 |
| `activeId` | `string \| null` | 当前选中的 sessionId |
| `fetchSessions()` | `async` | GET `/api/sessions` 刷新列表 |
| `createSession(model)` | `async → string` | POST `/api/sessions`，返回新 id |
| `deleteSession(id)` | `async` | DELETE `/api/sessions/:id` |

**chat-store**：

| 状态/方法 | 类型 | 说明 |
|-----------|------|------|
| `messages` | `Message[]` | 当前会话的消息列表 |
| `isStreaming` | `boolean` | 是否正在流式接收 |
| `streamingContent` | `string` | 进行中的 partial 内容 |
| `fetchMessages(sessionId)` | `async` | GET `/api/sessions/:id` 加载历史，如果 status=streaming 自动调用 subscribe |
| `sendMessage(sessionId, content)` | `async` | POST `/api/sessions/:id/chat/stream` 发起对话（后端独立执行），然后自动 subscribe |
| `subscribe(sessionId)` | `async` | GET `/api/sessions/:id/chat/subscribe` SSE 订阅进行中的流式输出 |
| `appendChunk(delta)` | — | 流式接收时追加内容块 |
| `stopStream(sessionId)` | `async` | POST `/api/sessions/:id/chat/stop` 终止 Worker，保留 partial |
| `approvePlan(sessionId, planId)` | `async` | POST `/api/sessions/:id/plan/:planId/approve` |

**plan-store**：

| 状态/方法 | 类型 | 说明 |
|-----------|------|------|
| `currentPlan` | `Plan \| null` | 当前待确认的执行计划 |
| `stepStatuses` | `Map<string, StepStatus>` | 各步骤执行状态 |
| `setPlan(plan)` | — | 设置当前 plan |
| `updateStep(stepId, status)` | — | 更新单步执行状态 |
| `clearPlan()` | — | 清除当前 plan |

## 11.4 请求/响应示例

### 创建会话

```bash
curl -X POST http://localhost:4800/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{"model": "MiniMax-M2.7"}'
```

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "新对话",
  "model": "MiniMax-M2.7",
  "createdAt": 1700000000000,
  "updatedAt": 1700000000000
}
```

### 流式对话（两步：发起 + 订阅）

**Step 1：发起对话（后端独立执行，立即返回）**

```bash
curl -X POST http://localhost:4800/api/sessions/a1b2c3d4/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"content": "解释一下 TypeScript 的泛型"}'
```

```json
{ "ok": true }
```

此时后端开始独立调用 MiniMax API，session.status 变为 `streaming`。
前端关闭不影响后端继续生成。

**Step 2：订阅实时输出（SSE，随时可连可断）**

```bash
curl -N http://localhost:4800/api/sessions/a1b2c3d4/chat/subscribe
```

```
data: {"type":"content_block_start","content_block":{"type":"text","text":""}}
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"TypeScript"}}
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" 的泛型是..."}}
data: {"type":"message_stop"}
```

- 如果流还在进行中，subscribe 会先推送已缓冲的 `streaming_content`（追赶进度），然后继续推新增 delta
- 如果流已结束（session.status = idle），subscribe 立即返回 `message_stop`
- 多个前端可同时 subscribe 同一个 session

### Plan 模式

```bash
curl -N -X POST http://localhost:4800/api/sessions/a1b2c3d4/chat/stream?mode=plan \
  -H 'Content-Type: application/json' \
  -d '{"content": "帮我创建一个 Express 项目"}'
```

```
data: {"type":"plan_start","planId":"plan-uuid-123"}
data: {"type":"plan_step","step":{"id":"step-1","action":"execute_command","command":"mkdir -p my-app && cd my-app && npm init -y","description":"初始化项目目录"}}
data: {"type":"plan_step","step":{"id":"step-2","action":"execute_command","command":"npm install express","description":"安装 Express"}}
data: {"type":"plan_step","step":{"id":"step-3","action":"write_file","path":"index.js","description":"创建入口文件"}}
data: {"type":"plan_complete","planId":"plan-uuid-123","totalSteps":3}
```

### 确认并执行 Plan

```bash
curl -N -X POST http://localhost:4800/api/sessions/a1b2c3d4/plan/plan-uuid-123/approve \
  -H 'Content-Type: application/json' \
  -d '{"steps": ["step-1", "step-2", "step-3"]}'
```

```
data: {"type":"build_step_start","stepId":"step-1","description":"初始化项目目录"}
data: {"type":"build_step_done","stepId":"step-1","result":"目录已创建"}
data: {"type":"build_step_start","stepId":"step-2","description":"安装 Express"}
data: {"type":"build_step_done","stepId":"step-2","result":"express@4.18.2 installed"}
data: {"type":"build_step_start","stepId":"step-3","description":"创建入口文件"}
data: {"type":"build_step_done","stepId":"step-3","result":"index.js 已写入"}
data: {"type":"build_complete","planId":"plan-uuid-123","success":true}
```

## 11.5 Plan / Build 模式说明

| 项 | plan 模式 | build 模式 |
|----|----------|-----------|
| mode 参数 | `?mode=plan` | `?mode=build`（默认） |
| AI 行为 | 只输出步骤列表，不执行工具调用 | 正常 Agentic Loop，自动执行工具 |
| 用户操作 | 审核步骤 → 可编辑/删除/排序 → 点击执行 | 无需干预，实时查看进度 |
| 适用场景 | 涉及文件操作、命令执行等需要审批的操作 | 普通对话、确认后的计划执行 |
| 默认行为 | 不传 mode 时默认 build | 纯文本对话不触发 plan |

## 11.6 流式架构：后端独立执行 + 前端订阅

### 核心流程

```
┌──────────┐               ┌──────────────┐                ┌──────────────┐
│  前端     │               │  Fastify     │                │  Worker      │
│ (可关闭)  │               │  主线程       │                │  Thread      │
└────┬─────┘               └──────┬───────┘                └──────┬───────┘
     │                             │                               │
     │ POST /chat/stream           │                               │
     │────────────────────────────▶│                               │
     │                             │ ① INSERT user message         │
     │                             │ ② status = 'streaming'        │
     │ { ok: true }                │ ③ 创建 Worker Thread          │
     │◀────────────────────────────│──────────────────────────────▶│
     │                             │                               │
     │ (前端可随时关闭)              │                   ④ Worker 内部：
     │                             │                     MiniMax API stream
     │                             │                               │
     │ GET /chat/subscribe (SSE)   │ ◀── postMessage(delta) ──────│
     │────────────────────────────▶│                               │
     │ ◀── catchup ───────────────│                               │
     │ ◀── delta ─────────────────│ ◀── postMessage(delta) ──────│
     │ ◀── delta ─────────────────│ ◀── postMessage(delta) ──────│
     │                             │                               │
     │ POST /chat/stop             │                               │
     │────────────────────────────▶│ worker.terminate() ──────────▶│ ✕
     │ { ok, aborted }             │ 保留 partial + status='idle'  │
     │◀────────────────────────────│                               │
     │                             │                               │
     │ (正常完成场景)                │ ◀── postMessage(done) ───────│
     │ ◀── message_stop ──────────│ INSERT assistant message      │
     │                             │ status = 'idle'               │
     └                             └                               └
```

### 后端处理流程（chat/stream 路由 + Worker Thread）

```
POST /api/sessions/:id/chat/stream
  │
  ├── ① INSERT user message → SQLite
  ├── ② UPDATE session SET status = 'streaming', streaming_content = ''
  ├── ③ streamHub.startWorker(sessionId, messages, options)
  │       → 创建 Worker Thread（chat-stream.worker.ts）
  ├── ④ 立即返回 { ok: true }
  │
  └── Worker Thread 内部（独立线程，主线程不阻塞）：
        │
        ├── for await (event of anthropicStream) {
        │     appendStreamingContent(sessionId, delta.text) → SQLite
        │     parentPort.postMessage({ type: 'delta', data: event })
        │   }
        │
        ├── 流正常结束：
        │     INSERT assistant message（完整内容）→ SQLite
        │     UPDATE session SET status = 'idle', streaming_content = NULL
        │     parentPort.postMessage({ type: 'done' })
        │
        └── 流异常失败：
              UPDATE session SET status = 'failed'
              parentPort.postMessage({ type: 'error', message: '...' })

POST /api/sessions/:id/chat/stop
  │
  ├── streamHub.stopWorker(sessionId)
  │     → worker.terminate()
  ├── 将 streaming_content 作为 assistant 消息写入 SQLite（标记 stopped: true）
  ├── UPDATE session SET status = 'idle', streaming_content = NULL
  └── 广播 message_stop 给 subscribe 连接
```

### 前端订阅流程（chat/subscribe 路由）

```
GET /api/sessions/:id/chat/subscribe
  │
  ├── 查询 session.status
  │
  ├── if status === 'idle'
  │     └── 立即发送 data: {"type":"message_stop"} 并关闭连接
  │
  ├── if status === 'failed'
  │     └── 立即发送 data: {"type":"error","message":"..."} 并关闭连接
  │
  └── if status === 'streaming'
        ├── 先推送已缓冲的 streaming_content（让前端追赶进度）
        │     data: {"type":"content_catchup","content":"已生成的部分内容..."}
        │
        ├── 注册为该 session 的活跃订阅者
        │
        ├── 持续推送新增 delta（与后端生成同步）
        │     data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
        │
        └── 流结束时推送 message_stop 并关闭连接
              data: {"type":"message_stop"}
```

### SSE 事件类型与前端 store 动作映射

| SSE 事件 type | 前端 store 动作 | 说明 |
|--------------|----------------|------|
| `content_catchup` | `set({ streamingContent: event.content })` | 订阅时追赶已缓冲内容 |
| `content_block_start` | 创建空 assistant 消息追加到 `messages` | 开始接收 |
| `content_block_delta` (text_delta) | `appendChunk(delta.text)` | 实时追加文字 |
| `content_block_delta` (thinking_delta) | 拼接到 thinking 字段 | 思考过程 |
| `message_stop` | `set({ isStreaming: false })`，移除光标 | 流结束 |
| `error` | `set({ isStreaming: false })`，显示错误 toast | 流失败 |
| `plan_start` | `planStore.setPlan({ id, steps: [] })` | Plan 模式 |
| `plan_step` | `planStore.addStep(step)` | 追加步骤 |
| `plan_complete` | `planStore.setComplete()` | Plan 就绪 |
| `build_step_start` | `planStore.updateStep(stepId, 'running')` | Build 执行中 |
| `build_step_done` | `planStore.updateStep(stepId, 'done')` | 步骤完成 |
| `build_complete` | `set({ isStreaming: false })` | Build 完成 |

### 前端打开/刷新页面恢复流程

```
用户打开 /chat/:sessionId
  │
  ├── GET /api/sessions → 恢复左侧会话列表（每个 session 含 status）
  │
  ├── GET /api/sessions/:id → 获取当前会话详情 + 历史消息
  │     响应：{ session: { status, streamingContent, ... }, messages: [...] }
  │
  ├── 渲染历史消息
  │
  └── 判断 session.status
        │
        ├── 'idle' → 正常状态，等待用户输入
        │
        ├── 'streaming' → 会话正在生成中
        │     ├── 显示 streamingContent（已缓冲的部分）
        │     ├── set({ isStreaming: true })
        │     └── 自动调用 subscribe(sessionId) 接续实时输出
        │
        └── 'failed' → 上次生成失败
              └── 显示错误提示，允许用户重试
```

### 后端 StreamHub（Worker 管理器 + SSE 广播）

```typescript
// packages/backend/src/lib/stream-hub.ts
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';

class StreamHub {
  private workers = new Map<string, Worker>();
  private emitters = new Map<string, EventEmitter>();

  startWorker(sessionId: string, workerData: Record<string, unknown>): void {
    const worker = new Worker(
      resolve(__dirname, '../workers/chat-stream.worker.js'),
      { workerData: { sessionId, ...workerData } }
    );

    this.workers.set(sessionId, worker);
    const emitter = this.getOrCreateEmitter(sessionId);

    worker.on('message', (msg) => {
      emitter.emit(msg.type, msg.data);
    });

    worker.on('exit', (code) => {
      this.workers.delete(sessionId);
      if (code !== 0) {
        emitter.emit('error', { message: `Worker exited with code ${code}` });
      }
      emitter.emit('exit', { code });
    });
  }

  stopWorker(sessionId: string): boolean {
    const worker = this.workers.get(sessionId);
    if (!worker) return false;
    worker.terminate();
    this.workers.delete(sessionId);
    return true;
  }

  isRunning(sessionId: string): boolean {
    return this.workers.has(sessionId);
  }

  getOrCreateEmitter(sessionId: string): EventEmitter {
    if (!this.emitters.has(sessionId)) {
      this.emitters.set(sessionId, new EventEmitter());
    }
    return this.emitters.get(sessionId)!;
  }

  cleanup(sessionId: string): void {
    this.stopWorker(sessionId);
    this.emitters.get(sessionId)?.removeAllListeners();
    this.emitters.delete(sessionId);
  }
}

export const streamHub = new StreamHub();
```

```typescript
// packages/backend/src/workers/chat-stream.worker.ts
import { parentPort, workerData } from 'node:worker_threads';
import { Anthropic } from '@anthropic-ai/sdk';
import { appendStreamingContent, updateSessionStatus } from '../stores/session-store';
import { appendMessage } from '../stores/message-store';

const { sessionId, messages, options } = workerData;

const client = new Anthropic({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic/v1',
});

async function run() {
  let fullContent = '';

  const stream = client.messages.stream({
    model: options.model,
    max_tokens: options.maxTokens || 4096,
    temperature: 1,
    system: options.systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullContent += event.delta.text;
      appendStreamingContent(sessionId, event.delta.text);
      parentPort!.postMessage({ type: 'delta', data: event });
    }
  }

  appendMessage(sessionId, 'assistant', [{ type: 'text', text: fullContent }]);
  updateSessionStatus(sessionId, 'idle', null);
  parentPort!.postMessage({ type: 'done' });
}

run().catch((err) => {
  updateSessionStatus(sessionId, 'failed');
  parentPort!.postMessage({ type: 'error', data: { message: String(err) } });
});
```

subscribe 路由通过 `streamHub.getOrCreateEmitter(sessionId).on('delta', ...)` 监听 Worker 产出并推送给前端。
chat/stop 路由调用 `streamHub.stopWorker(sessionId)` 终止 Worker，保留 partial 内容。
