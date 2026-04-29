import { getDb } from '../db/index.js';

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
  const contentJson = JSON.stringify(content);

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