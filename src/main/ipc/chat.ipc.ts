import { ipcMain, BrowserWindow } from 'electron'
import type { DatabaseService } from '../services/database.service'
import type { VectorStoreService } from '../services/vector-store.service'
import type { OllamaService } from '../services/ollama.service'
import { RagService } from '../services/rag.service'

export function registerChatIPC(
  mainWindow: BrowserWindow,
  db: DatabaseService,
  vector: VectorStoreService,
  ollama: OllamaService
): void {
  const rag = new RagService(db, vector, ollama)

  ipcMain.handle(
    'chat:send',
    async (
      _event,
      payload: {
        topicId: string
        conversationId?: string
        message: string
        requestId: string
      }
    ) => {
      const { topicId, conversationId, message, requestId } = payload
      try {
        const result = await rag.query({
          topicId,
          conversationId,
          message,
          requestId,
          onToken: (token) => {
            mainWindow.webContents.send('chat:stream-token', { requestId, token })
          }
        })
        mainWindow.webContents.send('chat:stream-done', {
          requestId,
          sources: result.sources,
          messageId: result.messageId,
          conversationId: result.conversationId
        })
        return { conversationId: result.conversationId, messageId: result.messageId }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        mainWindow.webContents.send('chat:stream-error', { requestId, error })
        throw err
      }
    }
  )

  ipcMain.handle('chat:history', (_event, { conversationId }: { conversationId: string }) => {
    const rows = db.getMessages(conversationId)
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      sources: r.sources_json ? JSON.parse(r.sources_json) : undefined,
      createdAt: r.created_at
    }))
  })

  ipcMain.handle('chat:conversations', (_event, { topicId }: { topicId: string }) => {
    const rows = db.getConversations(topicId)
    return rows.map((r) => ({
      id: r.id,
      topicId: r.topic_id,
      title: r.title ?? undefined,
      createdAt: r.created_at
    }))
  })
}
