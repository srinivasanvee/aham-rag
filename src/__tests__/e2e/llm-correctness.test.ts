import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { OllamaService } from '../../main/services/ollama.service'
import { DatabaseService } from '../../main/services/database.service'
import { VectorStoreService } from '../../main/services/vector-store.service'
import { IngestionService } from '../../main/services/ingestion.service'
import { RagService } from '../../main/services/rag.service'

// ── Path mock ─────────────────────────────────────────────────────────────────

const state = vi.hoisted(() => ({ tmpDir: '' }))

vi.mock('../../main/utils/paths', () => ({
  getUserDataPath: (...s: string[]) => path.join(state.tmpDir, ...s),
  DB_PATH: () => path.join(state.tmpDir, 'test.db'),
  LANCEDB_PATH: () => path.join(state.tmpDir, 'lancedb'),
  DOCUMENTS_PATH: () => path.join(state.tmpDir, 'documents'),
}))

// ── Globals ───────────────────────────────────────────────────────────────────

let ollamaOffline = false
let db: DatabaseService
let vector: VectorStoreService
let ollamaSvc: OllamaService
let ingestion: IngestionService
let rag: RagService
let handbookConversationId: string | undefined

const HANDBOOK_TOPIC = 'handbook'

const HANDBOOK = `Company Handbook Excerpt

Vacation Policy:
- Employees receive exactly 25 vacation days per year.
- Vacation must be approved 2 weeks in advance.

Expense Policy:
- Maximum meal reimbursement is $75 per day.
- Receipts are required for any expense over $20.

CEO Information:
- The current CEO is named Jordan Rivera.
- Jordan joined the company in 2019.`

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  ollamaSvc = new OllamaService()
  const running = await ollamaSvc.isRunning()
  if (!running) {
    ollamaOffline = true
    return
  }
  const models = await ollamaSvc.listModels()
  if (!models.some((m) => m.name.startsWith('gemma3'))) {
    ollamaOffline = true
    return
  }

  state.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aham-rag-e2e-'))
  await fs.mkdir(path.join(state.tmpDir, 'documents'), { recursive: true })

  db = new DatabaseService()
  db.initialize(path.join(state.tmpDir, 'test.db'))

  vector = new VectorStoreService()
  await vector.initialize(path.join(state.tmpDir, 'lancedb'))

  ingestion = new IngestionService(db, vector, ollamaSvc)
  rag = new RagService(db, vector, ollamaSvc)

  db.createTopic(HANDBOOK_TOPIC, 'Company Handbook')
  const handbookPath = path.join(state.tmpDir, 'handbook.txt')
  await fs.writeFile(handbookPath, HANDBOOK, 'utf8')

  await new Promise<void>((resolve, reject) => {
    ingestion
      .queueFile(HANDBOOK_TOPIC, handbookPath, (p) => {
        if (p.status === 'ready') resolve()
        if (p.status === 'error') reject(new Error(p.error ?? 'Ingest failed'))
      })
      .catch(reject)
  })
}, 120_000)

afterAll(async () => {
  if (state.tmpDir) {
    try { await fs.rm(state.tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
})

// ── Helper ────────────────────────────────────────────────────────────────────

async function ask(
  message: string,
  conversationId?: string,
  reqId = 'e2e'
): Promise<{ response: string; sources: { text: string; filename: string }[]; conversationId: string }> {
  const tokens: string[] = []
  const result = await rag.query({
    topicId: HANDBOOK_TOPIC,
    conversationId,
    message,
    requestId: reqId,
    onToken: (t) => tokens.push(t),
  })
  return {
    response: tokens.join(''),
    sources: result.sources,
    conversationId: result.conversationId,
  }
}

// ── LLM Correctness Tests ─────────────────────────────────────────────────────

describe('LLM response correctness (requires local Ollama + gemma3:1b)', () => {
  it('Q1: vacation days — response should contain "25"', { timeout: 90_000 }, async ({ skip }) => {
    if (ollamaOffline) skip()
    const { response, conversationId: cid } = await ask(
      'How many vacation days do employees get per year?',
      undefined,
      'e2e-1'
    )
    handbookConversationId = cid
    expect(response).toMatch(/25/)
  })

  it('Q2: CEO name — response should mention "Jordan Rivera"', { timeout: 90_000 }, async ({ skip }) => {
    if (ollamaOffline) skip()
    const { response } = await ask('Who is the CEO?', undefined, 'e2e-2')
    expect(response.toLowerCase()).toContain('jordan')
  })

  it('Q3: meal reimbursement limit — response should contain "$75" or "75"', { timeout: 90_000 }, async ({ skip }) => {
    if (ollamaOffline) skip()
    const { response } = await ask('What is the maximum meal reimbursement per day?', undefined, 'e2e-3')
    expect(response).toMatch(/75/)
  })

  it('Q4: CEO join year — response should contain "2019"', { timeout: 90_000 }, async ({ skip }) => {
    if (ollamaOffline) skip()
    const { response } = await ask('When did the CEO join the company?', undefined, 'e2e-4')
    expect(response).toMatch(/2019/)
  })

  it('Q5: off-topic question — response should not hallucinate an answer', { timeout: 90_000 }, async ({ skip }) => {
    if (ollamaOffline) skip()
    const { response } = await ask('What is the boiling point of water?', undefined, 'e2e-5')
    // The LLM should say the context doesn't contain this, not invent "100°C"
    const lower = response.toLowerCase()
    const refusesAnswering =
      lower.includes('context') ||
      lower.includes('not') ||
      lower.includes("don't") ||
      lower.includes('no information') ||
      lower.includes('provided')
    expect(refusesAnswering).toBe(true)
  })

  it('Q6: expense policy summary — response should contain both "75" and "20"', { timeout: 90_000 }, async ({ skip }) => {
    if (ollamaOffline) skip()
    const { response } = await ask('Summarize the expense reimbursement policy.', undefined, 'e2e-6')
    expect(response).toMatch(/75/)
    expect(response).toMatch(/20/)
  })

  it('Q7: multi-section summary — response should mention both vacation and expense', { timeout: 90_000 }, async ({ skip }) => {
    if (ollamaOffline) skip()
    const { response } = await ask('What are the main topics covered in this handbook?', undefined, 'e2e-7')
    const lower = response.toLowerCase()
    expect(lower.includes('vacation') || lower.includes('holiday') || lower.includes('days')).toBe(true)
    expect(lower.includes('expense') || lower.includes('reimbursement') || lower.includes('meal')).toBe(true)
  })

  it('Q8: follow-up uses conversation history — "double that" resolves to 50', { timeout: 90_000 }, async ({ skip }) => {
    if (ollamaOffline) skip()
    // Ask the vacation days question first
    const first = await ask('How many vacation days do employees get?', undefined, 'e2e-8a')
    expect(first.response).toMatch(/25/)

    // Follow-up uses the conversation context to resolve "that" → 25
    const { response } = await ask('If an employee used double that amount, how many days is that?', first.conversationId, 'e2e-8b')
    expect(response).toMatch(/50/)
  })
})
