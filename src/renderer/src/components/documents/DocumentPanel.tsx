import { useCallback } from 'react'
import { useDocuments } from '../../hooks/useDocuments'
import { DocumentItem } from './DocumentItem'
import { FileDropZone } from './FileDropZone'
import { useTopicsStore } from '../../store/topics.store'

export function DocumentPanel(): JSX.Element {
  const activeTopicId = useTopicsStore((s) => s.activeTopicId)
  const { documents, reload } = useDocuments(activeTopicId)

  const handleFilesAdded = useCallback(
    async (paths: string[]) => {
      if (!activeTopicId) return
      await window.api.documents.ingest(activeTopicId, paths)
      reload()
    },
    [activeTopicId, reload]
  )

  const handleDelete = useCallback(
    async (documentId: string) => {
      await window.api.documents.delete(documentId)
      reload()
    },
    [reload]
  )

  if (!activeTopicId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-gray-400">Select a topic to manage files</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Files</h3>
      <FileDropZone topicId={activeTopicId} onFilesAdded={handleFilesAdded} />
      <div className="flex-1 overflow-y-auto space-y-2">
        {documents.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-4">No files uploaded yet</p>
        ) : (
          documents.map((doc) => (
            <DocumentItem key={doc.id} doc={doc} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  )
}
