# Yishan AI — 产品技术架构文档

单进程一体化架构：Fastify + Next.js 静态导出 + MiniMax API + SQLite。

```bash
pnpm build && pm2 start ecosystem.config.cjs
# → http://localhost:4800
```

## 文档索引

| # | 文档 | 内容 |
|---|------|------|
| 01 | [项目概述](docs/01-overview.md) | 核心理念、单进程架构、部署方式 |
| 02 | [系统架构图](docs/02-architecture.md) | 一体化架构图、构建流程图、数据流图 |
| 03 | [端口规划](docs/03-ports.md) | 4800/4810/4820/4830 端口分配 |
| 04 | [技术选型](docs/04-tech-stack.md) | 全栈技术栈总览、关键架构决策 |
| 05 | [MiniMax API 接入](docs/05-minimax-api.md) | Token Plan、模型列表、Anthropic SDK 兼容层 |
| 06 | [项目目录结构](docs/06-directory.md) | monorepo 目录规划 |
| 07 | [数据存储设计](docs/07-database.md) | SQLite 表结构、Store 层、备份恢复 |
| 08 | [后台运行 & 部署](docs/08-deployment.md) | PM2 配置、后台任务队列、Docker |
| 09 | [TypeScript 类型安全](docs/09-typescript.md) | 共享类型、zod schema、类型流转 |
| 10 | [SDK 依赖清单](docs/10-sdk-list.md) | 前端/后端/共享依赖（全部 @latest） |
| 11 | [API & 路由设计](docs/11-api-routes.md) | 后端 API、前端路由、zustand 状态设计 |
| 12 | [开发 & 部署流程](docs/12-dev-deploy.md) | 开发模式、生产构建、PM2 部署 |
| 13 | [安全注意事项](docs/13-security.md) | API Key 保护、限流、CORS |
| 14 | [后续扩展方向](docs/14-roadmap.md) | 多模型、认证、MCP、全文搜索 |
| 15 | [UI 设计规范](docs/15-ui-spec.md) | 布局、空态、消息流、Kimi 风格参考 |
