import { app } from 'electron'
import path from 'path'

export function getUserDataPath(...segments: string[]): string {
  return path.join(app.getPath('userData'), ...segments)
}

export const DB_PATH = () => getUserDataPath('aham.db')
export const LANCEDB_PATH = () => getUserDataPath('lancedb')
export const DOCUMENTS_PATH = () => getUserDataPath('documents')
