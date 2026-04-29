import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Topic } from '../../types'
import { useTopicsStore } from '../../store/topics.store'

interface Props {
  topic: Topic
  isActive: boolean
  onClick: () => void
}

export function TopicItem({ topic, isActive, onClick }: Props): JSX.Element {
  const deleteTopic = useTopicsStore((s) => s.deleteTopic)
  const [hovering, setHovering] = useState(false)

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
        isActive ? 'bg-blue-100 text-blue-900' : 'text-gray-700 hover:bg-gray-100'
      )}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{topic.name}</p>
        <p className="text-xs text-gray-400">
          {topic.documentCount} {topic.documentCount === 1 ? 'file' : 'files'}
        </p>
      </div>
      {hovering && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteTopic(topic.id)
          }}
          className="ml-2 rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
