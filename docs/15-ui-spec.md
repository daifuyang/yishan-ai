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
│  ▌会话标题 (选中)  [...]│  ← 左侧黑色边框表示选中态，hover 显示 ···
│    会话标题        [...]│  ← hover 显示 ··· 菜单
│    ...              │
├──────────────────────┤
│  查看历史 (History)  │  ← 跳转 /history（常显）
├──────────────────────┤
│  设置                │
└──────────────────────┘
```

### 会话项操作菜单

hover 会话项时显示 `···` 按钮，点击展开下拉菜单：

| 操作 | 图标 | 说明 |
|------|------|------|
| 编辑标题 | `Pencil` | 弹出 Dialog 修改标题 |
| 置顶/取消置顶 | `Pin` / `PinOff` | 切换置顶状态 |
| 删除 | `Trash2` | 弹出 AlertDialog 确认 |

**样式规范**：
- `···` 按钮：透明背景，`h-6 w-6`，hover 时无背景色
- Active 会话（黑色背景）：图标白色，hover 显示白色 ring
- 非 Active 会话：图标 `text-muted-foreground`，hover 变为 `text-foreground`
- 菜单项：左对齐图标 + 文字，hover 显示 `bg-accent`
- 删除菜单项：红色文字 `text-red-600`，hover 显示 `bg-red-50`

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

### 侧边栏动画与展开按钮的同步

侧边栏收起动画时长为 **200ms**。展开按钮（FloatingExpandIcon）需要等动画完全结束后才显示，避免视觉闪烁。

**实现方案**：使用 `setTimeout` 延迟 200ms 显示图标，而不是 CSS `transition-delay`。

```tsx
function FloatingExpandIcon() {
  const { state, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (isMobile) {
      setVisible(!openMobile);
    } else if (state === "collapsed") {
      const timer = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [state, isMobile, openMobile]);

  if (!visible) return null;

  if (isMobile) {
    return (
      <div
        onClick={() => setOpenMobile(true)}
        className="fixed left-3 top-[18px] z-50 cursor-pointer p-2 bg-background border rounded-md shadow-md hover:bg-accent"
      >
        <PanelRight className="h-4 w-4 text-foreground" />
      </div>
    );
  }

  return (
    <div
      onClick={toggleSidebar}
      className="fixed left-3 top-[18px] z-50 cursor-pointer p-2 hover:bg-black/10 rounded-md"
    >
      <PanelRight className="h-4 w-4 text-foreground" />
    </div>
  );
}
```

**为什么不用 CSS transition-delay**：
- CSS `transition-delay` 可能因浏览器渲染时机不同步
- `setTimeout` 更精确可靠，确保动画完成后再显示

### 移动端适配

| 功能 | 桌面端 | 移动端 |
|------|--------|--------|
| 侧边栏收起 | 隐藏左侧 | Sheet 抽屉 |
| 展开按钮 | 悬浮左上角 | 悬浮左上角（位置相同） |
| 点击会话 | 导航 | 导航并关闭抽屉 |
| 查看历史 | 常显 | 常显 |

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
│                        下午好                                        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  输入消息...                                             [发送] │  │
│  │                                                             │  │
│  │  [Build ▼]        [MiniMax-M2.7-highspeed ▼]               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

特点：
- 居中显示问候语（上午好/下午好/晚上好）
- 输入框卡片式设计，带边框和圆角
- 模式切换和模型选择改为 Select 下拉框
- 发送按钮在右下角

## 15.4 输入区详细设计

```
┌─────────────────────────────────────────────────────────────────┐
│  Textarea (自适应高度，1~6 行)                                    │
│  输入消息... Shift+Enter 换行                                     │
└─────────────────────────────────────────────────────────────────┘
┌────────────────┐ ┌──────────────────────┐              ┌────────┐
│  ModeSelector  │ │    ModelSelector     │              │SendBtn │
│    Build ▼     │ │ MiniMax-M2.7-highspeed▼│              │  发送  │
└────────────────┘ └──────────────────────┘              └────────┘
   左侧：模式切换           中间：模型选择                    右侧：发送
```

### 组件命名

| 控件 | 组件名 | 宽度 (移动端) | 宽度 (PC) | shadcn 组件 |
|------|--------|--------------|-----------|-------------|
| 模式切换 | `ModeSelector` | 60px | 80px | `Select` |
| 模型选择 | `ModelSelector` | 100px | flex-1 | `Select` + `SelectGroup` + `SelectItem` |
| 发送按钮 | `SendButton` | 图标 | 图标+文字 | `Button` |
| 输入框 | `ChatInput` | w-full | w-full | `Textarea` |
| 输入区容器 | `ChatInputWrapper` | max-w-3xl | max-w-3xl | - |

| 控件 | 行为 |
|------|------|
| 模式切换 | Plan / Build 二选一，默认 Build |
| 模型选择 | 默认 MiniMax-M2.7-highspeed |
| 发送按钮 | 流式中变为"停止"按钮（`Square` icon） |
| 输入框 | 自适应高度，Enter 发送，Shift+Enter 换行 |

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

### 15.4.1 滚动定位按钮

在聊天页面底部栏添加"滚动到顶部"和"滚动到底部"图标按钮。

```
位置示意：
┌─────────────────────────────────────────────────────────────────┐
│  ...                                                         ↑ │
│  ...                                                         │ │
│  ...                                                    [按钮区]│
│  ...                                                         │ │
└─────────────────────────────────────────────────────────────────┘
```

#### 显示逻辑

| 位置 | 上方按钮 | 下方按钮 |
|-----|---------|---------|
| 最上方 | 不显示 | ArrowDown |
| 最下方 | 不显示 | ArrowUp |
| 中间 | ArrowUp | ArrowDown |

#### 核心规则

1. **下方按钮根据位置显示不同图标**：
   - 在顶部时（isNearTop）：显示 ArrowDown，点击滚动到底部
   - 在底部时（isNearBottom）：显示 ArrowUp，点击滚动到顶部
   - 在中间时：显示 ArrowDown，点击滚动到底部

2. **上方按钮只在中间位置显示**：
   - 只在 `!isNearTop && !isNearBottom` 时显示
   - 始终显示 ArrowUp，点击滚动到顶部

3. **无滚动条时不显示按钮**：
   - 当 `scrollHeight <= clientHeight` 时，不渲染按钮容器

#### 实现方式

滚动状态通过 `window.scroll` 事件监听，使用 `window.scrollTo()` 进行滚动：

```typescript
const [scrollState, setScrollState] = useState({
  isNearTop: true,
  isNearBottom: false,
  canScroll: false,
});

// 滚动状态检测
useEffect(() => {
  const updateScrollState = () => {
    const scrollY = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const distanceFromBottom = scrollHeight - scrollY - clientHeight;

    setScrollState({
      isNearTop: scrollY < 100,
      isNearBottom: distanceFromBottom < 100,
      canScroll: scrollHeight > clientHeight,
    });
  };

  window.addEventListener('scroll', updateScrollState, { passive: true });
  updateScrollState();
  return () => window.removeEventListener('scroll', updateScrollState);
}, []);
```

#### 按钮布局

```tsx
{scrollState.canScroll && (
  <div className="absolute w-full top-0 max-w-3xl">
    <div className="absolute bottom-4 right-0 flex flex-col gap-2">
      {/* 上方按钮 - 只在中间显示 */}
      {showTopButton && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="h-8 w-8 bg-background/95 backdrop-blur shadow-sm"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}

      {/* 下方按钮 - 根据位置变图标 */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => scrollState.isNearBottom
          ? window.scrollTo({ top: 0, behavior: 'smooth' })
          : window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
        className="h-8 w-8 bg-background/95 backdrop-blur shadow-sm"
      >
        {scrollState.isNearBottom ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  </div>
)}
```

#### 自动滚动

消息变化时自动滚动到底部：

```typescript
// 消息增加时滚动
const prevMessagesLength = useRef(messages.length);
useEffect(() => {
  if (messages.length > 0 && messages.length !== prevMessagesLength.current) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  }
  prevMessagesLength.current = messages.length;
}, [messages]);

// 流式输出时跟随滚动
useEffect(() => {
  if (isStreaming && scrollState.isNearBottom) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  }
}, [isStreaming, scrollState.isNearBottom]);
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
| 用户消息复制 | `Button` variant="ghost" + CSS hover | 悬浮显示复制按钮，点击后显示"已复制" |
| 空状态 | 自定义组件 | 无会话时的引导页，居中问候语 + 输入框 |

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
| 模式切换 | `ModeSelector` (`Select`) | Plan / Build 切换，默认 Build |
| 模型选择 | `ModelSelector` (`Select`) | 模型下拉 |
| 发送按钮 | `SendButton` (`Button`) | 发送/停止，lucide `SendHorizonal` / `Square` |
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
        <SessionItem />         // 单个会话项，含 ··· 下拉菜单
          <Link />              // 会话链接
          <DropdownMenu />      // ··· 操作菜单

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

  <FloatingExpandIcon />       // 悬浮展开按钮（桌面端折叠态显示，移动端抽屉关闭态显示）
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
├── message-list.tsx        → ScrollArea 封装，自动滚底，消息气泡样式
├── message-item.tsx        → 单条消息渲染（user / assistant）
├── message-thinking.tsx    → Collapsible 思考过程折叠卡片
├── message-code-block.tsx  → 代码块 + 复制按钮
├── plan-card.tsx           → Card 步骤列表，编辑/删除/执行
├── plan-step-item.tsx      → 单步骤条目（Badge 状态 + 详情展开）
├── build-progress.tsx      → build 逐步执行进度
├── chat-input.tsx          → 卡片式输入框（Textarea + ModeSelector + ModelSelector + SendButton）
├── chat-input-wrapper.tsx  → 输入区容器（max-w-3xl 居中，px-4 移动端边距）
└── empty-state.tsx         → 空态引导（居中问候语 + 输入框）

components/sidebar/
└── SessionList.tsx         → 侧边栏会话列表

lib/
└── constants.ts             → 共享常量 (DEFAULT_SESSION_LIMIT)
```

### 15.8.1 SCSS 样式

`globals.scss` 中定义的用户消息复制按钮样式：
```scss
.msg-actions-wrapper {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;

  &:hover .msg-action-btn {
    opacity: 1;
  }

  .msg-action-btn {
    opacity: 0;
    transition: opacity 200ms;
    margin-top: 0.25rem;

    button {
      opacity: 1;
      display: inline-flex;
    }
  }
}
```

## 15.9 Phase 规划

| 特征 | Phase 1 | 后续 |
|------|---------|------|
| Sidebar offcanvas 模式 | ✅ | |
| 无气泡消息流 | ✅ | |
| 最近任务列表 | ✅ | |
| 会话操作菜单 | ✅ | |
| 会话置顶 | ✅ | |
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
| 用户消息复制按钮 | ✅ | |
| URL 参数规范化 (sessionId) | ✅ | |
| SCSS 迁移 | ✅ | |
| 全局搜索 Command+K | | ✅ |
| 追问引导 | | ✅ |
| 虚拟列表 | | ✅ |
| 文件上传 | | ✅ |