import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  topicId: string
  onFilesAdded: (paths: string[]) => void
}

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md']
}

export function FileDropZone({ topicId, onFilesAdded }: Props): JSX.Element {
  const onDrop = useCallback(
    (accepted: File[]) => {
      // In Electron, File objects from drag-drop have a `path` property
      const paths = accepted.map((f) => (f as File & { path: string }).path).filter(Boolean)
      if (paths.length > 0) onFilesAdded(paths)
    },
    [onFilesAdded]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    noClick: false
  })

  const openNativePicker = async (): Promise<void> => {
    const paths = await window.api.dialog.openFiles()
    if (paths.length > 0) onFilesAdded(paths)
  }

  return (
    <div
      {...getRootProps()}
      onClick={openNativePicker}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors',
        isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
      )}
    >
      <input {...getInputProps()} />
      <UploadCloud size={24} className={isDragActive ? 'text-blue-500' : 'text-gray-300'} />
      <p className="mt-2 text-sm text-gray-500">
        {isDragActive ? 'Drop files here' : 'Drop files or click to upload'}
      </p>
      <p className="mt-1 text-xs text-gray-400">PDF, DOCX, TXT, MD</p>
    </div>
  )
}
