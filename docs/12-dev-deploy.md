# 12. 开发 & 部署流程

## 12.1 开发模式

```bash
nvm use 22
pnpm install

pnpm dev:frontend
pnpm dev:backend
```

开发环境前端 `:4810` 通过 http-proxy 代理 API 请求到 `:4800`，避免 CORS 问题。

## 12.2 生产构建

```bash
pnpm build
```

```json
// package.json (workspace root)
{
  "scripts": {
    "dev:frontend": "pnpm --filter @yishan-ai/frontend dev",
    "dev:backend": "pnpm --filter @yishan-ai/backend dev",
    "build": "pnpm --filter @yishan-ai/shared build && pnpm --filter @yishan-ai/frontend build && pnpm --filter @yishan-ai/backend build",
    "start": "pm2 start packages/backend/ecosystem.config.cjs"
  }
}
```

## 12.3 生产部署

```bash
pnpm build
pm2 start packages/backend/ecosystem.config.cjs
pm2 save
pm2 startup
```
