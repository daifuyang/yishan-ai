# 1. 项目概述

Yishan AI 是一个基于 pnpm workspace 的全栈 AI 应用，采用 **单进程一体化架构**：Fastify 后端通过 `@fastify/static` 托管 Next.js 静态导出的 Web 界面，同时提供 API 服务和后台任务引擎。通过 Anthropic SDK 兼容层快速接入 MiniMax API（Token Plan），实现高性价比的 AI 对话能力。

**核心设计理念：一个进程 = Web 界面 + API 服务 + 后台任务，像 CLI 工具一样简单部署。**

```bash
pnpm build && pm2 start ecosystem.config.cjs
# 搞定！打开 http://localhost:4800 即可使用
```

关闭浏览器不影响后端运行，后台任务持续执行。PM2 守护进程保证服务永不停机。所有 SDK 依赖使用 `@latest` 版本，不锁版本号。
