import { useState, useEffect, useCallback } from 'react'
import type { Document, IngestProgress } from '../types'

export function useDocuments(topicId: string | null): {
  documents: Document[]
  reload: () => void
} {
  const [documents, setDocuments] = useState<Document[]>([])

  const reload = useCallback(() => {
    if (!topicId) { setDocuments([]); return }
    window.api.documents.list(topicId).then(setDocuments)
  }, [topicId])

  useEffect(() => { reload() }, [reload])

  // Listen to ingestion progress and update document status inline
  useEffect(() => {
    const cleanup = window.api.documents.onProgress((payload: IngestProgress) => {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === payload.documentId
            ? {
                ...d,
                status: payload.status,
                chunkCount: payload.chunkCount ?? d.chunkCount,
                errorMessage: payload.error
              }
            : d
        )
      )
    })
    return cleanup
  }, [])

  return { documents, reload }
}
