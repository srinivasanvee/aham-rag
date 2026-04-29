import { useState } from 'react'
import { useTopicsStore } from '../../store/topics.store'

interface Props {
  onClose: () => void
}

export function CreateTopicDialog({ onClose }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const createTopic = useTopicsStore((s) => s.createTopic)
  const setActiveTopicId = useTopicsStore((s) => s.setActiveTopicId)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const topic = await createTopic(name.trim(), description.trim() || undefined)
    setActiveTopicId(topic.id)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">New Topic</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Topic name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
