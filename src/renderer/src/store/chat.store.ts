import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Message, SourceChunk } from '../types'

interface ChatStore {
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  currentRequestId: string | null
  loadHistory: (conversationId: string) => Promise<void>
  sendMessage: (
    topicId: string,
    text: string,
    conversationId: string | undefined,
    onConversationCreated: (id: string) => void
  ) => Promise<void>
  appendToken: (requestId: string, token: string) => void
  finalizeStream: (requestId: string, messageId: string, sources: SourceChunk[], conversationId: string, onConversationCreated: (id: string) => void) => void
  errorStream: (requestId: string) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  currentRequestId: null,

  loadHistory: async (conversationId) => {
    const history = await window.api.chat.history(conversationId)
    set({ messages: history, isStreaming: false, streamingContent: '', currentRequestId: null })
  },

  sendMessage: async (topicId, text, conversationId, onConversationCreated) => {
    const requestId = uuidv4()
    const userMsg: Message = {
      id: uuidv4(),
      conversationId: conversationId ?? '',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    }
    set((state) => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingContent: '',
      currentRequestId: requestId
    }))
    await window.api.chat.send({ topicId, conversationId, message: text, requestId })
  },

  appendToken: (requestId, token) => {
    if (get().currentRequestId !== requestId) return
    set((state) => ({ streamingContent: state.streamingContent + token }))
  },

  finalizeStream: (requestId, messageId, sources, conversationId, onConversationCreated) => {
    const state = get()
    if (state.currentRequestId !== requestId) return
    const assistantMsg: Message = {
      id: messageId,
      conversationId,
      role: 'assistant',
      content: state.streamingContent,
      sources,
      createdAt: new Date().toISOString()
    }
    set((s) => ({
      messages: [...s.messages, assistantMsg],
      isStreaming: false,
      streamingContent: '',
      currentRequestId: null
    }))
    onConversationCreated(conversationId)
  },

  errorStream: (requestId) => {
    if (get().currentRequestId !== requestId) return
    set({ isStreaming: false, streamingContent: '', currentRequestId: null })
  },

  clearMessages: () => set({ messages: [], isStreaming: false, streamingContent: '', currentRequestId: null })
}))
