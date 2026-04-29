export interface Topic {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  documentCount: number
}

export interface Document {
  id: string
  topicId: string
  filename: string
  originalPath: string
  storedPath: string
  mimeType: string
  sizeBytes: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  errorMessage?: string
  chunkCount: number
  createdAt: string
}

export interface Conversation {
  id: string
  topicId: string
  title?: string
  createdAt: string
}

export interface SourceChunk {
  chunkId: string
  documentId: string
  filename: string
  text: string
  score: number
  pageNumber?: number
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceChunk[]
  createdAt: string
}

export interface OllamaModel {
  name: string
  size: number
}

export interface IngestProgress {
  documentId: string
  status: 'processing' | 'ready' | 'error'
  chunkCount?: number
  error?: string
}

export interface StreamToken {
  requestId: string
  token: string
}

export interface StreamDone {
  requestId: string
  sources: SourceChunk[]
  messageId: string
  conversationId: string
}

export interface StreamError {
  requestId: string
  error: string
}
