import { useTopicsStore } from '../../store/topics.store'
import { OllamaStatusBadge } from '../shared/OllamaStatusBadge'

export function TopBar(): JSX.Element {
  const activeTopicId = useTopicsStore((s) => s.activeTopicId)
  const topics = useTopicsStore((s) => s.topics)
  const activeTopic = topics.find((t) => t.id === activeTopicId)

  return (
    <>
      <h1 className="text-sm font-semibold text-gray-700">
        {activeTopic ? activeTopic.name : 'Aham RAG'}
      </h1>
      <OllamaStatusBadge />
    </>
  )
}
