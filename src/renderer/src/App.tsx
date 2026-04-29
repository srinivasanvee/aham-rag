import { useState } from 'react'
import { PanelRight } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { ChatInterface } from './components/chat/ChatInterface'
import { DocumentPanel } from './components/documents/DocumentPanel'
import { ModelSetupWizard } from './components/shared/ModelSetupWizard'
import { useOllama } from './hooks/useOllama'
import { useTopics } from './hooks/useTopics'
import { useChat } from './hooks/useChat'

export default function App(): JSX.Element {
  useOllama()
  useTopics()
  useChat()

  const [showDocPanel, setShowDocPanel] = useState(true)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100">
      <ModelSetupWizard />

      {/* Top bar spanning full width */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b bg-white/80 pl-[76px] pr-4 backdrop-blur-sm">
        {/* pl-[76px] leaves room for macOS traffic light buttons */}
        <TopBar />
        <button
          onClick={() => setShowDocPanel((v) => !v)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
          title="Toggle document panel"
        >
          <PanelRight size={16} />
        </button>
      </header>

      {/* Body row */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ChatInterface />
        {showDocPanel && (
          <aside className="w-72 shrink-0 border-l bg-white">
            <DocumentPanel />
          </aside>
        )}
      </div>
    </div>
  )
}
