import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { DatabaseService } from './services/database.service'
import { VectorStoreService } from './services/vector-store.service'
import { OllamaService } from './services/ollama.service'
import { registerAllIPC } from './ipc/index'
import { DB_PATH, LANCEDB_PATH, DOCUMENTS_PATH } from './utils/paths'
import { appLog } from './utils/logger'

let mainWindow: BrowserWindow | null = null
let ollamaHealthInterval: ReturnType<typeof setInterval> | null = null

const dbService = new DatabaseService()
const vectorService = new VectorStoreService()
const ollamaService = new OllamaService()

async function createWindow(): Promise<void> {
  appLog.info(`🚀 AHAM RAG starting — userData: ${app.getPath('userData')}`)
  await fs.mkdir(DOCUMENTS_PATH(), { recursive: true })
  await dbService.initialize(DB_PATH())
  appLog.info(`✅ SQLite initialized: ${DB_PATH()}`)
  await vectorService.initialize(LANCEDB_PATH())
  appLog.info(`✅ LanceDB initialized: ${LANCEDB_PATH()}`)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  registerAllIPC(mainWindow, dbService, vectorService, ollamaService)

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Initial Ollama health check with logging
  const ollamaRunning = await ollamaService.isRunning()
  const ollamaVersion = ollamaRunning ? await ollamaService.getVersion() : undefined
  appLog.info(`🦙 Ollama status: ${ollamaRunning ? `running (v${ollamaVersion ?? 'unknown'})` : 'not running'}`)

  ollamaHealthInterval = setInterval(async () => {
    if (!mainWindow) return
    const running = await ollamaService.isRunning()
    mainWindow.webContents.send('ollama:status', { running })
  }, 5000)

  mainWindow.on('closed', () => {
    mainWindow = null
    if (ollamaHealthInterval) clearInterval(ollamaHealthInterval)
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
