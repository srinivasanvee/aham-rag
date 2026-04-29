export const GENERATION_MODEL = 'gemma3:1b'
export const EMBEDDING_MODEL = 'nomic-embed-text'
export const REQUIRED_MODELS = [GENERATION_MODEL, EMBEDDING_MODEL]

const OLLAMA_BASE = 'http://127.0.0.1:11434'

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class OllamaService {
  async isRunning(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      const res = await fetch(`${OLLAMA_BASE}/api/version`, { signal: controller.signal })
      clearTimeout(timeout)
      return res.ok
    } catch {
      return false
    }
  }

  async getVersion(): Promise<string | undefined> {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/version`)
      if (!res.ok) return undefined
      const data = (await res.json()) as { version: string }
      return data.version
    } catch {
      return undefined
    }
  }

  async listModels(): Promise<{ name: string; size: number }[]> {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`)
      if (!res.ok) return []
      const data = (await res.json()) as { models: { name: string; size: number }[] }
      return data.models ?? []
    } catch {
      return []
    }
  }

  async embed(inputs: string[]): Promise<number[][]> {
    const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs })
    })
    if (!res.ok) throw new Error(`Embed failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as { embeddings: number[][] }
    return data.embeddings
  }

  async embedBatched(texts: string[], batchSize = 32): Promise<number[][]> {
    const results: number[][] = []
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const embeddings = await this.embed(batch)
      results.push(...embeddings)
    }
    return results
  }

  async chatStream(
    messages: OllamaMessage[],
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GENERATION_MODEL, messages, stream: true }),
      signal
    })
    if (!res.ok) throw new Error(`Chat failed: ${res.status} ${await res.text()}`)

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const data = JSON.parse(trimmed) as {
            message?: { content: string }
            done: boolean
          }
          if (data.message?.content) {
            onToken(data.message.content)
            fullText += data.message.content
          }
          if (data.done) break
        } catch {
          // skip malformed JSON lines
        }
      }
    }
    return fullText
  }

  async pullModel(
    modelName: string,
    onProgress: (status: string, percent?: number) => void
  ): Promise<void> {
    const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    })
    if (!res.ok) throw new Error(`Pull failed: ${res.status} ${await res.text()}`)

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const data = JSON.parse(trimmed) as {
            status: string
            completed?: number
            total?: number
          }
          const percent =
            data.completed && data.total
              ? Math.round((data.completed / data.total) * 100)
              : undefined
          onProgress(data.status, percent)
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}
