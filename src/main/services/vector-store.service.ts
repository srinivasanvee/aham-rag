import * as lancedb from '@lancedb/lancedb'

export interface ChunkRecord {
  id: string
  document_id: string
  topic_id: string
  chunk_index: number
  text: string
  vector: number[]
  page_number: number
  start_char: number
  end_char: number
}

export interface SearchResult extends ChunkRecord {
  _distance: number
}

export class VectorStoreService {
  private db: lancedb.Connection | null = null
  private chunksTable: lancedb.Table | null = null

  async initialize(dbPath: string): Promise<void> {
    this.db = await lancedb.connect(dbPath)
    const tableNames = await this.db.tableNames()
    if (tableNames.includes('chunks')) {
      this.chunksTable = await this.db.openTable('chunks')
    }
  }

  async addChunks(chunks: ChunkRecord[]): Promise<void> {
    if (!this.db) throw new Error('VectorStore not initialized')
    if (chunks.length === 0) return
    if (!this.chunksTable) {
      this.chunksTable = await this.db.createTable('chunks', chunks)
    } else {
      await this.chunksTable.add(chunks)
    }
  }

  async searchChunks(
    vector: number[],
    topicId: string,
    limit = 6
  ): Promise<SearchResult[]> {
    if (!this.chunksTable) return []
    try {
      const results = await this.chunksTable
        .search(vector)
        .limit(limit)
        .where(`topic_id = '${topicId}'`)
        .toArray()
      return results as unknown as SearchResult[]
    } catch {
      return []
    }
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    if (!this.chunksTable) return
    await this.chunksTable.delete(`document_id = '${documentId}'`)
  }

  async deleteByTopicId(topicId: string): Promise<void> {
    if (!this.chunksTable) return
    await this.chunksTable.delete(`topic_id = '${topicId}'`)
  }
}
