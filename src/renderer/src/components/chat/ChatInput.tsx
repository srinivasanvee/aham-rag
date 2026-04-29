import { useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { useChatStore } from '../../store/chat.store'
import { useTopicsStore } from '../../store/topics.store'
import { useAppStore } from '../../store/app.store'

export function ChatInput(): JSX.Element {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const activeTopicId = useTopicsStore((s) => s.activeTopicId)
  const activeConversationId = useTopicsStore((s) => s.activeConversationId)
  const setActiveConversationId = useTopicsStore((s) => s.setActiveConversationId)
  const ollamaRunning = useAppStore((s) => s.ollamaRunning)

  const canSend = text.trim() && !isStreaming && !!activeTopicId && ollamaRunning

  const submit = async (): Promise<void> => {
    if (!canSend || !activeTopicId) return
    const message = text.trim()
    setText('')
    textareaRef.current?.focus()
    await sendMessage(activeTopicId, message, activeConversationId ?? undefined, setActiveConversationId)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t bg-white px-4 py-3">
      <div className="flex items-end gap-2 rounded-xl border bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            !activeTopicId
              ? 'Select a topic to start chatting'
              : !ollamaRunning
              ? 'Ollama is offline'
              : 'Ask a question… (Enter to send, Shift+Enter for newline)'
          }
          disabled={!activeTopicId || !ollamaRunning || isStreaming}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
          }}
        />
        <button
          onClick={submit}
          disabled={!canSend}
          className="shrink-0 rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
