import { getDb } from '../db/index.js';

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string | object[];
  toolCalls?: any[];
  createdAt: number;
  usageInput?: number;
  usageOutput?: number;
  deletedAt?: number;
}

export function getMessages(sessionId: string, limit = 100, offset = 0): StoredMessage[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, session_id as sessionId, role, content, tool_calls as toolCalls, created_at as createdAt,
           usage_input as usageInput, usage_output as usageOutput, deleted_at as deletedAt
    FROM messages
    WHERE session_id = ? AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT ? OFFSET ?
  `).all(sessionId, limit, offset) as any[];

  return rows.map(row => ({
    ...row,
    content: JSON.parse(row.content),
    toolCalls: row.toolCalls ? JSON.parse(row.toolCalls) : undefined,
  }));
}

export function appendMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string | object[],
  usage?: { inputTokens: number; outputTokens: number },
  toolCalls?: any[]
): StoredMessage {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const contentJson = JSON.stringify(content);
  const toolCallsJson = toolCalls ? JSON.stringify(toolCalls) : null;

  db.prepare(`
    INSERT INTO messages (id, session_id, role, content, tool_calls, created_at, usage_input, usage_output)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, role, contentJson, toolCallsJson, now, usage?.inputTokens ?? null, usage?.outputTokens ?? null);

  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  return { id, sessionId, role, content, toolCalls, createdAt: now, usageInput: usage?.inputTokens, usageOutput: usage?.outputTokens };
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
    SELECT role, content FROM messages WHERE session_id = ? AND deleted_at IS NULL ORDER BY created_at ASC
  `).all(sessionId) as any[];
  return rows.map(row => ({ role: row.role, content: JSON.parse(row.content) }));
}

export function softDeleteMessagesAfter(sessionId: string, messageId: string): void {
  const db = getDb();

  const msgRow = db.prepare(`
    SELECT created_at FROM messages WHERE id = ? AND session_id = ?
  `).get(messageId, sessionId) as { created_at: number } | undefined;

  if (!msgRow) return;

  const now = Date.now();
  db.prepare(`
    UPDATE messages SET deleted_at = ? WHERE session_id = ? AND created_at >= ? AND deleted_at IS NULL
  `).run(now, sessionId, msgRow.created_at);

  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
}

export function restoreMessages(sessionId: string, messageId: string): void {
  const db = getDb();

  const msgRow = db.prepare(`
    SELECT created_at FROM messages WHERE id = ? AND session_id = ?
  `).get(messageId, sessionId) as { created_at: number } | undefined;

  if (!msgRow) return;

  db.prepare(`
    UPDATE messages SET deleted_at = NULL WHERE session_id = ? AND created_at >= ? AND deleted_at IS NOT NULL
  `).run(sessionId, msgRow.created_at);
}