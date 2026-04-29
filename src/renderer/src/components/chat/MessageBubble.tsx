import ReactMarkdown from 'react-markdown'
import type { Message } from '../../types'
import { SourceCitations } from './SourceCitations'
import { cn } from '../../lib/utils'

interface Props {
  message: Message
}

export function MessageBubble({ message }: Props): JSX.Element {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
          isUser
            ? 'rounded-tr-sm bg-blue-600 text-white'
            : 'rounded-tl-sm bg-white shadow-sm ring-1 ring-gray-100'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <div className="prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            {message.sources && message.sources.length > 0 && (
              <SourceCitations sources={message.sources} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
