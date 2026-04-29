import { useEffect } from 'react'
import { useAppStore } from '../store/app.store'

export function useOllama(): void {
  const setStatus = useAppStore((s) => s.setOllamaStatus)

  useEffect(() => {
    // Initial health check
    window.api.ollama.health().then(({ running, version }) => setStatus(running, version))

    // Subscribe to status push events from main
    const cleanup = window.api.ollama.onStatus(({ running }) => setStatus(running))
    return cleanup
  }, [setStatus])
}
