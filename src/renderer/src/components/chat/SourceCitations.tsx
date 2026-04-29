import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { SourceChunk } from '../../types'

interface Props {
  sources: SourceChunk[]
}

export function SourceCitations({ sources }: Props): JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (sources.length === 0) return null

  return (
    <div className="mt-2 text-xs">
      <button
        className="flex items-center gap-1 text-gray-400 hover:text-gray-600"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {sources.length} source{sources.length > 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((s) => (
            <div key={s.chunkId} className="rounded-lg border bg-gray-50 p-3">
              <p className="font-medium text-gray-600">
                {s.filename}
                {s.pageNumber !== undefined && ` · p.${s.pageNumber}`}
                <span className="ml-2 font-normal text-gray-400">
                  ({(s.score * 100).toFixed(0)}% match)
                </span>
              </p>
              <p className="mt-1 line-clamp-4 text-gray-500">{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
