# 18. 安全配置方案

## 概述

本文档描述 Yishan AI 的安全配置方案，包括配置统一管理和文件系统工具的安全限制。

## 1. 配置统一管理

### 1.1 配置文件

**位置**: `~/.yishan-ai/config.json`

**设计原则**:
- 所有配置集中管理，替代分散的 `.env` 文件
- 支持热加载，修改配置无需重启服务
- 配置分层：系统配置、用户配置

### 1.2 配置结构

```json
{
  "meta": {
    "version": "1.0.0",
    "lastTouchedAt": "2026-05-01T12:00:00.000Z"
  },
  "models": {
    "provider": "minimax",
    "baseUrl": "https://api.minimaxi.com/anthropic",
    "apiKey": "${MINIMAX_API_KEY}",
    "defaultModel": "MiniMax-M2.7-highspeed",
    "models": [
      {
        "id": "MiniMax-M2.7-highspeed",
        "name": "MiniMax-M2.7高速"
      },
      {
        "id": "MiniMax-M2.7",
        "name": "MiniMax-M2.7"
      },
      {
        "id": "MiniMax-M2.5-highspeed",
        "name": "MiniMax-M2.5高速"
      },
      {
        "id": "MiniMax-M2.5",
        "name": "MiniMax-M2.5"
      },
      {
        "id": "MiniMax-M2.1-highspeed",
        "name": "MiniMax-M2.1高速"
      },
      {
        "id": "MiniMax-M2.1",
        "name": "MiniMax-M2.1"
      },
      {
        "id": "MiniMax-M2",
        "name": "MiniMax-M2"
      }
    ]
  },
  "workspace": {
    "directories": [
      "/home/dfy/workspace"
    ],
    "allowDelete": false
  },
  "tools": {
    "fs": {
      "enabled": true,
      "workspaceOnly": true
    },
    "exec": {
      "security": "ask"
    }
  },
  "logging": {
    "dir": "~/.yishan-ai/logs",
    "retentionDays": -1
  }
}
```

### 1.3 配置项说明

#### 模型配置 (models)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `models.provider` | string | `minimax` | Provider 名称 |
| `models.baseUrl` | string | `https://api.minimaxi.com/anthropic` | API 基础地址 |
| `models.apiKey` | string | - | API Key，支持 `${ENV_VAR}` 语法 |
| `models.defaultModel` | string | `MiniMax-M2.7-highspeed` | 默认模型 ID |
| `models.models[].id` | string | - | 模型 ID（用于 API 调用） |
| `models.models[].name` | string | - | 模型显示名（用于 UI 选择） |
| `models.models[].contextWindow` | number | - | 上下文窗口大小 |
| `models.models[].maxTokens` | number | - | 最大输出 tokens |

#### 工作目录 (workspace)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `workspace.directories` | string[] | `["~/.yishan-ai/workspace"]` | 允许的工作目录列表 |
| `workspace.allowDelete` | boolean | `false` | 是否允许删除文件 |

#### 工具配置 (tools)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `tools.fs.enabled` | boolean | `true` | 启用文件系统工具 |
| `tools.fs.workspaceOnly` | boolean | `true` | 限制在 workspace 内操作 |
| `tools.exec.security` | string | `ask` | 执行安全级别: `allow`, `ask`, `deny` |

#### 日志配置 (logging)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `logging.dir` | string | `~/.yishan-ai/logs` | 日志目录 |
| `logging.retentionDays` | number | `-1` | 日志保留天数，-1 永久 |

---

## 2. 安全配置 UI

### 2.1 设置页面导航

```
设置
├── MCP        → /settings/mcp
├── Skills     → /settings/skills
├── 安全       → /settings/security  [新增]
└── 通用      → /settings/general
```

### 2.2 安全设置页面 `/settings/security`

**功能区域**:

1. **工作目录配置**
   - 目录选择器（支持选择文件夹）
   - 手动输入路径
   - 验证目录是否存在

2. **文件操作权限**
   - 允许删除文件

3. **执行权限**
   - 执行安全级别：允许 / 询问 / 拒绝

### 2.3 UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│  工作目录                                                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐ │
│  │ /home/dfy/workspace                                  │ │
│  └─────────────────────────────────────────────────────┘ │
│  [添加目录]  [手动输入]                                    │
│                                                             │
│  已添加目录:                                               │
│    • /home/dfy/workspace                                 │
│    • /home/dfy/projects                                   │
│                                                             │
│  □ 允许删除文件                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  执行权限                                                  │
├─────────────────────────────────────────────────────────────┤
│  安全级别: ○ 允许  ● 询问  ○ 拒绝                         │
│                                                             │
│  说明:                                                     │
│  - 允许: AI 可以直接执行命令                                │
│  - 询问: AI 执行前需要用户确认                              │
│  - 拒绝: AI 无法执行命令                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 目录选择器

**实现方式**:
- 使用 `<input type="file" webkitdirectory>` 选择文件夹
- 同时支持手动输入路径
- 输入后验证路径是否存在且可访问

**交互流程**:
1. 用户点击"选择文件夹" → 打开系统文件夹选择器
2. 选择后自动填充路径输入框
3. 点击"验证"检查目录是否可访问
4. 保存配置

---

## 3. 内置文件系统工具

### 3.1 工具列表

| 工具名 | 功能 | 说明 |
|--------|------|------|
| `read_file` | 读取文件 | 指定路径读取，支持大文件 |
| `write_file` | 写入文件 | 自动创建目录，支持覆盖 |
| `edit_file` | 编辑文件 | 基于内容的精准编辑 |
| `delete_file` | 删除文件 | 递归删除，需 `allowDelete=true` |
| `search_files` | 搜索文件 | glob 模式匹配 + 内容搜索 |
| `list_directory` | 列出目录 | 目录浏览，支持递归 |
| `diff_files` | 对比文件 | 两文件差异对比 |

### 3.2 依赖库

| 库名 | 用途 | 安装命令 |
|------|------|----------|
| `fs-extra` | 增删改查、目录操作 | `pnpm add fs-extra` |
| `globby` | 文件搜索 | `pnpm add globby` |
| `diff` | 文本 diff | `pnpm add diff` |

### 3.3 安全检查

**路径验证**:
```typescript
function validatePath(path: string, config: WorkspaceConfig): boolean {
  // 规范化路径
  const normalized = path.resolve(path);

  // 检查是否在允许的 workspace 目录内
  if (config.workspaceOnly && !config.directories.some(dir => normalized.startsWith(dir))) {
    return false;
  }

  // 检查是否在保护路径内
  const protectedPaths = ['/etc', '/root', '/.ssh', '/proc', '/sys'];
  if (protectedPaths.some(p => normalized.startsWith(p))) {
    return false;
  }

  return true;
}
```

**操作验证**:
```typescript
function validateOperation(op: string, config: WorkspaceConfig): boolean {
  if (op === 'delete' && !config.allowDelete) {
    return false;
  }
  return true;
}
```

---

## 4. API 设计

### 4.1 配置 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config` | 获取所有配置 |
| PATCH | `/api/config` | 部分更新配置 |

**请求示例**:
```json
PATCH /api/config
{
  "workspace": {
    "directories": ["/home/dfy/workspace", "/home/dfy/projects"],
    "allowDelete": true
  }
}
```

### 4.2 目录验证 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config/workspace/validate?path=/xxx` | 验证目录是否有效 |

**响应示例**:
```json
{
  "valid": true,
  "readable": true,
  "writable": true,
  "exists": true
}
```

---

## 5. 实现计划

### Phase 1: 配置管理基础设施

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 ConfigManager | `packages/backend/src/lib/config-manager.ts` | 加载/保存配置 |
| 迁移 .env 配置 | `packages/backend/src/lib/config-manager.ts` | 读取 .env 转为 config.json |
| 移除 .env 依赖 | 相关文件 | 改为从 ConfigManager 读取 |

### Phase 2: 安全配置 UI

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建目录选择器 | `packages/frontend/src/components/settings/directory-picker.tsx` | 选择+手动输入 |
| 创建安全设置页面 | `packages/frontend/src/app/settings/security/page.tsx` | 安全配置 UI |
| 更新设置导航 | `packages/frontend/src/app/settings/layout.tsx` | 添加"安全"入口 |

### Phase 3: 文件系统工具

| 任务 | 文件 | 说明 |
|------|------|------|
| 实现 FS Provider | `packages/backend/src/lib/fs-provider.ts` | 封装 fs-extra/globby/diff |
| 注册工具 | `packages/backend/src/lib/tool-registry.ts` | 注册为内置工具 |
| 路径安全检查 | `packages/backend/src/lib/fs-provider.ts` | workspaceOnly 检查 |

---

## 6. 迁移计划

### 从 .env 迁移

**.env 示例**:
```bash
MINIMAX_API_KEY=sk-xxx
MINIMAX_BASE_URL=https://api.minimaxi.com/anthropic
DEFAULT_MODEL=MiniMax-M2.7
```

**迁移后**:
```json
{
  "models": {
    "provider": "minimax",
    "baseUrl": "https://api.minimaxi.com/anthropic",
    "apiKey": "${MINIMAX_API_KEY}",
    "defaultModel": "MiniMax-M2.7-highspeed",
    "models": [
      {
        "id": "MiniMax-M2.7-highspeed",
        "name": "MiniMax-M2.7高速"
      },
      {
        "id": "MiniMax-M2.7",
        "name": "MiniMax-M2.7"
      },
      {
        "id": "MiniMax-M2.5-highspeed",
        "name": "MiniMax-M2.5高速"
      }
    ]
  }
}
```

**迁移步骤**:
1. 读取现有 `.env` 文件
2. 转换为 `config.json` 格式
3. 保存到 `~/.yishan-ai/config.json`
4. 备份 `.env` 为 `.env.bak`
5. 更新代码从 ConfigManager 读取配置

### 配置文件位置

| 路径 | 说明 |
|------|------|
| `~/.yishan-ai/config.json` | 主配置文件 |
| `~/.yishan-ai/data/yishan.db` | SQLite 数据库 |
| `~/.yishan-ai/logs/` | 日志目录 |
| `~/.yishan-ai/workspace/` | 默认工作目录 |

---

## 7. 参考

- [OpenClaw Config Reference](https://docs.openclaw.ai/gateway/configuration)
- [OpenClaw Security Documentation](https://docs.openclaw.ai/gateway/security)
- [fs-extra](https://www.npmjs.com/package/fs-extra)
- [globby](https://www.npmjs.com/package/globby)
- [diff](https://www.npmjs.com/package/diff)