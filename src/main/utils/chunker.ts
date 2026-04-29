export interface Chunk {
  text: string
  startChar: number
  endChar: number
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ', '']
const MAX_CHUNKS_PER_DOC = 2000

export function splitText(
  text: string,
  chunkSize = 800,
  chunkOverlap = 150
): Chunk[] {
  const rawChunks = recursiveSplit(text, chunkSize, DEFAULT_SEPARATORS)
  const merged = mergeSmallChunks(rawChunks, chunkSize)
  const withOverlap = applyOverlap(merged, text, chunkOverlap)
  return withOverlap.slice(0, MAX_CHUNKS_PER_DOC)
}

function recursiveSplit(
  text: string,
  chunkSize: number,
  separators: string[]
): string[] {
  if (text.length <= chunkSize) return [text]
  const [sep, ...rest] = separators
  if (sep === undefined) return splitByLength(text, chunkSize)

  const parts = sep === '' ? [...text].map((c) => c) : text.split(sep)
  const results: string[] = []

  for (const part of parts) {
    const cleaned = sep === '' ? part : part
    if (!cleaned) continue
    if (cleaned.length <= chunkSize) {
      results.push(cleaned)
    } else {
      results.push(...recursiveSplit(cleaned, chunkSize, rest))
    }
  }
  return results
}

function splitByLength(text: string, chunkSize: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks
}

function mergeSmallChunks(parts: string[], chunkSize: number): string[] {
  const merged: string[] = []
  let current = ''

  for (const part of parts) {
    if (!part.trim()) continue
    const candidate = current ? current + ' ' + part : part
    if (candidate.length <= chunkSize) {
      current = candidate
    } else {
      if (current) merged.push(current)
      current = part
    }
  }
  if (current) merged.push(current)
  return merged
}

function applyOverlap(chunks: string[], originalText: string, chunkOverlap: number): Chunk[] {
  const result: Chunk[] = []
  let searchFrom = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i]
    const overlapPrefix = i > 0 ? chunks[i - 1].slice(-chunkOverlap) : ''
    const fullText = overlapPrefix ? overlapPrefix + ' ' + chunkText : chunkText

    const startChar = originalText.indexOf(chunkText, searchFrom)
    const safeStart = startChar === -1 ? searchFrom : startChar
    const endChar = safeStart + chunkText.length

    result.push({ text: fullText.trim(), startChar: safeStart, endChar })
    if (startChar !== -1) searchFrom = endChar
  }
  return result
}
