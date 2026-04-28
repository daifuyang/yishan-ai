# 8. 后台运行 & CLI 式部署

## 8.1 一键构建部署流程

```bash
nvm use 22
pnpm install
cp packages/backend/.env.example packages/backend/.env

pnpm build
pm2 start packages/backend/ecosystem.config.cjs

# 完成！打开 http://localhost:4800
```

## 8.2 PM2 配置

```javascript
// packages/backend/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'yishan-ai',
    script: './dist/index.js',
    cwd: './packages/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 4800,
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    merge_logs: true,
    kill_timeout: 5000,
    listen_timeout: 10000,
  }],
};
```

## 8.3 PM2 命令速查

```bash
pm2 start ecosystem.config.cjs
pm2 stop yishan-ai
pm2 restart yishan-ai
pm2 reload yishan-ai
pm2 logs yishan-ai
pm2 monit
pm2 status
pm2 startup
pm2 save
```

| PM2 能力 | 说明 |
|----------|------|
| 自动重启 | 进程崩溃后自动拉起 |
| 日志管理 | stdout/stderr 分离，支持日期分割 |
| 监控面板 | `pm2 monit` 实时监控 |
| 零停机重启 | `pm2 reload` 滚动更新 |
| 开机自启 | `pm2 startup` 注册系统服务 |

## 8.4 后端独立执行原理

**核心原则：所有 AI 交互均由后端独立推进，前端关闭不影响执行。**
**实现方式：每个流式对话 = 一个 Node.js Worker Thread，主线程只做路由和广播。**

### 8.4.1 普通对话（Worker Thread 流式生成）

```
浏览器端：
  1. POST /api/sessions/:id/chat/stream  →  { ok: true }    (立即返回)
  2. GET /api/sessions/:id/chat/subscribe  →  SSE 实时输出
  3. 用户可随时关闭浏览器（Worker Thread 继续生成）
  4. 再次打开浏览器
  5. GET /api/sessions/:id  →  session.status = 'streaming' + streamingContent
  6. GET /api/sessions/:id/chat/subscribe  →  追赶已缓冲内容 + 继续接收
  7. POST /api/sessions/:id/chat/stop  →  终止 Worker，保留 partial 内容

服务端（Fastify 主线程 + Worker Threads）：
  1. 主线程收到 POST /chat/stream
  2. 保存 user message，设置 session.status = 'streaming'
  3. 创建 Worker Thread（chat-stream.worker.ts），传入 sessionId + messages
  4. 立即返回 { ok: true }
  5. Worker Thread 内部：
     a. 调 MiniMax API 流式生成
     b. 逐 chunk：写 SQLite（appendStreamingContent）+ postMessage 给主线程
     c. 完成后：INSERT assistant message，session.status = 'idle'
     d. 异常时：session.status = 'failed'
  6. 主线程收到 postMessage → StreamHub 广播给 subscribe 连接
  7. 前端关闭 = subscribe SSE 断开，Worker 不受影响
```

### 8.4.2 停止对话

```
  1. 前端 POST /api/sessions/:id/chat/stop
  2. 主线程找到该 session 的 Worker → worker.terminate()
  3. Worker 被终止，streaming_content 中已有的 partial 内容保留
  4. 主线程：将 partial 内容作为 assistant 消息写入 SQLite（标记 stopped: true）
  5. session.status = 'idle'
  6. 广播 message_stop 给 subscribe 连接
```

### 8.4.3 进程重启恢复

```
Fastify 启动（PM2 拉起 / 手动重启）
  │
  └── 扫描 sessions WHERE status = 'streaming'
        │
        ├── 有结果 → 这些会话在上次进程退出时中断了
        │     选项 A（推荐）：标记为 failed，让用户手动重试
        │     选项 B：重新创建 Worker，从 streaming_content 续传
        │
        └── 无结果 → 正常启动，无需恢复
```

### 8.4.4 Worker Thread 架构图

```
┌──────────────────────────────────────────────────────────────┐
│  Fastify 主线程（PM2 守护）                                    │
│                                                              │
│  ├── HTTP 路由                                                │
│  │   ├── POST /chat/stream    → streamHub.startWorker()      │
│  │   ├── GET  /chat/subscribe → streamHub.subscribe()        │
│  │   └── POST /chat/stop      → streamHub.stopWorker()       │
│  │                                                           │
│  ├── StreamHub（主线程内存）                                    │
│  │   ├── activeWorkers: Map<sessionId, Worker>               │
│  │   ├── emitters: Map<sessionId, EventEmitter>              │
│  │   ├── on worker postMessage → emit to subscribe 连接       │
│  │   └── on worker exit → cleanup + status update            │
│  │                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Worker A │  │ Worker B │  │ Worker C │                   │
│  │ session-1│  │ session-2│  │ session-3│                   │
│  │ MiniMax↔ │  │ MiniMax↔ │  │ MiniMax↔ │                   │
│  │ SQLite↓  │  │ SQLite↓  │  │ SQLite↓  │                   │
│  │ postMsg↑ │  │ postMsg↑ │  │ postMsg↑ │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### 8.4.5 后台长任务

```
浏览器端：
  1. POST /api/tasks  →  { taskId: "abc123" }    (立即返回)
  2. 用户可以关闭浏览器
  3. 再次打开浏览器
  4. GET /api/tasks/abc123  →  { status: "completed", result: "..." }

服务端：
  1. 收到任务请求，入队，返回 taskId
  2. Worker Thread 执行长时间任务
  3. 将结果存入内存（后续可扩展为数据库）
  4. 浏览器关闭不影响，PM2 保证进程永远存活
```

### 8.4.6 模式对比

| 特性 | 普通对话 | 后台长任务 |
|------|---------|----------|
| 执行方式 | Worker Thread | Worker Thread / 内存队列 |
| 触发 | POST `/chat/stream` | POST `/api/tasks` |
| 前端实时查看 | SSE subscribe | GET 轮询 |
| 前端断开 | 不影响 Worker | 不影响执行 |
| 停止 | `worker.terminate()` 保留 partial | `task.cancel()` |
| 进度持久化 | session.streaming_content (SQLite) | Task.status |
| 重连恢复 | subscribe 追赶缓冲 | 轮询最新状态 |
| 崩溃隔离 | Worker 崩不影响主线程 | Worker 崩不影响主线程 |

```typescript
// packages/backend/src/lib/task-queue.ts
interface Task {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: number;
}

class TaskQueue {
  private tasks = new Map<string, Task>();

  submit(id: string, executor: () => Promise<string>): Task {
    const task: Task = { id, status: 'pending', createdAt: Date.now() };
    this.tasks.set(id, task);

    setImmediate(async () => {
      task.status = 'running';
      try {
        task.result = await executor();
        task.status = 'completed';
      } catch (err) {
        task.error = String(err);
        task.status = 'failed';
      }
    });

    return task;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }
}

export const taskQueue = new TaskQueue();
```

## 8.5 优雅关闭

```typescript
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    await fastify.close();
    fastify.log.info('Server closed');
    process.exit(0);
  });
}
```

## 8.6 可选进阶：Docker 容器化

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/frontend/out ./frontend-out
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/backend/package.json ./
EXPOSE 4800
CMD ["node", "dist/index.js"]
```
