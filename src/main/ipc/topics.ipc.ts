import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { DatabaseService } from '../services/database.service'

export function registerTopicsIPC(db: DatabaseService): void {
  ipcMain.handle('topics:list', () => {
    const rows = db.getTopics()
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      documentCount: r.document_count
    }))
  })

  ipcMain.handle('topics:create', (_event, { name, description }: { name: string; description?: string }) => {
    const id = uuidv4()
    const row = db.createTopic(id, name, description)
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      documentCount: 0
    }
  })

  ipcMain.handle(
    'topics:update',
    (_event, { id, name, description }: { id: string; name?: string; description?: string }) => {
      const row = db.updateTopic(id, name, description)
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        documentCount: row.document_count
      }
    }
  )

  ipcMain.handle('topics:delete', (_event, { id }: { id: string }) => {
    db.deleteTopic(id)
  })
}
