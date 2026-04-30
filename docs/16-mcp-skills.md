# 16. MCP & Skills 实现

## 目录结构

```
~/.yishan-ai/
├── mcp.json        # MCP 服务器配置
├── config.json     # 应用配置（替代 .env）
├── skills/         # 技能目录
│   └── <skill-name>/
│       └── SKILL.md
└── sessions/       # 会话数据
```

## MCP 服务器配置

### mcp.json 格式

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/"]
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp"
    }
  }
}
```

### 传输类型

| 类型 | 配置 | 说明 |
|------|------|------|
| stdio | `command` + `args` | 本地子进程 |
| http | `type: "http"` + `url` | 远程服务 |

## API 路由

### MCP 服务器

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/mcp/servers` | GET | 获取服务器列表 |
| `/api/mcp/servers` | POST | 添加服务器 |
| `/api/mcp/servers/:name` | DELETE | 删除服务器 |
| `/api/mcp/servers/:name/connect` | POST | 连接服务器 |
| `/api/mcp/servers/:name/disconnect` | POST | 断开连接 |

### Skills

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/skills` | GET | 获取技能列表 |
| `/api/skills/:name` | GET | 获取技能详情 |

## SKILL.md 格式

```yaml
---
name: lark-calendar
description: 飞书日历管理 - 创建会议、查询日程
allowed-tools: lark_calendar_*
context: fork
---

# 飞书日历技能

## 使用场景
- 查询日程：`+agenda`
- 创建会议：`+create`

## 注意事项
- 会议创建需要确认时间和参会人
```

### Frontmatter 字段

| 字段 | 说明 |
|------|------|
| `name` | 技能名称 |
| `description` | 技能描述（AI 决定何时使用） |
| `allowed-tools` | 白名单通配符（默认全部允许） |
| `denied-tools` | 黑名单通配符 |
| `context` | `fork` - 子代理执行 |

## McpManager 类

```typescript
class McpManager {
  connections: Map<string, { client, transport, tools }>

  async connectServer(name: string, config: MCPConfig): Promise<void>
  async disconnectServer(name: string): Promise<void>
  listTools(): Tool[]
  async callTool(name: string, args: object): Promise<ToolResult>
  getAnthropicTools(): AnthropicTool[]
}
```

## 前端组件

| 组件 | 位置 | 功能 |
|------|------|------|
| `ToolCallBlock` | `components/chat/` | 工具调用卡片 |
| `SkillBadge` | `components/chat/` | 技能徽章 |
| `McpManagerPanel` | `components/settings/` | MCP 服务器管理 |

## 实现进度

- [ ] MCP SDK 集成
- [ ] McpManager 后端类
- [ ] MCP API 路由
- [ ] Skills 目录扫描
- [ ] SKILL.md 解析
- [ ] 工具调用卡片 UI
- [ ] MCP 管理面板 UI
