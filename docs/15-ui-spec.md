# 15. UI 设计规范

## 15.1 整体布局

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─────┐                                                           │
│  │  ◇  │  Yishan AI    [PanelLeft]                                │
│  │ Logo│  + 新建对话                                               │
│  └─────┘                                                           │
│  ─────────────────────────────────────────────────────────────     │
│  历史会话                                                           │
│  ─────────────────────────────────────────────────────────────     │
│  ▌会话标题 1                                                       │
│    会话标题 2                                                       │
│    会话标题 3                                                       │
│    ...                                                             │
│                                                                     │
│  ─────────────────────────────────────────────────────────────     │
│  查看历史 (History icon)                                            │
│  设置                                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 侧边栏折叠模式

侧边栏采用 **offcanvas** 模式：
- 默认展开，显示完整内容
- 折叠后完全消失，悬浮出现展开按钮（PanelRight 图标）
- 展开按钮位于左上角 logo 位置

## 15.2 左侧栏结构

```
┌──────────────────────┐
│  ◇ Yishan AI  [◀]  │  ← Logo + 标题 + 折叠按钮
├──────────────────────┤
│  + 新建对话          │  ← Button (outline + MessageCirclePlus)
├──────────────────────┤
│  历史会话             │  ← 分组标题（带 History 图标）
│  ─────────────────  │
│  ▌会话标题 (选中)    │  ← 左侧黑色边框表示选中态
│    会话标题          │
│    ...              │  ← 默认显示 10 条
├──────────────────────┤
│  查看历史 (History)  │  ← 跳转 /history
├──────────────────────┤
│  设置                │
└──────────────────────┘
```

### 折叠/展开状态

| 项 | 展开态 | 折叠态 |
|----|--------|--------|
| Logo 标题 | 显示 | 隐藏 |
| 新建对话 | 显示 | 隐藏 |
| 历史会话标题 | 显示 | 隐藏 |
| 会话列表 | 显示（可滚动） | 隐藏 |
| 查看历史 | 显示 | 隐藏 |
| 设置 | 显示 | 隐藏 |
| 展开按钮 | 隐藏 | 显示（悬浮） |

## 15.2.1 历史会话页面 (/history)

```
┌──────────────────────────────┬────────────────────────────┐
│  ← 返回    历史会话 (36)     │                          │
├──────────────────────────────┤                          │
│  🔍 搜索会话...              │                          │
├──────────────────────────────┤                          │
│  会话标题 1            [🗑] │                          │
│  会话标题 2            [🗑] │                          │
│  会话标题 3            [🗑] │                          │
│  ...                      │                          │
└──────────────────────────────┴────────────────────────────┘
```

特性：
- 搜索：实时过滤会话标题
- 删除：hover 显示删除按钮
- 返回：返回首页

## 15.3 空态页面（无会话时）

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                         ◇                                           │
│                      Yishan AI                                      │
│                                                                     │
│                  ┌─────────────────────┐                           │
│                  │  MessageSquare icon  │                           │
│                  │                     │                           │
│                  │  "开始一段新对话"     │                           │
│                  └─────────────────────┘                           │
│                                                                     │
│  ┌─ Textarea ─────────────────────────────────────────────────┐  │
│  │ 输入消息...                                                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [Plan|Build]        [MiniMax-M2.7 ▼]           [发送 ▶]         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

输入即创建：用户输入 → POST `/api/sessions` → `router.push(/chat/${id})` → 自动发送第一条消息。

## 15.4 输入区详细设计

```
┌─────────────────────────────────────────────────────────────────┐
│  Textarea (自适应高度，1~6 行)                                    │
│  输入消息... Shift+Enter 换行                                     │
└─────────────────────────────────────────────────────────────────┘
┌──────────────┐                    ┌──────────────┐ ┌──────────┐
│ ToggleGroup  │                    │   Select     │ │  Button  │
│ [Plan][Build]│                    │ MiniMax-M2.7▼│ │  发送 ▶  │
└──────────────┘                    └──────────────┘ └──────────┘
  左侧：模式切换                       中右：模型选择     右侧：发送
```

| 控件 | shadcn 组件 | 行为 |
|------|------------|------|
| 模式切换 | `ToggleGroup` + `ToggleGroupItem` | Plan / Build 二选一，默认 Build |
| 模型选择 | `Select` + `SelectGroup` + `SelectItem` | 从 `/api/models` 加载列表 |
| 发送按钮 | `Button` | 流式中变为"停止"按钮（`Square` icon） |
| 输入框 | `Textarea` | 自适应高度，Enter 发送，Shift+Enter 换行 |

**流式输出时输入区状态：**

```
┌─────────────────────────────────────────────────────────────────┐
│  (输入框 disabled，显示 placeholder "AI 正在回复...")              │
└─────────────────────────────────────────────────────────────────┘
┌──────────────┐                    ┌──────────────┐ ┌──────────┐
│ [Plan][Build]│                    │ MiniMax-M2.7▼│ │  ■ 停止  │
│  (disabled)  │                    │  (disabled)  │ │  outline │
└──────────────┘                    └──────────────┘ └──────────┘
```

## 15.5 shadcn 组件映射表

### 全局布局

| UI 区域 | shadcn 组件 | 用途 |
|---------|------------|------|
| 侧边栏容器 | `Sidebar` collapsible="offcanvas" | offcanvas 折叠模式 |
| 侧边栏内容 | `AppSidebar` (自定义) | Logo + 新建 + 会话列表 + 底部按钮 |
| 主内容区 | `SidebarInset` | 包裹页面内容 |
| 悬浮展开按钮 | `FloatingExpandIcon` (自定义) | 折叠后左上角悬浮 |
| 深色模式 | 语义色 `bg-background` `text-foreground` | 自动适配 |

### 消息区域

| UI 区域 | shadcn 组件 | 用途 |
|---------|------------|------|
| 消息列表滚动 | `ScrollArea` | 自定义滚动条，自动滚到底部 |
| 思考过程折叠 | `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` | 展开/收起 AI 推理链路 |
| 流式加载骨架 | `Skeleton` | 等待 AI 响应时的占位 |
| 代码块复制 | `Button` variant="ghost" + `Tooltip` | 代码块右上角复制按钮 |
| 空状态 | `Empty` | 无会话时的引导页 |

### Plan / Build 步骤卡片

| UI 区域 | shadcn 组件 | 用途 |
|---------|------------|------|
| 步骤列表容器 | `Card` + `CardHeader` + `CardContent` | 包裹整个 plan |
| 单步骤条目 | `div` + `Badge` + `Button` ghost | 步骤描述 + 状态标签 + 操作按钮 |
| 步骤状态 | `Badge` variant | pending=secondary, running=default, done=outline, failed=destructive |
| 执行按钮 | `Button` | "执行全部"（plan 卡片底部） |
| 步骤详情展开 | `Collapsible` | 展开查看命令/文件详情 |

### 输入区域

| UI 区域 | shadcn 组件 | 用途 |
|---------|------------|------|
| 消息输入 | `Textarea` | 自适应高度 1~6 行，Shift+Enter 换行 |
| 模式切换 | `ToggleGroup` + `ToggleGroupItem` | Plan / Build 切换 |
| 模型选择 | `Select` + `SelectGroup` + `SelectItem` | 模型下拉 |
| 发送按钮 | `Button` + lucide `SendHorizonal` / `Square` | 发送/停止 |
| 通知提示 | `sonner` toast | 操作成功/失败提示 |

### 会话管理

| UI 区域 | shadcn 组件 | 用途 |
|---------|------------|------|
| 会话操作菜单 | `DropdownMenu` + `DropdownMenuGroup` + `DropdownMenuItem` | ··· → 重命名/删除 |
| 重命名对话框 | `Dialog` + `DialogTitle` + `DialogContent` | 输入新标题 |
| 删除确认 | `AlertDialog` | 二次确认 |
| 搜索会话 | `Command` inside `Dialog` | 全局搜索面板 |

## 15.6 组件树

```tsx
<ChatLayout>                    // 共享布局组件
  <Sidebar collapsible="offcanvas">
    <AppSidebar>               // 自定义侧边栏内容
      <LogoIcon />             // ◇ 菱形 Logo
      <span>Yishan AI</span>
      <PanelLeft />            // 折叠按钮（展开态显示）

      <Button variant="outline">
        <MessageCirclePlus />
        新建对话
      </Button>

      <Separator />

      <span>历史会话</span>

      <SessionList />          // 会话列表（flex-1, 可滚动）

      <Link href="/history">
        <History />
        查看历史
      </Link>

      <button>
        <Settings />
        设置
      </button>
    </AppSidebar>
  </Sidebar>

  <SidebarInset>
    <ChatContent />            // 页面内容
  </SidebarInset>

  <SidebarRail />              // 折叠后的小按钮

  <FloatingExpandIcon />       // 悬浮展开按钮（折叠态显示）
</ChatLayout>
```

## 15.7 样式规范

### 配色系统

采用纯黑白灰配色：
- 线条/边框：`#171717` (neutral-900)
- 背景：`#fafafa` (neutral-50)
- 侧边栏：`#f5f5f5` (neutral-100)
- 选中态：`bg-black text-white`
- hover 效果：`hover:bg-black/10`

### Flex 布局贴底

```
AppSidebar (flex-col, h-full)
├── Header area (shrink-0)
├── SessionList (flex-1, min-h-0, overflow-hidden)
└── Footer (shrink-0, mt-auto)
```

**关键 CSS 模式**:
- `flex-1 min-h-0` - 允许 flex 子元素收缩并填充剩余空间
- `overflow-hidden` - 溢出内容滚动
- `mt-auto shrink-0` - footer 贴底

### 交互元素样式

| 元素 | 内边距 | hover 效果 |
|------|--------|-----------|
| 折叠/展开图标 | p-2 | hover:bg-black/10 |
| 新建对话按钮 | outline | shadow-none |
| 设置按钮 | p-2 | hover:bg-black/10 |

## 15.8 共享组件

```
components/layout/
├── ChatLayout.tsx      → 共享布局 (Sidebar + SidebarInset)
└── AppSidebar.tsx      → 侧边栏内容组件

components/chat/
├── message-list.tsx        → ScrollArea 封装，自动滚底
├── message-item.tsx        → 单条消息渲染（user / assistant）
├── message-thinking.tsx    → Collapsible 思考过程折叠卡片
├── message-code-block.tsx  → 代码块 + 复制按钮
├── plan-card.tsx           → Card 步骤列表，编辑/删除/执行
├── plan-step-item.tsx      → 单步骤条目（Badge 状态 + 详情展开）
├── build-progress.tsx      → build 逐步执行进度
├── chat-input.tsx          → Textarea + ToggleGroup + Select + Button 组合
├── model-selector.tsx      → Select 封装，/api/models 加载
└── empty-state.tsx         → Empty 空态引导

components/sidebar/
└── SessionList.tsx         → 侧边栏会话列表

lib/
└── constants.ts             → 共享常量 (DEFAULT_SESSION_LIMIT)
```

## 15.9 Phase 规划

| 特征 | Phase 1 | 后续 |
|------|---------|------|
| Sidebar offcanvas 模式 | ✅ | |
| 无气泡消息流 | ✅ | |
| 最近任务列表 | ✅ | |
| 会话操作菜单 | ✅ | |
| 思考过程折叠 | ✅ | |
| 流式输出 + 光标 | ✅ | |
| 刷新/重连恢复流式 | ✅ | |
| Markdown 渲染 | ✅ | |
| 深色模式 | ✅ | |
| 输入区 Plan/Build 切换 | ✅ | |
| 输入区模型选择 | ✅ | |
| Plan 步骤卡片 | ✅ | |
| Build 执行进度 | ✅ | |
| 空态引导页 | ✅ | |
| Toast 通知 | ✅ | |
| 移动端响应式 | ✅ | |
| 全局搜索 Command+K | | ✅ |
| 会话置顶 | | ✅ |
| 追问引导 | | ✅ |
| 虚拟列表 | | ✅ |
| 文件上传 | | ✅ |