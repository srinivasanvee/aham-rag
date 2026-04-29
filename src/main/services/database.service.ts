import Database, { type Database as DB } from 'better-sqlite3'

export interface TopicRow {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  document_count: number
}

export interface DocumentRow {
  id: string
  topic_id: string
  filename: string
  original_path: string
  stored_path: string
  mime_type: string
  size_bytes: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  error_message: string | null
  chunk_count: number
  created_at: string
}

export interface ConversationRow {
  id: string
  topic_id: string
  title: string | null
  created_at: string
}

export interface MessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  sources_json: string | null
  created_at: string
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS topics (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  topic_id      TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  original_path TEXT NOT NULL,
  stored_path   TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','processing','ready','error')),
  error_message TEXT,
  chunk_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_topic_id ON documents(topic_id);
CREATE INDEX IF NOT EXISTS idx_documents_status   ON documents(status);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  topic_id   TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_topic ON conversations(topic_id);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content         TEXT NOT NULL,
  sources_json    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
`

export class DatabaseService {
  private db: DB | null = null

  initialize(dbPath: string): void {
    this.db = new Database(dbPath)
    this.db.exec(SCHEMA_SQL)
  }

  private get conn(): DB {
    if (!this.db) throw new Error('Database not initialized')
    return this.db
  }

  // ── Topics ──────────────────────────────────────────────────────────────────

  getTopics(): TopicRow[] {
    return this.conn
      .prepare(
        `SELECT t.*, COUNT(d.id) as document_count
         FROM topics t
         LEFT JOIN documents d ON d.topic_id = t.id
         GROUP BY t.id
         ORDER BY t.created_at DESC`
      )
      .all() as TopicRow[]
  }

  createTopic(id: string, name: string, description?: string): TopicRow {
    this.conn
      .prepare('INSERT INTO topics (id, name, description) VALUES (?, ?, ?)')
      .run(id, name, description ?? null)
    return this.getTopicById(id)!
  }

  updateTopic(id: string, name?: string, description?: string): TopicRow {
    if (name !== undefined) {
      this.conn
        .prepare("UPDATE topics SET name = ?, updated_at = datetime('now') WHERE id = ?")
        .run(name, id)
    }
    if (description !== undefined) {
      this.conn
        .prepare("UPDATE topics SET description = ?, updated_at = datetime('now') WHERE id = ?")
        .run(description, id)
    }
    return this.getTopicById(id)!
  }

  deleteTopic(id: string): void {
    this.conn.prepare('DELETE FROM topics WHERE id = ?').run(id)
  }

  getTopicById(id: string): TopicRow | undefined {
    return this.conn
      .prepare(
        `SELECT t.*, COUNT(d.id) as document_count
         FROM topics t
         LEFT JOIN documents d ON d.topic_id = t.id
         WHERE t.id = ?
         GROUP BY t.id`
      )
      .get(id) as TopicRow | undefined
  }

  // ── Documents ────────────────────────────────────────────────────────────────

  getDocuments(topicId: string): DocumentRow[] {
    return this.conn
      .prepare('SELECT * FROM documents WHERE topic_id = ? ORDER BY created_at DESC')
      .all(topicId) as DocumentRow[]
  }

  insertDocument(doc: Omit<DocumentRow, 'created_at'>): void {
    this.conn
      .prepare(
        `INSERT INTO documents
         (id, topic_id, filename, original_path, stored_path, mime_type, size_bytes, status, chunk_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        doc.id,
        doc.topic_id,
        doc.filename,
        doc.original_path,
        doc.stored_path,
        doc.mime_type,
        doc.size_bytes,
        doc.status,
        doc.chunk_count
      )
  }

  updateDocumentStatus(
    id: string,
    status: DocumentRow['status'],
    chunkCount?: number,
    errorMessage?: string
  ): void {
    this.conn
      .prepare(
        'UPDATE documents SET status = ?, chunk_count = COALESCE(?, chunk_count), error_message = ? WHERE id = ?'
      )
      .run(status, chunkCount ?? null, errorMessage ?? null, id)
  }

  deleteDocument(id: string): string | null {
    const row = this.conn
      .prepare('SELECT stored_path FROM documents WHERE id = ?')
      .get(id) as { stored_path: string } | undefined
    if (!row) return null
    this.conn.prepare('DELETE FROM documents WHERE id = ?').run(id)
    return row.stored_path
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  getConversations(topicId: string): ConversationRow[] {
    return this.conn
      .prepare('SELECT * FROM conversations WHERE topic_id = ? ORDER BY created_at DESC')
      .all(topicId) as ConversationRow[]
  }

  createConversation(id: string, topicId: string, title?: string): ConversationRow {
    this.conn
      .prepare('INSERT INTO conversations (id, topic_id, title) VALUES (?, ?, ?)')
      .run(id, topicId, title ?? null)
    return this.conn
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(id) as ConversationRow
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  getMessages(conversationId: string): MessageRow[] {
    return this.conn
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conversationId) as MessageRow[]
  }

  getRecentMessages(conversationId: string, limit: number): MessageRow[] {
    return this.conn
      .prepare(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(conversationId, limit)
      .reverse() as MessageRow[]
  }

  insertMessage(msg: Omit<MessageRow, 'created_at'>): void {
    this.conn
      .prepare(
        'INSERT INTO messages (id, conversation_id, role, content, sources_json) VALUES (?, ?, ?, ?, ?)'
      )
      .run(msg.id, msg.conversation_id, msg.role, msg.content, msg.sources_json ?? null)
  }
}
