# 4. 技术选型

## 4.1 技术栈总览（所有 SDK 使用 @latest，不锁版本）

| 分类 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **运行时** | Node.js | 22 LTS | 全栈运行时，支持原生 ESM、fetch、WebStreams |
| **包管理** | pnpm | @latest | workspace monorepo 管理 |
| **前端框架** | next | @latest | 静态导出 SPA（`output: 'export'`） |
| **UI 组件** | shadcn/ui | @latest | 基于 Radix UI 的可定制组件 |
| **CSS** | tailwindcss | @latest | 原子化 CSS 框架 |
| **图标** | lucide-react | @latest | 开源 SVG 图标库 |
| **状态管理** | zustand | @latest | 轻量级全局状态管理 |
| **Markdown** | react-markdown | @latest | Markdown 渲染 |
| **代码高亮** | rehype-highlight | @latest | 代码块语法高亮 |
| **GFM** | remark-gfm | @latest | GFM 表格/任务列表支持 |
| **后端框架** | fastify | @latest | 高性能 HTTP 框架 |
| **静态托管** | @fastify/static | @latest | 托管 Next.js 静态导出（核心） |
| **AI SDK** | @anthropic-ai/sdk | @latest | MiniMax API 客户端（Anthropic 兼容层） |
| **校验** | zod | @latest | TypeScript-first 运行时校验 |
| **语言** | typescript | @latest | 全栈类型安全 |
| **进程管理** | pm2 | @latest | 生产环境守护进程 |
| **开发工具** | tsx | @latest | 开发环境 TypeScript 直接执行 |
| **CORS** | @fastify/cors | @latest | 跨域（仅开发环境需要） |
| **环境变量** | @fastify/env | @latest | .env 加载 + schema 校验 |
| **限流** | @fastify/rate-limit | @latest | API 限流保护 |
| **数据库** | better-sqlite3 | @latest | SQLite 嵌入式数据库（会话 + 消息持久化） |

## 4.2 关键架构决策

### Next.js 静态导出（`output: 'export'`）

Next.js 静态导出将前端编译为纯 HTML/CSS/JS 文件，无需 Node.js 运行时：

```javascript
// packages/frontend/next.config.js
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
```

构建后生成 `out/` 目录，由 Fastify 的 `@fastify/static` 直接托管。

### Fastify 托管静态文件 + SPA 回退

```typescript
// packages/backend/src/plugins/static.ts
import fastifyStatic from '@fastify/static';
import path from 'node:path';

const FRONTEND_DIR = path.resolve(import.meta.dirname, '../../frontend/out');

export async function registerStatic(fastify) {
  await fastify.register(fastifyStatic, {
    root: FRONTEND_DIR,
    prefix: '/',
    decorateReply: true,
    wildcard: false,
  });

  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found' });
    }
    return reply.sendFile('index.html');
  });
}
```
