import { ipcMain, BrowserWindow } from 'electron'
import type { OllamaService } from '../services/ollama.service'

export function registerOllamaIPC(mainWindow: BrowserWindow, ollama: OllamaService): void {
  ipcMain.handle('ollama:health', async () => {
    const running = await ollama.isRunning()
    const version = running ? await ollama.getVersion() : undefined
    return { running, version }
  })

  ipcMain.handle('ollama:models', async () => {
    return ollama.listModels()
  })

  ipcMain.handle('ollama:pull', async (_event, { modelName }: { modelName: string }) => {
    await ollama.pullModel(modelName, (status, percent) => {
      mainWindow.webContents.send('ollama:pull-progress', { modelName, status, percent })
    })
  })
}
