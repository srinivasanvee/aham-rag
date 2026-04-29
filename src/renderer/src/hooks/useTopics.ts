import { useEffect } from 'react'
import { useTopicsStore } from '../store/topics.store'

export function useTopics(): void {
  const loadTopics = useTopicsStore((s) => s.loadTopics)
  useEffect(() => { loadTopics() }, [loadTopics])
}
