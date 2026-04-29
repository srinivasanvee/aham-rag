import { contextBridge, ipcRenderer } from 'electron'

type Cleanup = () => void

contextBridge.exposeInMainWorld('api', {
  topics: {
    list: () => ipcRenderer.invoke('topics:list'),
    create: (data: { name: string; description?: string }) =>
      ipcRenderer.invoke('topics:create', data),
    update: (data: { id: string; name?: string; description?: string }) =>
      ipcRenderer.invoke('topics:update', data),
    delete: (id: string) => ipcRenderer.invoke('topics:delete', { id })
  },

  documents: {
    list: (topicId: string) => ipcRenderer.invoke('documents:list', { topicId }),
    ingest: (topicId: string, filePaths: string[]) =>
      ipcRenderer.invoke('documents:ingest', { topicId, filePaths }),
    delete: (documentId: string) => ipcRenderer.invoke('documents:delete', { documentId }),
    onProgress: (callback: (payload: unknown) => void): Cleanup => {
      const handler = (_: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
      ipcRenderer.on('documents:progress', handler)
      return () => ipcRenderer.removeListener('documents:progress', handler)
    }
  },

  chat: {
    send: (payload: {
      topicId: string
      conversationId?: string
      message: string
      requestId: string
    }) => ipcRenderer.invoke('chat:send', payload),
    history: (conversationId: string) =>
      ipcRenderer.invoke('chat:history', { conversationId }),
    conversations: (topicId: string) =>
      ipcRenderer.invoke('chat:conversations', { topicId }),
    onToken: (callback: (payload: unknown) => void): Cleanup => {
      const handler = (_: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
      ipcRenderer.on('chat:stream-token', handler)
      return () => ipcRenderer.removeListener('chat:stream-token', handler)
    },
    onDone: (callback: (payload: unknown) => void): Cleanup => {
      const handler = (_: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
      ipcRenderer.on('chat:stream-done', handler)
      return () => ipcRenderer.removeListener('chat:stream-done', handler)
    },
    onError: (callback: (payload: unknown) => void): Cleanup => {
      const handler = (_: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
      ipcRenderer.on('chat:stream-error', handler)
      return () => ipcRenderer.removeListener('chat:stream-error', handler)
    }
  },

  ollama: {
    health: () => ipcRenderer.invoke('ollama:health'),
    models: () => ipcRenderer.invoke('ollama:models'),
    pull: (modelName: string) => ipcRenderer.invoke('ollama:pull', { modelName }),
    onStatus: (callback: (payload: unknown) => void): Cleanup => {
      const handler = (_: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
      ipcRenderer.on('ollama:status', handler)
      return () => ipcRenderer.removeListener('ollama:status', handler)
    },
    onPullProgress: (callback: (payload: unknown) => void): Cleanup => {
      const handler = (_: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
      ipcRenderer.on('ollama:pull-progress', handler)
      return () => ipcRenderer.removeListener('ollama:pull-progress', handler)
    }
  },

  dialog: {
    openFiles: () => ipcRenderer.invoke('dialog:open-files')
  }
})
