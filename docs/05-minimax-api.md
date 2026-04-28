# 5. MiniMax API 接入

## 5.1 环境变量

```bash
# packages/backend/.env
MINIMAX_API_KEY=your_token_plan_key_here
MINIMAX_BASE_URL=https://api.minimaxi.com/anthropic/v1   # 中国区（默认）
DEFAULT_MODEL=MiniMax-M2.7
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MINIMAX_API_KEY` | （必填） | Token Plan Key，在 MiniMax 控制台「接口密钥」→「创建 Token Plan Key」获取 |
| `MINIMAX_BASE_URL` | `https://api.minimaxi.com/anthropic/v1` | 中国区端点；国际区改为 `https://api.minimax.io/anthropic/v1` |
| `DEFAULT_MODEL` | `MiniMax-M2.7` | 默认模型，可在前端切换 |

## 5.2 可用模型

| 模型 | 上下文窗口 | 输出速度 | 说明 |
|------|-----------|---------|------|
| MiniMax-M2.7 | 204,800 | ~60 TPS | 最新旗舰 |
| MiniMax-M2.7-highspeed | 204,800 | ~100 TPS | M2.7 极速版 |
| MiniMax-M2.5 | 204,800 | ~60 TPS | 顶尖性价比 |
| MiniMax-M2.5-highspeed | 204,800 | ~100 TPS | M2.5 极速版 |
| MiniMax-M2.1 | 204,800 | ~60 TPS | 多语言编程 |
| MiniMax-M2.1-highspeed | 204,800 | ~100 TPS | M2.1 极速版 |
| MiniMax-M2 | 204,800 | — | 编码与 Agent |

## 5.3 兼容参数

MiniMax 兼容 Anthropic Messages API，使用 `@anthropic-ai/sdk` 直连。

| 参数 | 状态 | 说明 |
|------|------|------|
| `model` | ✅ | 传入上表模型名称 |
| `messages` | ✅ | 文本 + 工具调用（不支持图像/文档） |
| `max_tokens` | ✅ | 最大生成 token |
| `stream` | ✅ | 流式响应 |
| `system` | ✅ | 系统提示词 |
| `temperature` | ✅ | (0.0, 1.0]，建议 1 |
| `tools` | ✅ | Function Calling |
| `tool_choice` | ✅ | 工具选择策略 |
| `thinking` | ✅ | Interleaved Thinking |
| `top_p` | ✅ | 核采样 |
| `top_k` | ⚠️ 忽略 | |
| `stop_sequences` | ⚠️ 忽略 | |

## 5.4 后端接入代码

```typescript
// packages/backend/src/lib/ai-client.ts
import { Anthropic } from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic/v1',
});

const defaultModel = process.env.DEFAULT_MODEL || 'MiniMax-M2.7';

async function chat(messages, options) {
  return client.messages.create({
    model: options.model || defaultModel,
    max_tokens: options.maxTokens || 4096,
    temperature: 1,
    system: options.systemPrompt,
    messages,
  });
}

async function* chatStream(messages, options) {
  const stream = client.messages.stream({
    model: options.model || defaultModel,
    max_tokens: options.maxTokens || 4096,
    temperature: 1,
    system: options.systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'thinking_delta') {
        yield { type: 'thinking', content: event.delta.thinking };
      } else if (event.delta.type === 'text_delta') {
        yield { type: 'text', content: event.delta.text };
      }
    }
  }
}
```

## 5.5 验证步骤

```bash
# 1. 确认 .env 已配置
cat packages/backend/.env | grep MINIMAX

# 2. 快速测试（curl 直连中国区端点）
curl -X POST https://api.minimaxi.com/anthropic/v1/messages \
  -H "x-api-key: $MINIMAX_API_KEY" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "MiniMax-M2.7",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "ping"}]
  }'

# 预期：返回 JSON，含 content[0].text
```

## 5.6 故障排查

| 现象 | 检查项 |
|------|--------|
| 401 Unauthorized | `MINIMAX_API_KEY` 是否正确，是否为 Token Plan Key（非普通 API Key） |
| 连接超时 | 检查 `MINIMAX_BASE_URL` 是否为中国区端点 `api.minimaxi.com`；海外服务器改用 `api.minimax.io` |
| 模型不存在 | 检查 `DEFAULT_MODEL` 拼写，参考 §5.2 模型列表 |
| 流式无响应 | 确认请求参数含 `"stream": true`，Anthropic SDK 的 `.stream()` 方法自动处理 |
