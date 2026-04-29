import { readFile } from 'fs/promises'

export async function parseText(filePath: string): Promise<{ text: string }> {
  const text = await readFile(filePath, 'utf-8')
  return { text }
}
