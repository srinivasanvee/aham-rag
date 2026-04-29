import { create } from 'zustand'
import type { Topic } from '../types'

interface TopicsStore {
  topics: Topic[]
  activeTopicId: string | null
  activeConversationId: string | null
  setActiveTopicId: (id: string | null) => void
  setActiveConversationId: (id: string | null) => void
  loadTopics: () => Promise<void>
  createTopic: (name: string, description?: string) => Promise<Topic>
  deleteTopic: (id: string) => Promise<void>
}

export const useTopicsStore = create<TopicsStore>((set) => ({
  topics: [],
  activeTopicId: null,
  activeConversationId: null,

  setActiveTopicId: (id) => set({ activeTopicId: id, activeConversationId: null }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  loadTopics: async () => {
    const topics = await window.api.topics.list()
    set({ topics })
  },

  createTopic: async (name, description) => {
    const topic = await window.api.topics.create({ name, description })
    set((state) => ({ topics: [topic, ...state.topics] }))
    return topic
  },

  deleteTopic: async (id) => {
    await window.api.topics.delete(id)
    set((state) => ({
      topics: state.topics.filter((t) => t.id !== id),
      activeTopicId: state.activeTopicId === id ? null : state.activeTopicId
    }))
  }
}))
