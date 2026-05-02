# SSE 调试记录

## 问题描述

前端订阅 `/api/sessions/[id]/chat/subscribe` 返回 `message_stop` 错误，实际流内容丢失。

## 调试思路

### 1. 确认端口架构

```bash
# 检查端口监听
ss -tlnp | grep -E '4800|4810'
```

- **4800**: 后端 (Fastify)
- **4810**: 前端 Next.js 代理层

### 2. 直接测试后端 SSE

```bash
curl -N 'http://localhost:4800/api/sessions/[id]/chat/subscribe' \
  -H 'Accept: text/event-stream' \
  -H 'Cache-Control: no-cache'
```

### 3. 测试 Race Condition

**关键测试**：先订阅 SSE，再发送消息（模拟用户操作顺序）

```bash
# Terminal 1: 先订阅 SSE
curl -N 'http://localhost:4810/api/sessions/[id]/chat/subscribe' \
  -H 'Accept: text/event-stream' \
  -H 'Cache-Control: no-cache' &

sleep 0.3

# Terminal 2: 后发送消息
curl -X POST 'http://localhost:4810/api/sessions/[id]/chat/stream' \
  -H 'Content-Type: application/json' \
  -d '{"content":"hello"}'
```

### 4. 使用 Playwright 自动化测试

```javascript
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:4810/?sessionId=xxx', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Send message and wait
  await page.locator('textarea').first().fill('hello');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(10000);

  await browser.close();
})();
```

## 发现的 Bug

### 1. 前端代理未转发认证 Cookie

**文件**: `packages/frontend/src/app/api/sessions/[id]/chat/subscribe/route.ts`

**问题**: fetch 调用只传递了 `Accept` 和 `Cache-Control` 头，没有转发 Cookie。

**修复**: 添加 cookie header 转发：
```typescript
const cookieHeader = request.headers.get('cookie');
const response = await fetch(backendUrl, {
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control: no-cache',
    ...(cookieHeader && { 'Cookie': cookieHeader }),
  },
});
```

### 2. 未检查后端响应状态

**问题**: 即使后端返回 400/404 错误，前端仍尝试将响应体作为 SSE 解析。

**修复**: 添加状态码检查：
```typescript
if (!response.ok) {
  return new Response(await response.text(), { status: response.status });
}
```

### 3. StreamHub pipeToSSE 使用错误的 sessionId

**文件**: `packages/backend/src/lib/stream-hub.ts:45`

**问题**: `pipeToSSE()` 最初使用 `this.currentSessionId`，而不是请求 URL 中的 sessionId。

**修复**: `pipeToSSE(sessionId, reply, mcpManager)` 现在接收正确的 sessionId 参数。

### 4. Race Condition: SSE 在 stream 开始前订阅

**问题**: 当用户打开页面后立即发送消息，`subscribe()` 可能在 `streamHub.start()` 之前被调用。

**时序问题**:
1. SSE 订阅打开 → `pipeToSSE` 被调用
2. Session 状态是 `idle` → `message_stop` 立即返回
3. `POST /chat/stream` 被调用 → stream 开始（但已错过）

**修复**: 在 `pipeToSSE` 中，当 session 是 `idle` 且 `currentSessionId` 为 null 时，预注册事件监听器并等待 stream 启动：

```typescript
if (session?.status === 'idle' && this.currentSessionId === null) {
  // 预先设置事件监听器
  this.on('delta', onDelta);
  this.on('tool_call', onToolCall);
  this.on('done', onDone);
  this.on('error', onError);

  // 等待 currentSessionId 被设置（即 stream 启动）
  const checkInterval = setInterval(() => {
    if (this.currentSessionId === sessionId) {
      // stream 启动，开始转发事件
      streamStarted = true;
    }
  }, 10);
}
```

### 5. Stream 完成后 currentSessionId 未及时清除

**问题**: stream 完成后 `currentSessionId` 仍指向该 session，直到 worker 退出。

**修复**: 在 `pipeToSSE` 中，如果 session 是 `idle` 但 `currentSessionId === sessionId`，说明 stream 刚结束，直接返回 `message_stop`。

## SSE 事件类型

| 事件类型 | 说明 |
|---------|------|
| `content_block_delta` | 文本增量内容 |
| `message_stop` | 消息结束 |
| `error` | 错误发生 |
| `content_catchup` | 断线重连时的内容追赶 |

## 验证命令

```bash
# 1. Race condition 测试（先订阅，后发送）
curl -N 'http://localhost:4800/api/sessions/[id]/chat/subscribe' \
  -H 'Accept: text/event-stream' --max-time 10 &
sleep 0.3
curl -X POST 'http://localhost:4800/api/sessions/[id]/chat/stream' \
  -H 'Content-Type: application/json' -d '{"content":"hello"}'

# 2. 已完成 session 测试
curl -N 'http://localhost:4800/api/sessions/[id]/chat/subscribe' \
  -H 'Accept: text/event-stream' --max-time 5
# 期望立即返回: data: {"type":"message_stop"}
```
