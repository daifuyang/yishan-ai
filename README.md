# Yishan AI

基于 MiniMax API 的 AI 对话应用，支持流式输出、会话管理和 Plan/Build 双模式。

## 核心特性

- **流式对话** - 实时流式输出，逐字渲染
- **会话管理** - 自动保存对话历史，侧边栏展示会话列表
- **Plan/Build 双模式** - Plan 模式预览执行步骤，Build 模式逐步执行
- **会话恢复** - 刷新页面自动恢复流式输出

## 技术栈

| 分类 | 技术 |
|------|------|
| 前端 | Next.js + shadcn/ui + TailwindCSS + Zustand |
| 后端 | Fastify + better-sqlite3 + Worker Threads |
| AI | Anthropic SDK 兼容层 (MiniMax API) |
| 部署 | PM2 单进程 |

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建并启动
pnpm build
pm2 start packages/backend/ecosystem.config.cjs
```

访问 http://localhost:4800

## 项目结构

```
packages/
├── frontend/          # Next.js 前端应用
│   └── src/
│       ├── app/           # 页面路由
│       ├── components/     # React 组件
│       └── stores/         # Zustand 状态管理
├── backend/           # Fastify 后端服务
│   └── src/
│       ├── routes/         # API 路由
│       ├── stores/         # 数据存储
│       ├── workers/        # Worker Thread
│       └── lib/            # 工具库
└── shared/             # 共享类型和校验
```

## 架构设计

采用**单进程一体化架构**：Fastify 托管 Next.js 静态导出，同时提供 API 服务和后台任务引擎。

```
PM2 → Fastify :4800
         ├── @fastify/static → Next.js 静态文件
         ├── API 路由 → /api/sessions, /api/chat/*
         ├── SQLite → 会话和消息持久化
         └── Worker Threads → MiniMax API 流式调用
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sessions | 获取会话列表 |
| POST | /api/sessions | 创建新会话 |
| GET | /api/sessions/:id | 获取会话详情 |
| DELETE | /api/sessions/:id | 删除会话 |
| POST | /api/sessions/:id/chat/stream | 发起流式对话 |
| GET | /api/sessions/:id/chat/subscribe | 订阅流式输出 (SSE) |
| POST | /api/sessions/:id/chat/stop | 停止流式输出 |

## License

MIT
