import { v4 as uuidv4 } from 'uuid'
import type { DatabaseService } from './database.service'
import type { VectorStoreService } from './vector-store.service'
import type { OllamaService, OllamaMessage } from './ollama.service'
import type { SourceChunk } from '../../renderer/src/types'
import { ragLog, separator } from '../utils/logger'

const SCORE_THRESHOLD = 0.5
const TOP_K = 6
const HISTORY_TURNS = 4

export class RagService {
  constructor(
    private db: DatabaseService,
    private vector: VectorStoreService,
    private ollama: OllamaService
  ) {}

  async query(params: {
    topicId: string
    conversationId: string | undefined
    message: string
    requestId: string
    onToken: (token: string) => void
  }): Promise<{
    conversationId: string
    messageId: string
    sources: SourceChunk[]
  }> {
    const { topicId, message, requestId, onToken } = params
    const startTotal = Date.now()

    ragLog.info(separator('RAG QUERY START'))
    ragLog.info(`📝 QUESTION     : "${message}"`)
    ragLog.info(`   topicId      : ${topicId}`)
    ragLog.info(`   conversationId: ${params.conversationId ?? '(new)'}`)
    ragLog.info(`   requestId    : ${requestId}`)

    // ── Ensure conversation exists ──────────────────────────────────────────
    let conversationId = params.conversationId
    if (!conversationId) {
      conversationId = uuidv4()
      this.db.createConversation(conversationId, topicId)
      ragLog.info(`💬 NEW CONVERSATION: ${conversationId}`)
    }

    // ── Step 1: Embed the query ─────────────────────────────────────────────
    const t1 = Date.now()
    const [queryVector] = await this.ollama.embed([message])
    ragLog.info(`🔍 EMBED QUESTION: ${queryVector.length}-dim vector (${ms(t1)})`)

    // ── Step 2: Vector similarity search ───────────────────────────────────
    const t2 = Date.now()
    const rawResults = await this.vector.searchChunks(queryVector, topicId, TOP_K)
    const retrieved = rawResults.filter((r) => r._distance <= SCORE_THRESHOLD)

    ragLog.info(
      `🎯 VECTOR SEARCH : ${rawResults.length} candidates → ${retrieved.length} kept (threshold ≤ ${SCORE_THRESHOLD}) (${ms(t2)})`
    )

    if (rawResults.length === 0) {
      ragLog.warn('   ⚠ No vectors found for this topic — are documents ingested?')
    }

    // ── Step 3: Resolve filenames + build sources ───────────────────────────
    const docIds = [...new Set(retrieved.map((r) => r.document_id))]
    const docRows = this.db.getDocuments(topicId).filter((d) => docIds.includes(d.id))
    const filenameMap = new Map(docRows.map((d) => [d.id, d.filename]))

    const sources: SourceChunk[] = retrieved.map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      filename: filenameMap.get(r.document_id) ?? 'Unknown',
      text: r.text,
      score: 1 - r._distance,
      pageNumber: r.page_number === -1 ? undefined : r.page_number
    }))

    ragLog.info(`📄 RETRIEVED CHUNKS (${sources.length}):`)
    if (sources.length === 0) {
      ragLog.info('   (none — response will say context is unavailable)')
    } else {
      sources.forEach((s, i) => {
        const page = s.pageNumber !== undefined ? ` p.${s.pageNumber}` : ''
        ragLog.info(`   #${i + 1} score=${s.score.toFixed(4)} | ${s.filename}${page}`)
        ragLog.debug(`        "${preview(s.text, 200)}"`)
      })
    }

    // ── Step 4: Build prompt ────────────────────────────────────────────────
    const contextText = sources.length
      ? sources.map((s) => `--- Source: ${s.filename} ---\n${s.text}`).join('\n\n')
      : 'No relevant context found in the uploaded documents.'

    const systemMessage: OllamaMessage = {
      role: 'system',
      content:
        `You are a helpful assistant. Answer questions based ONLY on the provided context below. ` +
        `If the context does not contain the answer, say so clearly. Do not use outside knowledge.\n\nCONTEXT:\n${contextText}`
    }

    const recentMsgs = this.db.getRecentMessages(conversationId, HISTORY_TURNS * 2)
    const historyMessages: OllamaMessage[] = recentMsgs.map((m) => ({
      role: m.role,
      content: m.content
    }))
    const userMessage: OllamaMessage = { role: 'user', content: message }
    const messages: OllamaMessage[] = [systemMessage, ...historyMessages, userMessage]

    ragLog.info(`📋 CONTEXT SENT TO LLM:`)
    ragLog.info(`   sources   : ${sources.length}`)
    ragLog.info(`   contextLen: ${contextText.length} chars`)
    ragLog.debug(`   context text:\n${indent(contextText, 6)}`)

    ragLog.info(`📨 FULL PROMPT STRUCTURE (${messages.length} messages):`)
    messages.forEach((m, i) => {
      ragLog.info(`   [${i}] ${m.role.padEnd(9)}: ${preview(m.content, 180)}`)
    })
    ragLog.debug(`   full system message:\n${indent(systemMessage.content, 6)}`)

    // ── Step 5: Persist user message ────────────────────────────────────────
    const userMsgId = uuidv4()
    this.db.insertMessage({
      id: userMsgId,
      conversation_id: conversationId,
      role: 'user',
      content: message,
      sources_json: null
    })

    // ── Step 6: Stream LLM response ─────────────────────────────────────────
    ragLog.info(`🤖 CALLING LLM (streaming)...`)
    const t3 = Date.now()
    const answer = await this.ollama.chatStream(messages, onToken)
    const llmMs = Date.now() - t3

    ragLog.info(`✅ LLM RESPONSE:`)
    ragLog.info(`   length  : ${answer.length} chars`)
    ragLog.info(`   duration: ${(llmMs / 1000).toFixed(2)}s`)
    ragLog.info(`   text    : "${preview(answer, 300)}"`)
    ragLog.debug(`   full response:\n${indent(answer, 6)}`)

    // ── Step 7: Persist assistant message ───────────────────────────────────
    const assistantMsgId = uuidv4()
    this.db.insertMessage({
      id: assistantMsgId,
      conversation_id: conversationId,
      role: 'assistant',
      content: answer,
      sources_json: sources.length ? JSON.stringify(sources) : null
    })

    ragLog.info(
      `${separator()} total=${ms(startTotal)} | convId=${conversationId} | msgId=${assistantMsgId}`
    )

    return { conversationId, messageId: assistantMsgId, sources }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ms(startMs: number): string {
  return `${Date.now() - startMs}ms`
}

function preview(text: string, maxLen: number): string {
  const clean = text.replace(/\n+/g, ' ').trim()
  return clean.length > maxLen ? clean.slice(0, maxLen) + '…' : clean
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((l) => pad + l)
    .join('\n')
}
