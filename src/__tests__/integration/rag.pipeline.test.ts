import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { MockOllamaService } from '../helpers/mock-ollama'
import { DatabaseService } from '../../main/services/database.service'
import { VectorStoreService } from '../../main/services/vector-store.service'
import { IngestionService } from '../../main/services/ingestion.service'
import { RagService } from '../../main/services/rag.service'

// ── Path mock ─────────────────────────────────────────────────────────────────
// vi.hoisted ensures state is defined before vi.mock factory and before imports

const state = vi.hoisted(() => ({ tmpDir: '' }))

vi.mock('../../main/utils/paths', () => ({
  getUserDataPath: (...s: string[]) => path.join(state.tmpDir, ...s),
  DB_PATH: () => path.join(state.tmpDir, 'test.db'),
  LANCEDB_PATH: () => path.join(state.tmpDir, 'lancedb'),
  DOCUMENTS_PATH: () => path.join(state.tmpDir, 'documents'),
}))

// ── Shared services ───────────────────────────────────────────────────────────

let db: DatabaseService
let vector: VectorStoreService
let ollama: MockOllamaService
let ingestion: IngestionService
let rag: RagService

async function writeTmpFile(name: string, content: string): Promise<string> {
  const p = path.join(state.tmpDir, name)
  await fs.writeFile(p, content, 'utf8')
  return p
}

async function ingestAndWait(topicId: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ingestion
      .queueFile(topicId, filePath, (payload) => {
        if (payload.status === 'ready') resolve(payload.documentId)
        if (payload.status === 'error') reject(new Error(payload.error ?? 'Ingest failed'))
      })
      .catch(reject)
  })
}

beforeAll(async () => {
  state.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aham-rag-integration-'))
  await fs.mkdir(path.join(state.tmpDir, 'documents'), { recursive: true })

  db = new DatabaseService()
  db.initialize(path.join(state.tmpDir, 'test.db'))

  vector = new VectorStoreService()
  await vector.initialize(path.join(state.tmpDir, 'lancedb'))

  ollama = new MockOllamaService()
  ingestion = new IngestionService(db, vector, ollama as never)
  rag = new RagService(db, vector, ollama as never)
})

afterAll(async () => {
  try { await fs.rm(state.tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('rag pipeline', () => {
  it('1. chunks stored in DB and LanceDB after ingest', async () => {
    db.createTopic('t1', 'Topic 1')
    const filePath = await writeTmpFile('t1.txt', 'Important content about software engineering best practices.')
    await ingestAndWait('t1', filePath)

    const docs = db.getDocuments('t1')
    expect(docs).toHaveLength(1)
    expect(docs[0].status).toBe('ready')
    expect(docs[0].chunk_count).toBeGreaterThan(0)

    const [qv] = await ollama.embed(['test query'])
    const results = await vector.searchChunks(qv, 't1', 3)
    expect(results.length).toBeGreaterThan(0)
  })

  it('2. specific fact is found in retrieved sources', async () => {
    db.createTopic('t2', 'Topic 2')
    const filePath = await writeTmpFile(
      't2.txt',
      'The magic number is 42. This numeric fact is very important and should be retrievable by semantic search.'
    )
    await ingestAndWait('t2', filePath)

    ollama.setNextLLMResponse('The magic number is 42.')
    const result = await rag.query({
      topicId: 't2',
      conversationId: undefined,
      message: 'What is the magic number?',
      requestId: 'req-2',
      onToken: () => {},
    })

    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources.some((s) => s.text.includes('42'))).toBe(true)
  })

  it('3. broad query returns multiple source chunks', async () => {
    db.createTopic('t3', 'Topic 3')
    // Each paragraph ~950 chars — exceeds the 800-char chunkSize so each splits independently
    const para = (n: number) =>
      `Section ${n}: ${'Content about section ' + n + ' with important details. '.repeat(36)}`
    const content = [para(1), para(2), para(3), para(4)].join('\n\n')
    const filePath = await writeTmpFile('t3.txt', content)
    await ingestAndWait('t3', filePath)

    ollama.setNextLLMResponse('Here is a summary of all sections.')
    const result = await rag.query({
      topicId: 't3',
      conversationId: undefined,
      message: 'summarize the entire document',
      requestId: 'req-3',
      onToken: () => {},
    })

    expect(result.sources.length).toBeGreaterThan(1)
  })

  it('4. chunk text appears verbatim in system message sent to LLM', async () => {
    db.createTopic('t4', 'Topic 4')
    const uniquePhrase = 'XYZZY_UNIQUE_MARKER_99887766'
    const filePath = await writeTmpFile('t4.txt', `The secret identifier is: ${uniquePhrase}. Keep this safe.`)
    await ingestAndWait('t4', filePath)

    ollama.reset()
    ollama.setNextLLMResponse('The identifier is XYZZY_UNIQUE_MARKER_99887766.')
    await rag.query({
      topicId: 't4',
      conversationId: undefined,
      message: 'What is the secret identifier?',
      requestId: 'req-4',
      onToken: () => {},
    })

    const systemMsg = ollama.lastMessages[0]
    expect(systemMsg.role).toBe('system')
    expect(systemMsg.content).toContain(uniquePhrase)
  })

  it('5. topic with no documents produces "no relevant context" in prompt', async () => {
    db.createTopic('t5', 'Empty Topic')

    ollama.reset()
    await rag.query({
      topicId: 't5',
      conversationId: undefined,
      message: 'What is in this knowledge base?',
      requestId: 'req-5',
      onToken: () => {},
    })

    const systemMsg = ollama.lastMessages[0]
    expect(systemMsg.role).toBe('system')
    expect(systemMsg.content.toLowerCase()).toContain('no relevant context')
  })

  it('6. document in topicA is not visible when querying topicB', async () => {
    db.createTopic('t6a', 'Topic 6A')
    db.createTopic('t6b', 'Topic 6B — empty')

    const filePath = await writeTmpFile('t6a.txt', 'Exclusive content about rare Amazonian butterflies only in topic A.')
    await ingestAndWait('t6a', filePath)

    const result = await rag.query({
      topicId: 't6b',
      conversationId: undefined,
      message: 'Tell me about rare Amazonian butterflies',
      requestId: 'req-6',
      onToken: () => {},
    })

    expect(result.sources).toHaveLength(0)
  })

  it('7. follow-up query includes prior turn in messages sent to LLM', async () => {
    db.createTopic('t7', 'Topic 7')
    const filePath = await writeTmpFile('t7.txt', 'The answer to the ultimate question of life is 42.')
    await ingestAndWait('t7', filePath)

    ollama.setNextLLMResponse('The answer is 42.')
    const first = await rag.query({
      topicId: 't7',
      conversationId: undefined,
      message: 'What is the answer to the ultimate question?',
      requestId: 'req-7a',
      onToken: () => {},
    })

    ollama.reset()
    ollama.setNextLLMResponse('Yes, still 42.')
    await rag.query({
      topicId: 't7',
      conversationId: first.conversationId,
      message: 'Are you absolutely sure?',
      requestId: 'req-7b',
      onToken: () => {},
    })

    const userMsgs = ollama.lastMessages.filter((m) => m.role === 'user')
    const assistantMsgs = ollama.lastMessages.filter((m) => m.role === 'assistant')
    expect(userMsgs.length).toBeGreaterThanOrEqual(2)
    expect(assistantMsgs.length).toBeGreaterThanOrEqual(1)
  })

  it('8. multi-document: query retrieves chunk from the relevant document', async () => {
    db.createTopic('t8', 'Topic 8')

    const doc1 = await writeTmpFile('t8-apples.txt', 'Red apples are grown in orchards. Apple cultivation requires temperate climates.')
    const doc2 = await writeTmpFile('t8-whales.txt', 'Blue whales are the largest mammals on Earth. They live in deep ocean waters.')

    await ingestAndWait('t8', doc1)
    await ingestAndWait('t8', doc2)

    ollama.setNextLLMResponse('Blue whales are the largest mammals.')
    const result = await rag.query({
      topicId: 't8',
      conversationId: undefined,
      message: 'Tell me everything you know about blue whales',
      requestId: 'req-8',
      onToken: () => {},
    })

    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources.some((s) => s.text.toLowerCase().includes('whale'))).toBe(true)
  })
})
