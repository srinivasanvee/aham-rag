import { Trash2, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Document } from '../../types'

interface Props {
  doc: Document
  onDelete: (id: string) => void
}

const STATUS_ICON = {
  pending: <Loader2 size={14} className="animate-spin text-gray-400" />,
  processing: <Loader2 size={14} className="animate-spin text-blue-500" />,
  ready: <CheckCircle2 size={14} className="text-green-500" />,
  error: <AlertCircle size={14} className="text-red-500" />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentItem({ doc, onDelete }: Props): JSX.Element {
  return (
    <div className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-gray-50">
      <FileText size={16} className="shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{doc.filename}</p>
        <p className="text-xs text-gray-400">
          {formatBytes(doc.sizeBytes)}
          {doc.status === 'ready' && ` · ${doc.chunkCount} chunks`}
          {doc.errorMessage && (
            <span className="ml-1 text-red-500" title={doc.errorMessage}> · Error</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {STATUS_ICON[doc.status]}
        <button
          onClick={() => onDelete(doc.id)}
          className="hidden rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
