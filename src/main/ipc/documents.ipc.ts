import { ipcMain, BrowserWindow, dialog } from 'electron'
import type { DatabaseService } from '../services/database.service'
import type { VectorStoreService } from '../services/vector-store.service'
import type { OllamaService } from '../services/ollama.service'
import { IngestionService } from '../services/ingestion.service'

export function registerDocumentsIPC(
  mainWindow: BrowserWindow,
  db: DatabaseService,
  vector: VectorStoreService,
  ollama: OllamaService
): void {
  const ingestion = new IngestionService(db, vector, ollama)

  ipcMain.handle('dialog:open-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(
    'documents:list',
    (_event, { topicId }: { topicId: string }) => {
      const rows = db.getDocuments(topicId)
      return rows.map((r) => ({
        id: r.id,
        topicId: r.topic_id,
        filename: r.filename,
        originalPath: r.original_path,
        storedPath: r.stored_path,
        mimeType: r.mime_type,
        sizeBytes: r.size_bytes,
        status: r.status,
        errorMessage: r.error_message ?? undefined,
        chunkCount: r.chunk_count,
        createdAt: r.created_at
      }))
    }
  )

  ipcMain.handle(
    'documents:ingest',
    async (_event, { topicId, filePaths }: { topicId: string; filePaths: string[] }) => {
      const results: { documentId: string; filename: string }[] = []
      for (const fp of filePaths) {
        try {
          const info = await ingestion.queueFile(topicId, fp, (progress) => {
            mainWindow.webContents.send('documents:progress', progress)
          })
          results.push(info)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          mainWindow.webContents.send('documents:progress', {
            documentId: 'unknown',
            status: 'error',
            error: message
          })
        }
      }
      return results
    }
  )

  ipcMain.handle(
    'documents:delete',
    async (_event, { documentId }: { documentId: string }) => {
      const storedPath = db.deleteDocument(documentId)
      if (storedPath) {
        const { unlink } = await import('fs/promises')
        await unlink(storedPath).catch(() => undefined)
      }
      await vector.deleteByDocumentId(documentId)
    }
  )
}
