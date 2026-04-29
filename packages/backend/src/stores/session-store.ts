import { getDb } from '../db/index.js';

export interface Session {
  id: string;
  title: string;
  model: string;
  status: 'idle' | 'streaming' | 'completed' | 'failed';
  streamingContent?: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

export function listSessions(limit = 50, offset = 0): Session[] {
  const db = getDb();
  return db.prepare(`
    SELECT s.id, s.title, s.model, s.status, s.is_pinned,
           s.created_at as createdAt, s.updated_at as updatedAt,
           COUNT(m.id) as messageCount
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.is_pinned DESC, s.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Session[];
}

export function getSession(id: string): Session | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, model, status, streaming_content as streamingContent,
           is_pinned as isPinned, created_at as createdAt, updated_at as updatedAt
    FROM sessions WHERE id = ?
  `).get(id) as Session | undefined;
}

export function createSession(model: string, title?: string): Session {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, title, model, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(id, title || '新对话', model, now, now);
  return { id, title: title || '新对话', model, status: 'idle', isPinned: false, createdAt: now, updatedAt: now };
}

export function updateSessionTitle(id: string, title: string): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, Date.now(), id);
}

export function updateSessionPin(id: string, isPinned: boolean): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET is_pinned = ?, updated_at = ? WHERE id = ?')
    .run(isPinned ? 1 : 0, Date.now(), id);
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

export function autoTitle(sessionId: string, userContent: string): void {
  const session = getSession(sessionId);
  if (session && session.title === '新对话' && typeof userContent === 'string') {
    const title = userContent.slice(0, 30) + (userContent.length > 30 ? '...' : '');
    updateSessionTitle(sessionId, title);
  }
}