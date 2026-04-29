import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/app.store'
import { GENERATION_MODEL, EMBEDDING_MODEL } from '../../types/constants'

interface ModelStatus {
  name: string
  pulled: boolean
  pulling: boolean
  progress: number
  error?: string
}

// Wizard is shown when Ollama is not running or required models are missing
export function ModelSetupWizard(): JSX.Element | null {
  const ollamaRunning = useAppStore((s) => s.ollamaRunning)
  const [models, setModels] = useState<ModelStatus[]>([
    { name: GENERATION_MODEL, pulled: false, pulling: false, progress: 0 },
    { name: EMBEDDING_MODEL, pulled: false, pulling: false, progress: 0 }
  ])
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!ollamaRunning) { setChecked(false); return }
    window.api.ollama.models().then((available) => {
      const names = available.map((m) => m.name)
      setModels((prev) =>
        prev.map((m) => ({
          ...m,
          pulled: names.some((n) => n.startsWith(m.name.split(':')[0]))
        }))
      )
      setChecked(true)
    })
  }, [ollamaRunning])

  useEffect(() => {
    const cleanup = window.api.ollama.onPullProgress((payload) => {
      setModels((prev) =>
        prev.map((m) =>
          m.name === payload.modelName
            ? {
                ...m,
                pulling: payload.status !== 'success',
                pulled: payload.status === 'success',
                progress: payload.percent ?? m.progress
              }
            : m
        )
      )
    })
    return cleanup
  }, [])

  const allReady = ollamaRunning && checked && models.every((m) => m.pulled)
  if (allReady) return null

  const pullModel = async (name: string): Promise<void> => {
    setModels((prev) => prev.map((m) => (m.name === name ? { ...m, pulling: true } : m)))
    try {
      await window.api.ollama.pull(name)
    } catch {
      setModels((prev) =>
        prev.map((m) => (m.name === name ? { ...m, pulling: false, error: 'Pull failed' } : m))
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Setup Required</h2>
        <p className="mb-6 text-sm text-gray-500">
          Aham RAG needs Ollama running with the following models.
        </p>

        {!ollamaRunning && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Ollama is not running.{' '}
            <a
              href="https://ollama.com"
              onClick={(e) => { e.preventDefault(); window.open('https://ollama.com') }}
              className="underline"
            >
              Install Ollama
            </a>
            {' '}then start it with <code className="font-mono">ollama serve</code>.
            <button
              className="mt-3 block w-full rounded-lg bg-red-100 py-1.5 text-center text-red-700 hover:bg-red-200"
              onClick={() => window.api.ollama.health().then(({ running, version }) => useAppStore.getState().setOllamaStatus(running, version))}
            >
              Check Again
            </button>
          </div>
        )}

        {ollamaRunning && (
          <div className="space-y-4">
            {models.map((m) => (
              <div key={m.name} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{m.name}</span>
                  {m.pulled ? (
                    <span className="text-xs text-green-600">✓ Ready</span>
                  ) : m.pulling ? (
                    <span className="text-xs text-blue-500">Pulling…</span>
                  ) : (
                    <button
                      className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                      onClick={() => pullModel(m.name)}
                    >
                      Pull
                    </button>
                  )}
                </div>
                {m.pulling && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${m.progress}%` }}
                    />
                  </div>
                )}
                {m.error && <p className="mt-1 text-xs text-red-500">{m.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
