# 2. 系统架构图

## 2.1 单进程一体化架构（核心）

```mermaid
block-beta
  columns 1

  block:pm2["PM2 守护进程"]
    columns 1

    block:fastify["Fastify 单进程 :4800"]
      columns 2

      block:static["@fastify/static\n托管 Next.js 静态导出 (out/)"]
        columns 1
        s1["GET / → index.html (SPA 入口)"]
        s2["GET /_next/* → 静态资源"]
      end

      block:api["API 路由"]
        columns 1
        a1["GET/POST /api/sessions"]
        a2["GET/DELETE /api/sessions/:id"]
        a3["POST /chat/stream → 发起流式"]
        a4["GET /chat/subscribe → 订阅流"]
        a5["POST /chat/stop → 停止流式"]
        a6["GET /api/models · /api/health"]
        a7["POST /api/tasks → 后台任务"]
      end

      block:sqlite["SQLite 存储层 (better-sqlite3)\ndata/yishan.db"]
        columns 2
        t1["sessions\nUUID PK · title · model\nstatus · streaming_content"]
        t2["messages\nUUID PK · session FK\nrole · content (JSON)"]
      end

      block:worker["Worker Thread 管理器\nactiveWorkers: Map‹sessionId, Worker›"]
        columns 1
        w1["每个流式对话 = 一个 Worker Thread"]
        w2["Worker → MiniMax API → SQLite → postMessage → 主线程 → SSE"]
        w3["停止 = worker.terminate() · 重启 = 扫 status=streaming"]
      end

    end
  end

  minimax["MiniMax API\napi.minimaxi.com/anthropic/v1"]

  fastify --> minimax
```

## 2.2 构建流程

```mermaid
flowchart TD
  subgraph mono["pnpm workspace (monorepo)"]
    subgraph fe["packages/frontend"]
      fe1["Next.js + shadcn/ui + Tailwind"]
    end
    subgraph be["packages/backend"]
      be1["Fastify + AI Client + Worker Threads"]
    end
    subgraph sh["shared/"]
      sh1["TypeScript 类型 & zod 校验"]
    end

    fe1 -->|"next build --output export"| out["out/ (纯静态 HTML/CSS/JS)"]
    be1 -->|"tsc"| dist["dist/index.js"]
    sh1 -->|"import"| fe1
    sh1 -->|"import"| be1
  end

  out --> deploy["packages/backend/dist/\n+ packages/frontend/out/"]
  dist --> deploy
  deploy -->|"pm2 start"| run["单进程运行\nhttp://localhost:4800"]
```

## 2.3 数据流

### 2.3.1 页面加载 & 会话管理

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant F as Fastify :4800
  participant DB as SQLite

  B->>F: GET /
  F-->>B: @fastify/static → index.html

  B->>F: GET /_next/static/*
  F-->>B: 静态资源 (JS/CSS)

  B->>F: GET /api/sessions
  F->>DB: SELECT * FROM sessions
  DB-->>F: rows
  F-->>B: Session[]

  B->>F: POST /api/sessions {model}
  F->>DB: INSERT INTO sessions (UUID)
  DB-->>F: ok
  F-->>B: {id, title: "新对话", ...}
```

### 2.3.2 流式对话（后端独立执行 + 前端订阅）

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant F as Fastify 主线程
  participant W as Worker Thread
  participant M as MiniMax API
  participant DB as SQLite

  B->>F: POST /chat/stream {content}
  F->>DB: INSERT user message
  F->>DB: session.status = 'streaming'
  F->>W: 创建 Worker Thread
  F-->>B: {ok: true} (立即返回)

  Note over B: 前端可随时关闭<br/>不影响 Worker 继续

  W->>M: Anthropic SDK stream
  loop 逐 chunk
    M-->>W: delta
    W->>DB: appendStreamingContent
    W->>F: postMessage(delta)
  end

  B->>F: GET /chat/subscribe (SSE)
  F-->>B: content_catchup (追赶缓冲)
  F-->>B: content_block_delta
  F-->>B: content_block_delta

  M-->>W: stream 结束
  W->>DB: INSERT assistant message
  W->>DB: status = 'idle', CLEAR streaming_content
  W->>F: postMessage(done)
  F-->>B: message_stop
```

### 2.3.3 停止对话 & 刷新恢复

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant F as Fastify 主线程
  participant W as Worker Thread
  participant DB as SQLite

  Note over B,W: 停止场景
  B->>F: POST /chat/stop
  F->>W: worker.terminate()
  destroy W
  F->>DB: 保存 partial 为 assistant 消息 (stopped)
  F->>DB: status = 'idle'
  F-->>B: {ok: true, aborted: true}

  Note over B,DB: 刷新/重开恢复场景
  B->>F: GET /api/sessions/:id
  F->>DB: SELECT session + messages
  DB-->>F: {status: 'streaming', streamingContent: '...'}
  F-->>B: session + messages + streamingContent

  B->>F: GET /chat/subscribe (自动重连)
  F-->>B: content_catchup (追赶已缓冲内容)
  F-->>B: content_block_delta (继续实时接收)
```

### 2.3.4 Plan / Build 模式

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant F as Fastify
  participant W as Worker Thread
  participant M as MiniMax API
  participant DB as SQLite

  Note over B,M: Plan 阶段 —— AI 只输出步骤，不执行
  B->>F: POST /chat/stream?mode=plan {content}
  F->>W: 创建 Worker
  F-->>B: {ok: true}

  B->>F: GET /chat/subscribe
  W->>M: stream (plan mode)
  M-->>W: plan steps
  W->>F: postMessage(plan_step)
  F-->>B: SSE: plan_step
  F-->>B: SSE: plan_step
  F-->>B: SSE: plan_complete
  W->>DB: INSERT plan message

  Note over B,M: Build 阶段 —— 用户确认后逐步执行
  B->>F: POST /plan/:planId/approve {steps}
  F->>W: 创建 Worker (build mode)
  F-->>B: {ok: true}

  B->>F: GET /chat/subscribe
  loop 逐步执行
    W->>M: 工具调用
    M-->>W: 工具结果
    W->>F: postMessage(build_step_start)
    F-->>B: SSE: build_step_start
    W->>F: postMessage(build_step_done)
    F-->>B: SSE: build_step_done
  end
  F-->>B: SSE: build_complete
  W->>DB: INSERT build_result message
```

### 2.3.5 后台任务

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant F as Fastify
  participant W as Worker Thread
  participant DB as SQLite

  B->>F: POST /api/tasks {type, payload}
  F-->>B: {taskId: "abc123"}

  Note over B: 用户可关闭浏览器

  F->>W: 创建 Worker 执行任务
  W->>DB: 执行长时间操作
  W->>F: postMessage(done)

  Note over B: 再次打开浏览器
  B->>F: GET /api/tasks/abc123
  F-->>B: {status: "completed", result: "..."}
```
