import type { BrowserWindow } from 'electron'
import type { DatabaseService } from '../services/database.service'
import type { VectorStoreService } from '../services/vector-store.service'
import type { OllamaService } from '../services/ollama.service'
import { registerTopicsIPC } from './topics.ipc'
import { registerDocumentsIPC } from './documents.ipc'
import { registerChatIPC } from './chat.ipc'
import { registerOllamaIPC } from './ollama.ipc'

export function registerAllIPC(
  mainWindow: BrowserWindow,
  db: DatabaseService,
  vector: VectorStoreService,
  ollama: OllamaService
): void {
  registerTopicsIPC(db)
  registerDocumentsIPC(mainWindow, db, vector, ollama)
  registerChatIPC(mainWindow, db, vector, ollama)
  registerOllamaIPC(mainWindow, ollama)
}
