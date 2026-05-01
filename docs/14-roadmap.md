# 14. 后续扩展方向

| 方向 | 技术方案 | 详情 |
|------|---------|------|
| 多模型切换 | 前端下拉选择模型，后端按 model 路由到不同 provider | |
| 系统提示词 | 每个会话可配置 system prompt，存储在 sessions 表 | |
| Tool Use | MiniMax 支持 Anthropic 工具格式，后端实现工具执行器 | |
| MCP 协议 | 从 hello-minimax 迁移 MCP 客户端，支持外部工具服务 | [16-mcp-skills.md](16-mcp-skills.md) |
| 上下文压缩 | 从 hello-minimax 迁移 3 层压缩策略（输出截断 → 工具裁剪 → LLM 摘要） | |
| 用户认证 | `@fastify/jwt` / `@fastify/cookie`，sessions 表加 `user_id` 字段 | |
| 全文搜索 | SQLite FTS5 扩展，对消息内容建立全文索引 | |
| 数据导出 | 导出为 Markdown / JSON，支持按会话 / 按日期范围导出 | |
| 文件上传 | `@fastify/multipart`，上传文件作为对话上下文 | |
| 国际化 | next-intl，支持中/英文界面 | |
