import log from 'electron-log'

// Write full debug detail to file; keep console at info level
log.transports.file.level = 'debug'
log.transports.console.level = 'debug'
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}'
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {scope} {text}'

// Increase file size limit for verbose RAG logs (20 MB, 3 rotations)
log.transports.file.maxSize = 20 * 1024 * 1024
log.transports.file.archiveLog = (oldPath) => oldPath + '.old'

export const ragLog = log.scope('RAG    ')
export const ingestLog = log.scope('INGEST ')
export const appLog = log.scope('APP    ')

export function separator(label?: string): string {
  const line = '─'.repeat(60)
  return label ? `┌─ ${label} ${line.slice(label.length + 3)}` : line
}
