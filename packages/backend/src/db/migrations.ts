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
      is_pinned           INTEGER NOT NULL DEFAULT 0,
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

  const columns = db.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
  const hasToolCalls = columns.some(col => col.name === 'tool_calls');
  if (!hasToolCalls) {
    db.exec("ALTER TABLE messages ADD COLUMN tool_calls TEXT");
  }

  const hasDeletedAt = columns.some(col => col.name === 'deleted_at');
  if (!hasDeletedAt) {
    db.exec("ALTER TABLE messages ADD COLUMN deleted_at INTEGER");
  }
}