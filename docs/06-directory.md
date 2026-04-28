# 6. 项目目录结构

```
yishan-ai/
├── package.json                  # workspace 根配置
├── pnpm-workspace.yaml           # pnpm workspace 声明
├── .nvmrc                        # Node.js 22
├── .gitignore
├── ARCHITECTURE.md               # 文档索引
├── docs/                         # 详细文档
│
├── shared/                       # 共享 TypeScript 模块
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # 统一导出
│       ├── types.ts              # 共享类型定义
│       └── schemas.ts            # zod 校验 schema
│
├── packages/
│   ├── frontend/                 # Next.js 前端（静态导出）
│   │   ├── package.json
│   │   ├── next.config.js        # output: 'export' ← 关键配置
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── components.json       # shadcn/ui 配置
│   │   ├── out/                  # ← 构建产物（纯静态 HTML/CSS/JS）
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx    # 全局布局（sidebar + 内容区）
│   │       │   ├── page.tsx      # / 入口（重定向到最近会话）
│   │       │   ├── chat/
│   │       │   │   └── [sessionId]/
│   │       │   │       └── page.tsx  # /chat/:sessionId 会话页
│   │       │   └── globals.css
│   │       ├── components/
│   │       │   ├── ui/           # shadcn/ui 组件
│   │       │   └── chat/         # 业务组件
│   │       ├── stores/
│   │       │   ├── session-store.ts  # 会话列表状态
│   │       │   └── chat-store.ts     # 当前对话状态（消息、流式）
│   │       ├── lib/
│   │       │   └── utils.ts
│   │       └── hooks/
│   │
│   └── backend/                  # Fastify 后端（单进程一体化）
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       ├── ecosystem.config.cjs  # PM2 配置
│       ├── data/                 # ← 运行时数据目录
│       │   └── yishan.db        #    SQLite 数据库文件
│       └── src/
│           ├── index.ts          # 入口：Fastify + static + API
│           ├── db/
│           │   ├── index.ts      # SQLite 连接 + 初始化
│           │   └── migrations.ts # 表结构迁移脚本
│           ├── stores/
│           │   ├── session-store.ts  # 会话 CRUD
│           │   └── message-store.ts  # 消息 CRUD
│           ├── routes/
│           │   ├── chat.ts       # /api/chat 对话路由
│           │   ├── sessions.ts   # /api/sessions 会话管理
│           │   ├── tasks.ts      # /api/tasks 后台任务路由
│           │   └── health.ts     # /api/health 健康检查
│           ├── lib/
│           │   ├── ai-client.ts  # MiniMax/Anthropic SDK 封装
│           │   ├── stream-hub.ts # Worker 管理器 + SSE 广播
│           │   └── task-queue.ts # 后台任务队列
│           ├── workers/
│           │   └── chat-stream.worker.ts  # 流式对话 Worker Thread
│           ├── plugins/
│           │   ├── static.ts     # @fastify/static 托管前端
│           │   └── cors.ts       # CORS（仅开发环境）
│           └── types/
│               └── env.d.ts      # 环境变量类型
```
