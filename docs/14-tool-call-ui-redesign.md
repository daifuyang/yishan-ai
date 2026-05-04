# Tool Call UI 重构方案

> 基于 OpenCode 源码分析，结合项目实际情况制定的重构计划

## 一、现状分析

### 1.1 当前问题

| 问题 | 位置 | 影响 |
|------|------|------|
| 每个 tool_use 单独渲染 | `message-list.tsx:161-163` | 50+ tool calls = 50+ 独立块 |
| `ToolCallBlock` 组件未使用 | 组件已存在但被忽略 | 浪费已有代码 |
| `ToolUseCard` 简陋 | `message-list.tsx:89-134` | 无状态图标、无复制、无动画 |
| toolCalls 未在 streaming 时填充 | `chat-store.ts` | 数据不一致 |
| 硬编码中文 | 多处 | 无法国际化 |

### 1.2 当前数据结构

```typescript
// message.content 结构
content: [
  { type: 'text', text: '...' },
  { type: 'tool_use', name: 'bash', input: {...}, result: '...' },  // 每个单独渲染
  { type: 'tool_use', name: 'bash', input: {...}, result: '...' },
  ...
]
```

### 1.3 OpenCode 对比分析

参考 `packages/opensource/opencode/packages/ui/src/components/message-part.tsx` 和相关组件：

| 特性 | OpenCode | yishan-ai |
|-------|----------|------------|
| 聚合展示 | `ContextToolGroup` 聚合同类 tools | ❌ 每个 tool_use 单独渲染 |
| 折叠动画 | `BasicTool` + `Collapsible` | ⚠️ 有展开/收起但无动画 |
| 状态指示 | `AnimatedCountList` + `ToolStatusTitle` | ❌ 只有静态 badge |
| 分类统计 | read/search/list 分开统计 | ❌ 只显示 "使用了 N 个工具" |
| 错误卡片 | `ToolErrorCard` 独立展示 | ⚠️ 混在 tool_use 块中 |
| i18n | 完整 i18n 支持 | ❌ 硬编码中文 |

---

## 二、目标设计

### 2.1 聚合展示效果

```
Before:
┌─────────────────────────────────────────┐
│ [Bot Avatar]                            │
│ 消息文本...                              │
│ ┌─────────────────────────────────────┐│
│ │ [使用了 1 个工具] [bash] [展开▼]     ││
│ └─────────────────────────────────────┘│
│ ┌─────────────────────────────────────┐│
│ │ [使用了 1 个工具] [bash] [展开▼]     ││  ← 每个单独渲染
│ └─────────────────────────────────────┘│
│ ... (重复 N 次)                         │
└─────────────────────────────────────────┘

After:
┌─────────────────────────────────────────┐
│ [Bot Avatar]                            │
│ 消息文本...                              │
│ ┌─────────────────────────────────────┐│
│ │ 🔧 Shell  ✓ 23 完成 / ✗ 2 失败      ││
│ │                          [查看详情 ▼] ││
│ └─────────────────────────────────────┘│
│                                          ↓ 点击展开
│ ┌─────────────────────────────────────┐│
│ │ bash: ls -la ~/projects        ✓   ││
│ │ bash: cat收纳系统规划.md         ✓   ││
│ │ bash: npm install --legacy      ✗   ││
│ │ ...                                ││
│ └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### 2.2 分类聚合效果（类似 OpenCode ContextToolGroup）

```
┌─────────────────────────────────────────────────────────────┐
│ 📖 3 reads  🔍 2 searches  📁 1 list  ⚡ 1 shell        │
│                                                     [▼]    │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、重构规划（分 4 个 Phase）

### Phase 1: 数据流修复

**目标**: 确保 toolCalls 在 streaming 时也能正确填充

| 步骤 | 文件 | 操作 |
|------|------|------|
| 1.1 | `chat-store.ts` | 在 `handleToolCall` 时同步填充 `message.toolCalls` 数组 |
| 1.2 | `chat-store.ts` | 在 `handleToolResult`/`handleToolError` 时更新对应 toolCall 的 status |
| 1.3 | `chat-store.ts` | 在 `message_stop` 时将所有 pending/running 标记为 completed/error |

**关键代码变更** (`chat-store.ts`):

```typescript
// 新增：streaming 时同步更新 toolCalls
function handleToolCall(sessionId: string, data: { tool: string, args: any }) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const toolCall: ToolCall = {
    id: crypto.randomUUID(),
    name: data.tool,
    input: data.args,
    status: 'running'
  };

  // 同步添加到 message.toolCalls
  if (session.currentMessage) {
    session.currentMessage.toolCalls = session.currentMessage.toolCalls || [];
    session.currentMessage.toolCalls.push(toolCall);
  }
  // ... 原有逻辑
}
```

---

### Phase 2: 统一 ToolCall 接口

**目标**: 消除重复定义，统一数据结构

| 步骤 | 文件 | 操作 |
|------|------|------|
| 2.1 | `tool-call-block.tsx` | 导出 `ToolCall` 类型定义 |
| 2.2 | `chat-store.ts` | 移除重复的 `ToolCall` 接口，使用 `tool-call-block` 导出的 |
| 2.3 | `message-list.tsx` | 导入统一后的 `ToolCall` 类型 |

**统一后的 ToolCall 接口** (`tool-call-block.tsx:6-13`):

```typescript
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  status: "pending" | "running" | "completed" | "error";
}
```

---

### Phase 3: 使用现有 ToolCallBlock 组件

**目标**: 用已有的 `ToolCallBlock` 替换简陋的 `ToolUseCard`

| 步骤 | 文件 | 操作 |
|------|------|------|
| 3.1 | `message-list.tsx` | 导入 `ToolCallBlock` 组件 |
| 3.2 | `message-list.tsx` | 在 `AssistantBubble` 中用 `ToolCallBlock` 替换 `ToolUseCard` |
| 3.3 | `message-list.tsx` | 默认使用 `variant="compact"` |

**关键代码变更** (`message-list.tsx`):

```typescript
// Before
{toolUseBlocks.map((block, idx) => (
  <ToolUseCard key={block.id || idx} block={block} />
))}

// After
{toolUseBlocks.length > 0 && (
  <ToolCallBlock
    toolCalls={contentBlocksToToolCalls(toolUseBlocks)}
    variant="compact"
  />
)}
```

---

### Phase 4: 聚合展示（核心优化）

**目标**: 将同一条消息中的所有 tool calls 聚合为一个组件

| 步骤 | 文件 | 操作 |
|------|------|------|
| 4.1 | `tool-call-block.tsx` | 新增 `ToolCallGroup` 组件，支持同消息多 tool 聚合 |
| 4.2 | `tool-call-block.tsx` | 实现分类统计（read/search/list/shell 分别计数） |
| 4.3 | `tool-call-block.tsx` | 实现展开/折叠详情 |
| 4.4 | `tool-call-block.tsx` | 添加状态图标和动画 |
| 4.5 | `message-list.tsx` | 修改 AssistantBubble 使用 `ToolCallGroup` |

**ToolCallGroup 设计**:

```typescript
// 新增组件：聚合展示多个 tool calls
interface ToolCallGroupProps {
  toolCalls: ToolCall[];
  defaultExpanded?: boolean;
}

// 显示效果：
// ┌─────────────────────────────────────────┐
// │ 🔧 Shell  ✓ 23 / ✗ 2  [查看详情 ▼]     │
// └─────────────────────────────────────────┘
// ↓ 展开后
// ├─ bash: ls -la ~/projects        ✓     │
// ├─ bash: cat 收纳系统规划.md       ✓     │
// ├─ bash: npm install --legacy      ✗     │
// └─ ...
```

---

## 四、详细实施路线图

```
Week 1: Phase 1 + Phase 2
├── Day 1-2: 数据流修复
├── Day 3-4: 统一 ToolCall 接口
└── Day 5: 代码 review

Week 2: Phase 3
├── Day 1-2: 集成 ToolCallBlock 到 message-list
├── Day 3-4: 适配 streaming 状态更新
└── Day 5: 测试

Week 3: Phase 4
├── Day 1-2: 实现 ToolCallGroup 组件
├── Day 3-4: 实现分类统计和展开/折叠
└── Day 5: 动画和状态图标
```

---

## 五、关键文件变更清单

| 文件 | 变更类型 | 影响范围 |
|------|----------|----------|
| `stores/chat-store.ts` | 修改 | 数据流修复、streaming 更新 |
| `components/mcp/tool-call-block.tsx` | 增强 | 新增 ToolCallGroup、分类统计 |
| `components/chat/message-list.tsx` | 重构 | 使用 ToolCallBlock、移除 ToolUseCard |
| `i18n/` (如有) | 新增 | 国际化文本支持 |

---

## 六、风险和注意事项

| 风险 | 缓解措施 |
|------|----------|
| streaming 时 toolCalls 未初始化 | 确保 message 创建时就初始化空数组 |
| 状态更新丢失 | 使用 AbortController 取消时正确清理状态 |
| 性能问题 | 聚合后只渲染一个组件，减少 DOM 节点 |

---

## 七、测试计划

| 测试场景 | 验证点 |
|----------|--------|
| 单个 tool call | 显示正常，展开/折叠正常 |
| 多个 tool calls | 聚合展示，计数正确 |
| streaming 中 | 状态实时更新（pending → completed） |
| 错误处理 | 错误显示红色徽章 |
| 历史消息 | 正确显示已完成状态 |

---

## 八、参考来源

- OpenCode UI 组件: `packages/opensource/opencode/packages/ui/src/components/`
- 关键组件:
  - `message-part.tsx` - 主消息展示
  - `basic-tool.tsx` - 基础 tool 组件
  - `tool-count-summary.tsx` - 计数汇总
  - `tool-status-title.tsx` - 状态标题动画
  - `session-turn.tsx` - 会话回合组件

---

## Changelog

| 日期 | 内容 |
|------|------|
| 2026-05-04 | 初始文档创建，基于 OpenCode 源码分析 |
