import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTopicsStore } from '../../store/topics.store'
import { TopicItem } from './TopicItem'
import { CreateTopicDialog } from './CreateTopicDialog'

export function TopicList(): JSX.Element {
  const topics = useTopicsStore((s) => s.topics)
  const activeTopicId = useTopicsStore((s) => s.activeTopicId)
  const setActiveTopicId = useTopicsStore((s) => s.setActiveTopicId)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Topics</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="New topic"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {topics.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">No topics yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 text-sm text-blue-500 hover:underline"
            >
              Create your first topic
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {topics.map((t) => (
              <TopicItem
                key={t.id}
                topic={t}
                isActive={t.id === activeTopicId}
                onClick={() => setActiveTopicId(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTopicDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
