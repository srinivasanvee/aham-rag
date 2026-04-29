// Use the lib path directly to avoid pdf-parse's test fixture require at module load
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse') as (
  buffer: Buffer
) => Promise<{ text: string; numpages: number }>

export async function parsePdf(filePath: string): Promise<{ text: string; pageCount: number }> {
  const { readFile } = await import('fs/promises')
  const buffer = await readFile(filePath)
  const data = await pdfParse(buffer)
  return { text: data.text, pageCount: data.numpages }
}
