# 9. TypeScript 全栈类型安全

## 9.1 共享类型模块（shared）

```typescript
// shared/src/schemas.ts
import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
});

export const ChatResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
  }),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
```

## 9.2 类型流转链路

```
[前端] 用户输入
  │
  ▼  ChatRequest (shared type)
[前端] fetch('/api/chat', { body: ChatRequest })
  │
  ▼  HTTP JSON
[后端] ChatRequestSchema.parse(request.body)
  │
  ▼  Anthropic.Messages.MessageCreateParams (SDK type)
[后端] anthropic.messages.create(params)
  │
  ▼  Anthropic.Messages.Message (SDK type)
[后端] 转换为 ChatResponse (shared type)
  │
  ▼  HTTP JSON
[前端] response.json() as ChatResponse
  │
  ▼  渲染到 UI
```

## 9.3 环境变量类型声明

```typescript
// packages/backend/src/types/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    MINIMAX_API_KEY: string;
    MINIMAX_BASE_URL: string;
    DEFAULT_MODEL: string;
  }
}
```
