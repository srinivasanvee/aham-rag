import { create } from 'zustand'

interface AppStore {
  ollamaRunning: boolean
  ollamaVersion: string | undefined
  setOllamaStatus: (running: boolean, version?: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  ollamaRunning: false,
  ollamaVersion: undefined,
  setOllamaStatus: (running, version) => set({ ollamaRunning: running, ollamaVersion: version })
}))
