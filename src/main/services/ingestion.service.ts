import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import { splitText } from '../utils/chunker'
import { parsePdf } from './parsers/pdf.parser'
import { parseDocx } from './parsers/docx.parser'
import { parseText } from './parsers/text.parser'
import type { DatabaseService } from './database.service'
import type { VectorStoreService, ChunkRecord } from './vector-store.service'
import type { OllamaService } from './ollama.service'
import { DOCUMENTS_PATH } from '../utils/paths'
import { ingestLog, separator } from '../utils/logger'

export type MimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'text/markdown'

const EXTENSION_MIME: Record<string, MimeType> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown'
}

export function getMimeType(filePath: string): MimeType | null {
  const ext = path.extname(filePath).toLowerCase()
  return EXTENSION_MIME[ext] ?? null
}

export type ProgressCallback = (payload: {
  documentId: string
  status: 'processing' | 'ready' | 'error'
  chunkCount?: number
  error?: string
}) => void

export class IngestionService {
  private queue: (() => Promise<void>)[] = []
  private running = false

  constructor(
    private db: DatabaseService,
    private vector: VectorStoreService,
    private ollama: OllamaService
  ) {}

  async queueFile(
    topicId: string,
    filePath: string,
    onProgress: ProgressCallback
  ): Promise<{ documentId: string; filename: string }> {
    const mimeType = getMimeType(filePath)
    if (!mimeType) throw new Error(`Unsupported file type: ${path.extname(filePath)}`)

    const documentId = uuidv4()
    const filename = path.basename(filePath)
    const ext = path.extname(filePath)
    const storedPath = path.join(DOCUMENTS_PATH(), `${documentId}${ext}`)
    const stat = await fs.stat(filePath)

    await fs.copyFile(filePath, storedPath)

    this.db.insertDocument({
      id: documentId,
      topic_id: topicId,
      filename,
      original_path: filePath,
      stored_path: storedPath,
      mime_type: mimeType,
      size_bytes: stat.size,
      status: 'pending',
      chunk_count: 0,
      error_message: null
    })

    ingestLog.info(separator('INGEST START'))
    ingestLog.info(`📄 FILE QUEUED  : "${filename}"`)
    ingestLog.info(`   documentId  : ${documentId}`)
    ingestLog.info(`   topicId     : ${topicId}`)
    ingestLog.info(`   mimeType    : ${mimeType}`)
    ingestLog.info(`   size        : ${formatBytes(stat.size)}`)
    ingestLog.info(`   storedPath  : ${storedPath}`)
    ingestLog.info(`   queueLength : ${this.queue.length + 1}`)

    this.queue.push(() => this.processDocument(documentId, storedPath, mimeType, topicId, onProgress))
    this.drain()

    return { documentId, filename }
  }

  private drain(): void {
    if (this.running || this.queue.length === 0) return
    this.running = true
    const task = this.queue.shift()!
    task().finally(() => {
      this.running = false
      this.drain()
    })
  }

  private async processDocument(
    documentId: string,
    storedPath: string,
    mimeType: MimeType,
    topicId: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    const startTotal = Date.now()
    try {
      this.db.updateDocumentStatus(documentId, 'processing')
      onProgress({ documentId, status: 'processing' })

      // ── Extract text ─────────────────────────────────────────────────────
      const t1 = Date.now()
      const text = await this.extractText(storedPath, mimeType)
      ingestLog.info(`🔤 TEXT EXTRACTED: ${text.length.toLocaleString()} chars (${Date.now() - t1}ms)`)
      if (text.length === 0) throw new Error('No text extracted from document')

      // ── Chunk ────────────────────────────────────────────────────────────
      const t2 = Date.now()
      const chunks = splitText(text)
      if (chunks.length === 0) throw new Error('Chunker produced zero chunks')
      ingestLog.info(
        `✂️  CHUNKED       : ${chunks.length} chunks (avg ${Math.round(chunks.reduce((s, c) => s + c.text.length, 0) / chunks.length)} chars/chunk) (${Date.now() - t2}ms)`
      )
      ingestLog.debug(`   first chunk  : "${chunks[0].text.slice(0, 120).replace(/\n/g, ' ')}…"`)
      ingestLog.debug(`   last chunk   : "${chunks[chunks.length - 1].text.slice(0, 120).replace(/\n/g, ' ')}…"`)

      // ── Embed ────────────────────────────────────────────────────────────
      const texts = chunks.map((c) => c.text)
      const batchSize = 32
      const batchCount = Math.ceil(texts.length / batchSize)
      ingestLog.info(`🔢 EMBEDDING     : ${chunks.length} chunks in ${batchCount} batch(es) of ${batchSize}...`)
      const t3 = Date.now()
      const embeddings = await this.ollama.embedBatched(texts)
      ingestLog.info(`   ✓ embedded in ${Date.now() - t3}ms (${embeddings[0]?.length ?? 0}-dim vectors)`)

      // ── Store ────────────────────────────────────────────────────────────
      const chunkRecords: ChunkRecord[] = chunks.map((chunk, i) => ({
        id: uuidv4(),
        document_id: documentId,
        topic_id: topicId,
        chunk_index: i,
        text: chunk.text,
        vector: embeddings[i],
        page_number: -1,
        start_char: chunk.startChar,
        end_char: chunk.endChar
      }))

      const t4 = Date.now()
      await this.vector.addChunks(chunkRecords)
      ingestLog.info(`💾 STORED        : ${chunkRecords.length} vectors in LanceDB (${Date.now() - t4}ms)`)

      this.db.updateDocumentStatus(documentId, 'ready', chunks.length)
      onProgress({ documentId, status: 'ready', chunkCount: chunks.length })

      ingestLog.info(
        `✅ INGEST DONE   : documentId=${documentId} | ${chunks.length} chunks | total=${Date.now() - startTotal}ms`
      )
      ingestLog.info(separator())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ingestLog.error(`❌ INGEST FAILED : documentId=${documentId}`)
      ingestLog.error(`   error: ${message}`)
      ingestLog.info(separator())
      this.db.updateDocumentStatus(documentId, 'error', undefined, message)
      onProgress({ documentId, status: 'error', error: message })
    }
  }

  private async extractText(filePath: string, mimeType: MimeType): Promise<string> {
    switch (mimeType) {
      case 'application/pdf': {
        const { text } = await parsePdf(filePath)
        return text
      }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        const { text } = await parseDocx(filePath)
        return text
      }
      case 'text/plain':
      case 'text/markdown': {
        const { text } = await parseText(filePath)
        return text
      }
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
