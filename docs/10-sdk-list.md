# 10. SDK 依赖清单

## 10.1 前端依赖

| 包名 | 版本 | 用途 | 许可证 |
|------|------|------|--------|
| `next` | @latest | 前端框架（静态导出模式） | MIT |
| `react` | @latest | UI 运行时 | MIT |
| `react-dom` | @latest | React DOM 渲染 | MIT |
| `tailwindcss` | @latest | 原子化 CSS | MIT |
| `lucide-react` | @latest | SVG 图标库 (1000+ 图标) | ISC |
| `zustand` | @latest | 轻量级全局状态管理 | MIT |
| `react-markdown` | @latest | Markdown 渲染 | MIT |
| `rehype-highlight` | @latest | 代码块语法高亮 | MIT |
| `remark-gfm` | @latest | GFM 表格/任务列表支持 | MIT |
| `@radix-ui/*` | @latest | 无障碍 UI 原语 | MIT |
| `class-variance-authority` | @latest | 组件变体管理 | Apache-2.0 |
| `clsx` | @latest | 条件 className | MIT |
| `tailwind-merge` | @latest | 智能合并 Tailwind 类 | MIT |

## 10.2 后端依赖

| 包名 | 版本 | 用途 | 许可证 |
|------|------|------|--------|
| `fastify` | @latest | HTTP 框架 | MIT |
| `@fastify/static` | @latest | 静态文件托管（核心） | MIT |
| `@fastify/cors` | @latest | CORS 中间件 | MIT |
| `@fastify/env` | @latest | 环境变量校验 | MIT |
| `@fastify/rate-limit` | @latest | API 限流 | MIT |
| `@anthropic-ai/sdk` | @latest | MiniMax API 客户端 | MIT |
| `better-sqlite3` | @latest | SQLite 嵌入式数据库 | MIT |
| `fastify-cli` | @latest | Fastify 开发模式 CLI（热重载） | MIT |

## 10.3 共享 & 开发依赖

| 包名 | 版本 | 用途 | 许可证 |
|------|------|------|--------|
| `zod` | @latest | 运行时校验（前后端共享） | MIT |
| `typescript` | @latest | 全栈类型安全 | Apache-2.0 |
| `tsx` | @latest | 开发环境 TS 直接执行 | MIT |
| `pm2` | @latest | 生产环境进程守护 | AGPL-3.0 |
