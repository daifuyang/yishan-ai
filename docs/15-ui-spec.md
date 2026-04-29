# 15. UI 设计规范

## 15.1 整体布局

```
┌────┬─────────────────────────────────────────────────────────────┐
│图标│                                                             │
│按钮│  ScrollArea (消息区)                                         │
│栏  │  ┌───────────────────────────────────────────────────────┐  │
│    │  │                                                       │  │
│ ☰  │  │  user 消息（右对齐，浅底色）                              │  │
│    │  │  ─────────────────────────────────                    │  │
│ +  │  │  assistant 消息（左对齐，Markdown 平铺）                  │  │
│新建│  │  · react-markdown 渲染                                 │  │
│    │  │  · Collapsible 思考过程                                │  │
│ 🔍 │  │  · Card 步骤卡片 (plan 模式)                            │  │
│搜索│  │  · Badge 执行进度 (build 模式)                           │  │
│    │  │                                                       │  │
│────│  │                                                       │  │
│最近│  │                                                       │  │
│任务│  └───────────────────────────────────────────────────────┘  │
│    │                                                             │
│ 会1│  ┌───────────────────────────────────────────────────────┐  │
│ 会2│  │  输入区 (底部固定)                                      │  │
│ 会3│  │                                                       │  │
│ 会4│  │  ┌─ Textarea ────────────────────────────────────┐    │  │
│ ···│  │  │ 输入消息...                                    │    │  │
│    │  │  └───────────────────────────────────────────────┘    │  │
│────│  │                                                       │  │
│ ⚙  │  │  [Plan|Build]     [MiniMax-M2.7 ▼]        [发送 ▶]  │  │
│设置│  │   ToggleGroup       Select                   Button   │  │
│    │  └───────────────────────────────────────────────────────┘  │
└────┴─────────────────────────────────────────────────────────────┘
```

## 15.2 左侧栏结构

```
┌────────┐
│  Logo  │  ← SidebarHeader
├────────┤
│  ☰     │  ← SidebarTrigger（展开/折叠）
│  + 新建 │  ← Button（新建对话）
│  🔍 搜索│  ← Button → 触发 Dialog+Command 搜索
├────────┤
│ 最近任务 │  ← SidebarGroupLabel
│ ────── │
│ 会话标题 │  ← SidebarMenuButton (isActive)
│ 会话标题 │     hover → 显示 ··· DropdownMenu
│ 会话标题 │
│ 会话标题 │  ← ScrollArea 滚动
│ ······  │
├────────┤
│  ⚙ 设置│  ← SidebarFooter
└────────┘
```

左侧栏是**窄栏图标模式**（collapsed），hover/点击可展开为完整 sidebar 显示会话标题。

| 项 | 折叠态 | 展开态 |
|----|-------|--------|
| 宽度 | ~48px（纯图标） | ~260px（图标 + 文字） |
| 新建 | `+` 图标 | `+ 新建对话` |
| 搜索 | 🔍 图标 | 🔍 搜索框 |
| 会话列表 | 不显示 | 标题 + 时间分组 + 操作菜单 |
| 设置 | ⚙ 图标 | `⚙ 设置` |

## 15.3 空态页面（无会话时）

```
┌────┬─────────────────────────────────────────────────────────────┐
│    │                                                             │
│ +  │                                                             │
│    │                  ┌─────────────────────┐                   │
│    │                  │  MessageSquare icon  │                   │
│    │                  │                     │                   │
│    │                  │  "开始一段新对话"      │                   │
│    │                  └─────────────────────┘                   │
│    │                                                             │
│    │  ┌─ Textarea ────────────────────────────────────────────┐  │
│    │  │ 输入消息...                                            │  │
│    │  └──────────────────────────────────────────────────────┘  │
│    │                                                             │
│    │  [Plan|Build]        [MiniMax-M2.7 ▼]           [发送 ▶]  │
│    │                                                             │
└────┴─────────────────────────────────────────────────────────────┘
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
| 侧边栏容器 | `Sidebar` variant="inset" + `SidebarProvider` | 窄栏图标模式，可展开 |
| 侧边栏头部 | `SidebarHeader` | Logo |
| 操作按钮组 | `SidebarMenu` + `SidebarMenuItem` + `SidebarMenuButton` | 新建/搜索按钮 |
| 会话列表 | `SidebarContent` + `SidebarGroup` + `SidebarGroupLabel` | 最近任务列表 |
| 会话列表项 | `SidebarMenuItem` + `SidebarMenuButton` | 单个会话条目 |
| 侧边栏底部 | `SidebarFooter` | 设置按钮 |
| 折叠触发 | `SidebarTrigger` | 展开/折叠 |
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
<SidebarProvider>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <BotMessageSquare data-icon="inline-start" />
            <span>Yishan AI</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      {/* 操作按钮 */}
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleNewChat}>
              <Plus data-icon="inline-start" />
              <span>新建对话</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={openSearch}>
              <Search data-icon="inline-start" />
              <span>搜索</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <Separator />

      {/* 最近任务 */}
      <SidebarGroup>
        <SidebarGroupLabel>最近任务</SidebarGroupLabel>
        <SidebarMenu>
          <ScrollArea>
            {sessions.map(session => (
              <SidebarMenuItem key={session.id}>
                <SidebarMenuButton
                  isActive={session.id === activeId}
                  onClick={() => router.push(`/chat/${session.id}`)}
                >
                  <MessageSquare data-icon="inline-start" />
                  <span>{session.title}</span>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuGroup>
                    <DropdownMenuItem>重命名</DropdownMenuItem>
                    <DropdownMenuItem>删除</DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenu>
              </SidebarMenuItem>
            ))}
          </ScrollArea>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <Settings data-icon="inline-start" />
            <span>设置</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>

  <main className="flex flex-col h-screen">
    {/* 消息列表 */}
    <ScrollArea className="flex-1">
      {messages.length === 0
        ? <EmptyState />
        : messages.map(msg => (
            msg.role === 'user'
              ? <div className="ml-auto max-w-[80%]">{msg.content}</div>
              : <div className="prose dark:prose-invert max-w-none">
                  {msg.thinking && (
                    <Collapsible>
                      <CollapsibleTrigger>
                        <Badge variant="secondary">思考过程</Badge>
                      </CollapsibleTrigger>
                      <CollapsibleContent>{msg.thinking}</CollapsibleContent>
                    </Collapsible>
                  )}
                  {msg.plan && <PlanCard plan={msg.plan} />}
                  {msg.buildResult && <BuildProgress results={msg.buildResult} />}
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
          ))
      }
      {isStreaming && <Skeleton className="h-4 w-3/4" />}
    </ScrollArea>

    {/* 输入区 */}
    <footer className="border-t p-4">
      <Textarea
        placeholder="输入消息..."
        onKeyDown={handleKeyDown}
        disabled={isStreaming}
      />
      <div className="flex items-center justify-between mt-2">
        <ToggleGroup type="single" value={mode} onValueChange={setMode}>
          <ToggleGroupItem value="plan">Plan</ToggleGroupItem>
          <ToggleGroupItem value="build">Build</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-2">
          <Select value={model} onValueChange={setModel}>
            <SelectGroup>
              <SelectItem value="MiniMax-M2.7">MiniMax-M2.7</SelectItem>
              <SelectItem value="MiniMax-M2.5">MiniMax-M2.5</SelectItem>
              <SelectItem value="MiniMax-M2.1">MiniMax-M2.1</SelectItem>
            </SelectGroup>
          </Select>

          {isStreaming
            ? <Button variant="outline" onClick={stopStream}>
                <Square data-icon="inline-start" />
                停止
              </Button>
            : <Button onClick={sendMessage}>
                <SendHorizonal data-icon="inline-start" />
                发送
              </Button>
          }
        </div>
      </div>
    </footer>
  </main>
</SidebarProvider>
```

## 15.7 shadcn 安装清单

```bash
pnpm dlx shadcn@latest add \
  sidebar \
  scroll-area \
  select \
  toggle-group \
  button \
  input \
  textarea \
  separator \
  skeleton \
  badge \
  card \
  collapsible \
  dropdown-menu \
  dialog \
  alert-dialog \
  command \
  tooltip \
  avatar
```

额外 npm 依赖：

```bash
pnpm add react-markdown remark-gfm rehype-highlight sonner
```

## 15.8 自定义业务组件

```
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
├── session-list.tsx        → SidebarContent 会话列表
├── session-item.tsx        → SidebarMenuItem + DropdownMenu
├── search-dialog.tsx       → Command inside Dialog 全局搜索
└── empty-state.tsx         → Empty 空态引导
```

## 15.9 样式规范

| 规则 | 说明 |
|------|------|
| 语义色 | `bg-background` `text-foreground` `text-muted-foreground` |
| 间距 | `flex flex-col gap-*`，不用 `space-y-*` |
| 等宽 | `size-*` 替代 `w-* h-*` |
| 条件类 | `cn()` 合并 |
| 深色模式 | 语义色自动适配，不手写 `dark:` |
| 图标 | `data-icon="inline-start"` / `data-icon="inline-end"` |
| Markdown | `prose dark:prose-invert max-w-none` |

## 15.10 流式状态 UI（后端独立执行）

### 前端发起对话后

```
┌─────────────────────────────────────────────────────────────────┐
│  消息列表                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  user: "帮我写一个排序算法"                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  assistant: 好的，我来帮你写一个快速排序算法...            │   │
│  │  def quicksort(arr):                                    │   │
│  │      ...                                                │   │
│  │  ▌  ← 流式光标                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
┌──────────────┐                    ┌──────────────┐ ┌──────────┐
│ [Plan][Build]│                    │ MiniMax-M2.7▼│ │  ■ 停止  │
│  (disabled)  │                    │  (disabled)  │ │  outline │
└──────────────┘                    └──────────────┘ └──────────┘
```

### 前端刷新/重开后（会话正在 streaming）

```
┌─────────────────────────────────────────────────────────────────┐
│  消息列表                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  user: "帮我写一个排序算法"                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  assistant: 好的，我来帮你写一个快速排序算法...            │   │
│  │  def quicksort(arr):   ← 从 streamingContent 恢复的部分   │   │
│  │      if len(arr) <= 1:                                  │   │
│  │          return arr                                     │   │
│  │  ▌  ← 流式光标（自动 subscribe 后继续接收）               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 流式状态标识

| session.status | UI 表现 |
|----------------|--------|
| `idle` | 正常状态，输入框可用 |
| `streaming` | 输入框 disabled，显示停止按钮，消息末尾有流式光标 |
| `failed` | 显示错误 toast，输入框恢复可用，允许重试 |

## 15.11 交互规范

| 交互 | 实现 |
|------|------|
| Enter 发送 | `onKeyDown`: Enter && !shiftKey → sendMessage |
| Shift+Enter 换行 | Textarea 默认行为 |
| 自动滚底 | 新消息 / 流式 chunk → scrollToBottom |
| 流式光标 | `animate-pulse` 的 `▌` 字符 |
| 新建会话 | 点击 `+` → 跳转首页（不创建会话）→ 用户发送消息时才创建会话 |
| 会话切换 | sidebar 点击 → `router.push` + `fetchMessages()` → 根据 session.status 自动 subscribe |
| 页面刷新恢复 | 从 URL 取 sessionId → 加载历史 → 如果 status=streaming 自动 subscribe 接续输出 |
| 重连追赶 | subscribe 先收 `content_catchup`（已缓冲内容）→ 再收实时 delta |
| Plan 确认 | 点击卡片底部"执行全部" → approve API |
| 模式切换 | ToggleGroup → 影响下次发送的 `?mode=` 参数 |
| 删除确认 | `AlertDialog` |
| Toast 通知 | `sonner` |
| 搜索 | 点击 🔍 → `Command` inside `Dialog`，按标题模糊搜索 |
| 侧边栏折叠 | 默认窄栏图标模式，hover/点击展开 |
| 移动端 | sidebar 默认隐藏，`SidebarTrigger` 展开为 Sheet |

## 15.12 Phase 规划

| 特征 | Phase 1 | 后续 |
|------|---------|------|
| 窄栏 Sidebar + 展开 | ✅ | |
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
