# 7. 数据存储设计（SQLite）

## 7.1 数据库文件位置

```
packages/backend/
├── data/
│   ├── yishan.db          # 主数据库（自动创建）
│   └── yishan.db-wal      # WAL 日志（SQLite 自动管理）
```

- `data/` 目录加入 `.gitignore`，不入版本库
- PM2 部署时数据文件与代码同目录，备份只需 `cp`
- Docker 部署时挂载为 volume：`-v ./data:/app/data`

## 7.2 表结构设计

```sql
CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY,              -- UUID
  title               TEXT NOT NULL DEFAULT '新对话',
  model               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'idle'   -- idle | streaming | completed | failed
                      CHECK(status IN ('idle', 'streaming', 'completed', 'failed')),
  streaming_content   TEXT,                          -- 流式生成中的 partial 内容（JSON），流完成后清空
  created_at          INTEGER NOT NULL,              -- Unix 时间戳 (ms)
  updated_at          INTEGER NOT NULL
);

CREATE TABLE messages (
  id          TEXT PRIMARY KEY,              -- UUID
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content     TEXT NOT NULL,                  -- JSON 字符串，保持 Anthropic 原始格式
  created_at  INTEGER NOT NULL,
  usage_input  INTEGER,
  usage_output INTEGER
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

**`content` 字段存储 JSON 字符串，保持 Anthropic SDK 原始格式不拆解。**

用户消息：
```json
"你好，帮我看一下代码"
```

AI 消息（ContentBlock 数组）：
```json
[{"type":"text","text":"好的，我来看看"},{"type":"tool_use","id":"tu_1","name":"execute_command","input":{"command":"ls"}}]
```

工具结果消息：
```json
[{"type":"tool_result","tool_use_id":"tu_1","content":[{"type":"text","text":"file1.js\nfile2.js"}]}]
```

Plan 消息（plan 模式产出）：
```json
[{
  "type": "plan",
  "planId": "plan-uuid-123",
  "steps": [
    {"id": "step-1", "action": "execute_command", "command": "mkdir -p src/lib", "description": "创建目录"},
    {"id": "step-2", "action": "write_file", "path": "src/lib/utils.ts", "description": "创建工具函数"},
    {"id": "step-3", "action": "execute_command", "command": "pnpm add zod", "description": "安装依赖"}
  ],
  "status": "pending"
}]
```

Build 执行结果（approve 后写入）：
```json
[{
  "type": "build_result",
  "planId": "plan-uuid-123",
  "results": [
    {"stepId": "step-1", "status": "done", "output": "目录已创建"},
    {"stepId": "step-2", "status": "done", "output": "文件已写入 (42 bytes)"},
    {"stepId": "step-3", "status": "failed", "error": "网络超时"}
  ]
}]
```

Plan 状态流转：`pending` → `approved` → `running` → `completed` / `partial`（部分失败）。

## 7.3 数据库初始化

```typescript
// packages/backend/src/db/index.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import { runMigrations } from './migrations.ts';

const DATA_DIR = path.resolve(import.meta.dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'yishan.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined!;
  }
}
```

```typescript
// packages/backend/src/db/migrations.ts
import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id                  TEXT PRIMARY KEY,
      title               TEXT NOT NULL DEFAULT '新对话',
      model               TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'idle'
                          CHECK(status IN ('idle', 'streaming', 'completed', 'failed')),
      streaming_content   TEXT,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role        TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content     TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      usage_input  INTEGER,
      usage_output INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated
      ON sessions(updated_at DESC);
  `);
}
```

## 7.4 Store 层实现

```typescript
// packages/backend/src/stores/session-store.ts
import { getDb } from '../db/index.ts';

export interface Session {
  id: string;
  title: string;
  model: string;
  status: 'idle' | 'streaming' | 'completed' | 'failed';
  streamingContent?: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

export function listSessions(limit = 50, offset = 0): Session[] {
  const db = getDb();
  return db.prepare(`
    SELECT s.id, s.title, s.model, s.status,
           s.created_at as createdAt, s.updated_at as updatedAt,
           COUNT(m.id) as messageCount
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Session[];
}

export function getSession(id: string): Session | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, model, status, streaming_content as streamingContent,
           created_at as createdAt, updated_at as updatedAt
    FROM sessions WHERE id = ?
  `).get(id) as Session | undefined;
}

export function createSession(model: string, title?: string): Session {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, title, model, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, title || '新对话', model, now, now);
  return { id, title: title || '新对话', model, createdAt: now, updatedAt: now };
}

export function updateSessionTitle(id: string, title: string): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, Date.now(), id);
}

export function deleteSession(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function updateSessionStatus(
  id: string,
  status: 'idle' | 'streaming' | 'completed' | 'failed',
  streamingContent?: string | null
): void {
  const db = getDb();
  db.prepare(
    'UPDATE sessions SET status = ?, streaming_content = ?, updated_at = ? WHERE id = ?'
  ).run(status, streamingContent ?? null, Date.now(), id);
}

export function appendStreamingContent(id: string, chunk: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE sessions
    SET streaming_content = COALESCE(streaming_content, '') || ?,
        updated_at = ?
    WHERE id = ?
  `).run(chunk, Date.now(), id);
}
```

```typescript
// packages/backend/src/stores/message-store.ts
import { getDb } from '../db/index.ts';

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string | object[];
  createdAt: number;
  usageInput?: number;
  usageOutput?: number;
}

export function getMessages(sessionId: string, limit = 100, offset = 0): StoredMessage[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, session_id as sessionId, role, content, created_at as createdAt,
           usage_input as usageInput, usage_output as usageOutput
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ? OFFSET ?
  `).all(sessionId, limit, offset) as any[];

  return rows.map(row => ({
    ...row,
    content: JSON.parse(row.content),
  }));
}

export function appendMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string | object[],
  usage?: { inputTokens: number; outputTokens: number }
): StoredMessage {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const contentJson = typeof content === 'string' ? JSON.stringify(content) : JSON.stringify(content);

  db.prepare(`
    INSERT INTO messages (id, session_id, role, content, created_at, usage_input, usage_output)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, role, contentJson, now, usage?.inputTokens ?? null, usage?.outputTokens ?? null);

  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  return { id, sessionId, role, content, createdAt: now, usageInput: usage?.inputTokens, usageOutput: usage?.outputTokens };
}

export function rewriteMessages(sessionId: string, messages: { role: string; content: any }[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    const insert = db.prepare(`
      INSERT INTO messages (id, session_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const msg of messages) {
      insert.run(crypto.randomUUID(), sessionId, msg.role, JSON.stringify(msg.content), Date.now());
    }
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), sessionId);
  });
  tx();
}

export function getAnthropicMessages(sessionId: string): { role: string; content: any }[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC
  `).all(sessionId) as any[];
  return rows.map(row => ({ role: row.role, content: JSON.parse(row.content) }));
}
```

## 7.5 与 hello-minimax 数据操作的对照

| hello-minimax 操作 | yishan-ai 对应 | 说明 |
|-------------------|----------------|------|
| `sessionMgr.createNew()` | `createSession(model)` | 返回 Session 对象（含 UUID） |
| `sessionMgr.loadExisting(num)` | `getSession(id)` + `getMessages(id)` | 按 UUID 查询 |
| `sessionMgr.appendMessage(path, msg)` | `appendMessage(sessionId, role, content)` | 写入 SQLite |
| `sessionMgr.rewriteSession(path, msgs)` | `rewriteMessages(sessionId, msgs)` | 事务内删除旧消息 + 批量插入 |
| `sessionMgr.archiveTranscript(num, msgs)` | 不再需要 | SQLite 本身持久化 |
| `sessionMgr.getSessionFiles()` | `listSessions()` | SQL 查询，支持分页 |
| 无 | `updateSessionTitle(id, title)` | 新增 |
| 无 | `deleteSession(id)` | 新增（CASCADE 删消息） |
| 无 | `getAnthropicMessages(sessionId)` | 新增：直接返回 Anthropic SDK 格式 |
| 无 | `updateSessionStatus(id, status)` | 新增：后端推进对话时更新会话状态 |
| 无 | `appendStreamingContent(id, chunk)` | 新增：流式生成时追加 partial 内容到会话 |

## 7.6 自动生成会话标题

```typescript
export function autoTitle(sessionId: string, userContent: string): void {
  const session = getSession(sessionId);
  if (session && session.title === '新对话' && typeof userContent === 'string') {
    const title = userContent.slice(0, 30) + (userContent.length > 30 ? '...' : '');
    updateSessionTitle(sessionId, title);
  }
}
```

## 7.7 备份与恢复

```bash
cp packages/backend/data/yishan.db packages/backend/data/yishan.db.bak
cp packages/backend/data/yishan.db.bak packages/backend/data/yishan.db
sqlite3 packages/backend/data/yishan.db "SELECT id, title, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 10;"
```
