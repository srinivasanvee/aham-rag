import type { OllamaMessage } from '../../main/services/ollama.service'

// ── Deterministic vector embedding ──────────────────────────────────────────
// Distributes character values across 768 dims and L2-normalises the result.
// Same text → same vector every run. Similar texts → closer vectors.
export function deterministicVector(text: string, dim = 768): number[] {
  const vec = new Array<number>(dim).fill(0)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    vec[i % dim] += c * 0.0001
    vec[(i * 3 + 1) % dim] += c * 0.00007
    vec[(i * 7 + 5) % dim] += c * 0.00003
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / mag)
}

// ── Mock OllamaService ───────────────────────────────────────────────────────
export class MockOllamaService {
  private nextResponse = 'Mock LLM response.'
  public lastMessages: OllamaMessage[] = []
  public embedCallCount = 0
  public chatCallCount = 0

  setNextLLMResponse(text: string): void {
    this.nextResponse = text
  }

  async isRunning(): Promise<boolean> { return true }
  async getVersion(): Promise<string> { return 'mock-1.0' }
  async listModels(): Promise<{ name: string; size: number }[]> { return [] }

  async embed(inputs: string[]): Promise<number[][]> {
    this.embedCallCount++
    return inputs.map((t) => deterministicVector(t))
  }

  async embedBatched(texts: string[], _batchSize = 32): Promise<number[][]> {
    this.embedCallCount++
    return texts.map((t) => deterministicVector(t))
  }

  async chatStream(
    messages: OllamaMessage[],
    onToken: (token: string) => void
  ): Promise<string> {
    this.chatCallCount++
    this.lastMessages = messages
    // Emit the response as a single token so streaming logic is exercised
    onToken(this.nextResponse)
    return this.nextResponse
  }

  reset(): void {
    this.nextResponse = 'Mock LLM response.'
    this.lastMessages = []
    this.embedCallCount = 0
    this.chatCallCount = 0
  }
}
