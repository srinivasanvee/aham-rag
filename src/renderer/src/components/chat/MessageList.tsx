import { useEffect, useRef } from 'react'
import { useChatStore } from '../../store/chat.store'
import { MessageBubble } from './MessageBubble'
import { StreamingIndicator } from './StreamingIndicator'
import ReactMarkdown from 'react-markdown'

export function MessageList(): JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingContent = useChatStore((s) => s.streamingContent)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Upload files and ask a question to get started</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        streamingContent ? (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-gray-100">
              <div className="prose prose-sm max-w-none text-gray-800">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-white shadow-sm ring-1 ring-gray-100">
              <StreamingIndicator />
            </div>
          </div>
        )
      )}
      <div ref={bottomRef} />
    </div>
  )
}
