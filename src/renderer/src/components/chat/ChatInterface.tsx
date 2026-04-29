import { useEffect } from 'react'
import { useTopicsStore } from '../../store/topics.store'
import { useChatStore } from '../../store/chat.store'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'

export function ChatInterface(): JSX.Element {
  const activeTopicId = useTopicsStore((s) => s.activeTopicId)
  const activeConversationId = useTopicsStore((s) => s.activeConversationId)
  const { loadHistory, clearMessages } = useChatStore()

  useEffect(() => {
    if (activeConversationId) {
      loadHistory(activeConversationId)
    } else {
      clearMessages()
    }
  }, [activeConversationId, activeTopicId, loadHistory, clearMessages])

  if (!activeTopicId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold text-gray-300">Aham RAG</h1>
        <p className="mt-2 text-sm text-gray-400">Select a topic from the sidebar to begin</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList />
      <ChatInput />
    </div>
  )
}
