# 12. 开发 & 部署流程

## 12.1 技术架构

**前端作为静态资源嵌入后端**，不独立部署。

```
packages/backend/
├── src/plugins/support.ts    # fastifyStatic 托管 public/ 目录
├── public/                  # 前端构建产物（.next 输出）
└── dist/                    # 后端编译产物
```

## 12.2 开发模式

```bash
nvm use 22
pnpm install

pnpm dev:frontend
pnpm dev:backend
```

开发环境前端 `:4810` 通过 http-proxy 代理 API 请求到 `:4800`，避免 CORS 问题。

## 12.3 生产构建

```bash
pnpm build
```

构建流程（`packages/backend/package.json`）：

```json
{
  "scripts": {
    "build": "prisma generate && npm run build:ts && node scripts/copy-frontend.js"
  }
}
```

1. `prisma generate` - 生成 Prisma Client
2. `npm run build:ts` - 编译 TypeScript 到 `dist/`
3. `node scripts/copy-frontend.js` - 构建前端并复制到 `public/`

`copy-frontend.js` 脚本：
- 构建前端 `pnpm build`（位于 `packages/frontend/`）
- 复制 `.next/` 的 static、BUILD_ID、HTML 文件到 `packages/backend/public/`

## 12.4 生产部署

```bash
pnpm build
pm2 start packages/backend/ecosystem.config.cjs
pm2 save
pm2 startup
```

**注意**：只需构建和部署后端，前端已嵌入其中。修改前端代码后，必须重新 `pnpm build`（后端）以更新 `public/` 目录。

## 12.5 快速更新前端

如只需更新前端而不需要完整构建：

```bash
# 1. 构建前端
cd packages/frontend && npm run build

# 2. 复制到后端 public/
rm -rf packages/backend/public/*
cp -r packages/frontend/.next packages/backend/public/
cp packages/frontend/.next/BUILD_ID packages/backend/public/

# 3. 重建后端（TypeScript 编译 + 复制产物到 dist/）
cd packages/backend && npm run build:ts

# 4. 重启 PM2
pm2 restart yishan-ai
```
