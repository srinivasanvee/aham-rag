import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { DatabaseService } from '../../main/services/database.service'

let db: DatabaseService
let dbPath: string

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `aham-test-${Date.now()}.db`)
  db = new DatabaseService()
  db.initialize(dbPath)
})

afterEach(() => {
  try { fs.unlinkSync(dbPath) } catch { /* ignore */ }
})

// ── Topics ────────────────────────────────────────────────────────────────────

describe('topics', () => {
  it('createTopic returns a topic and list includes it', () => {
    const topic = db.createTopic('t1', 'Engineering', 'All eng docs')
    expect(topic.id).toBe('t1')
    expect(topic.name).toBe('Engineering')
    const list = db.getTopics()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Engineering')
  })

  it('updateTopic changes the name', () => {
    db.createTopic('t1', 'Old Name')
    const updated = db.updateTopic('t1', 'New Name')
    expect(updated.name).toBe('New Name')
    expect(db.getTopicById('t1')!.name).toBe('New Name')
  })

  it('deleteTopic removes it and cascades to documents', () => {
    db.createTopic('t1', 'To Delete')
    db.insertDocument({
      id: 'd1', topic_id: 't1', filename: 'a.txt',
      original_path: '/tmp/a.txt', stored_path: '/tmp/a.txt',
      mime_type: 'text/plain', size_bytes: 100,
      status: 'ready', chunk_count: 5, error_message: null
    })
    db.deleteTopic('t1')
    expect(db.getTopics()).toHaveLength(0)
    expect(db.getDocuments('t1')).toHaveLength(0)
  })
})

// ── Documents ─────────────────────────────────────────────────────────────────

describe('documents', () => {
  beforeEach(() => db.createTopic('t1', 'Topic'))

  it('insertDocument and getDocuments returns the document', () => {
    db.insertDocument({
      id: 'd1', topic_id: 't1', filename: 'report.pdf',
      original_path: '/docs/report.pdf', stored_path: '/store/report.pdf',
      mime_type: 'application/pdf', size_bytes: 204800,
      status: 'pending', chunk_count: 0, error_message: null
    })
    const docs = db.getDocuments('t1')
    expect(docs).toHaveLength(1)
    expect(docs[0].filename).toBe('report.pdf')
    expect(docs[0].status).toBe('pending')
  })

  it('updateDocumentStatus to ready sets chunk_count', () => {
    db.insertDocument({
      id: 'd1', topic_id: 't1', filename: 'f.txt',
      original_path: '/f.txt', stored_path: '/f.txt',
      mime_type: 'text/plain', size_bytes: 500,
      status: 'pending', chunk_count: 0, error_message: null
    })
    db.updateDocumentStatus('d1', 'ready', 42)
    const doc = db.getDocuments('t1')[0]
    expect(doc.status).toBe('ready')
    expect(doc.chunk_count).toBe(42)
  })

  it('updateDocumentStatus to error stores the error message', () => {
    db.insertDocument({
      id: 'd1', topic_id: 't1', filename: 'bad.pdf',
      original_path: '/bad.pdf', stored_path: '/bad.pdf',
      mime_type: 'application/pdf', size_bytes: 100,
      status: 'processing', chunk_count: 0, error_message: null
    })
    db.updateDocumentStatus('d1', 'error', undefined, 'PDF parse failed')
    const doc = db.getDocuments('t1')[0]
    expect(doc.status).toBe('error')
    expect(doc.error_message).toBe('PDF parse failed')
  })

  it('deleteDocument removes it and returns stored path', () => {
    db.insertDocument({
      id: 'd1', topic_id: 't1', filename: 'rm.txt',
      original_path: '/rm.txt', stored_path: '/store/rm.txt',
      mime_type: 'text/plain', size_bytes: 10,
      status: 'ready', chunk_count: 2, error_message: null
    })
    const storedPath = db.deleteDocument('d1')
    expect(storedPath).toBe('/store/rm.txt')
    expect(db.getDocuments('t1')).toHaveLength(0)
  })
})

// ── Conversations & Messages ──────────────────────────────────────────────────

describe('conversations and messages', () => {
  beforeEach(() => db.createTopic('t1', 'Topic'))

  it('createConversation and getConversations lists it', () => {
    db.createConversation('c1', 't1', 'First chat')
    const convs = db.getConversations('t1')
    expect(convs).toHaveLength(1)
    expect(convs[0].id).toBe('c1')
    expect(convs[0].title).toBe('First chat')
  })

  it('insertMessage and getMessages returns messages in order', () => {
    db.createConversation('c1', 't1')
    db.insertMessage({ id: 'm1', conversation_id: 'c1', role: 'user', content: 'Hi', sources_json: null })
    db.insertMessage({ id: 'm2', conversation_id: 'c1', role: 'assistant', content: 'Hello!', sources_json: null })
    const msgs = db.getMessages('c1')
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
  })

  it('getRecentMessages respects the limit and returns in chronological order', () => {
    db.createConversation('c1', 't1')
    for (let i = 1; i <= 6; i++) {
      db.insertMessage({ id: `m${i}`, conversation_id: 'c1', role: 'user', content: `msg ${i}`, sources_json: null })
    }
    const recent = db.getRecentMessages('c1', 4)
    expect(recent).toHaveLength(4)
    // Should be the LAST 4 messages in ascending order
    expect(recent[0].content).toBe('msg 3')
    expect(recent[3].content).toBe('msg 6')
  })
})
