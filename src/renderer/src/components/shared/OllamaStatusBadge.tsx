import { useAppStore } from '../../store/app.store'

export function OllamaStatusBadge(): JSX.Element {
  const running = useAppStore((s) => s.ollamaRunning)
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${running ? 'bg-green-500' : 'bg-red-500'}`}
      />
      <span className="text-gray-500">{running ? 'Ollama connected' : 'Ollama offline'}</span>
    </div>
  )
}
