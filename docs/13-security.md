# 13. 安全注意事项

| 安全措施 | 实现方式 |
|----------|---------|
| API Key 保护 | `.env` 存储，`.gitignore` 排除，仅后端访问 |
| 请求校验 | zod schema 校验所有入参 |
| 限流保护 | `@fastify/rate-limit`，默认 100 req/min |
| CORS 控制 | 生产环境不启用 CORS（同源），开发环境 `@fastify/cors` |
| 环境隔离 | `.env.example` 仅含变量名，不含实际值 |
| 依赖安全 | `pnpm audit` 定期检查依赖漏洞 |
| 进程隔离 | PM2 管理，OOM 自动重启 (max_memory_restart: 512M) |
