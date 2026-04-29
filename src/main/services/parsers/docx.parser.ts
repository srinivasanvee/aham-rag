import mammoth from 'mammoth'

export async function parseDocx(filePath: string): Promise<{ text: string }> {
  const result = await mammoth.extractRawText({ path: filePath })
  return { text: result.value }
}
