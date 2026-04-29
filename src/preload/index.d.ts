import type {
  Topic,
  Document,
  Message,
  Conversation,
  OllamaModel,
  IngestProgress,
  StreamToken,
  StreamDone,
  StreamError,
  SourceChunk
} from '../renderer/src/types'

type Cleanup = () => void

interface WindowApi {
  topics: {
    list: () => Promise<Topic[]>
    create: (data: { name: string; description?: string }) => Promise<Topic>
    update: (data: { id: string; name?: string; description?: string }) => Promise<Topic>
    delete: (id: string) => Promise<void>
  }
  documents: {
    list: (topicId: string) => Promise<Document[]>
    ingest: (topicId: string, filePaths: string[]) => Promise<{ documentId: string; filename: string }[]>
    delete: (documentId: string) => Promise<void>
    onProgress: (callback: (payload: IngestProgress) => void) => Cleanup
  }
  chat: {
    send: (payload: {
      topicId: string
      conversationId?: string
      message: string
      requestId: string
    }) => Promise<{ conversationId: string; messageId: string }>
    history: (conversationId: string) => Promise<Message[]>
    conversations: (topicId: string) => Promise<Conversation[]>
    onToken: (callback: (payload: StreamToken) => void) => Cleanup
    onDone: (callback: (payload: StreamDone) => void) => Cleanup
    onError: (callback: (payload: StreamError) => void) => Cleanup
  }
  ollama: {
    health: () => Promise<{ running: boolean; version?: string }>
    models: () => Promise<OllamaModel[]>
    pull: (modelName: string) => Promise<void>
    onStatus: (callback: (payload: { running: boolean }) => void) => Cleanup
    onPullProgress: (
      callback: (payload: { modelName: string; status: string; percent?: number }) => void
    ) => Cleanup
  }
  dialog: {
    openFiles: () => Promise<string[]>
  }
}

declare global {
  interface Window {
    api: WindowApi
  }
}
