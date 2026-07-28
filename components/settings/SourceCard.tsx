'use client'

import { useState } from 'react'

interface SourceCardProps {
  source: {
    id: string
    name: string
    url: string
    source_type?: string
    type?: string
    country?: string | null
    is_active?: boolean
    active?: boolean
    last_fetched_at?: string | null
  }
  onToggleActive: (id: string, currentStatus: boolean) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function SourceCard({ source, onToggleActive, onDelete }: SourceCardProps) {
  const [loading, setLoading] = useState(false)
  const isActive = source.is_active ?? source.active ?? true
  const type = source.source_type ?? source.type ?? 'rss'

  async function handleToggle() {
    setLoading(true)
    try {
      await onToggleActive(source.id, isActive)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    if (!window.confirm(`Excluir fonte "${source.name}" e seus itens?`)) return

    setLoading(true)
    try {
      await onDelete(source.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="m3-card flex min-w-0 flex-col justify-between gap-4 overflow-hidden p-5">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
              {type}
            </span>
            {source.country ? (
              <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {source.country}
              </span>
            ) : null}
          </div>

          <button
            onClick={handleToggle}
            disabled={loading}
            className={`relative h-6 w-12 shrink-0 cursor-pointer rounded-full border-none outline-none transition-colors duration-300 ease-m3-standard ${isActive ? 'bg-primary' : 'bg-surface-variant'} ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
            aria-label="Toggle Source"
            type="button"
          >
            <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform duration-300 ease-m3-emphasized ${isActive ? 'translate-x-7 shadow-sm' : 'translate-x-1'}`} />
          </button>
        </div>

        <h4 className="m-0 mb-1 line-clamp-2 break-words text-base font-semibold text-on-surface [overflow-wrap:anywhere]">{source.name}</h4>
        <p className="m-0 truncate rounded-md bg-surface-container-high px-2 py-1 font-mono text-[11px] text-on-surface-variant">{source.url}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-surface-variant/50 pt-3 text-[11px] font-medium text-on-surface-variant">
        <span>
          Sincronização: {source.last_fetched_at ? new Date(source.last_fetched_at).toLocaleDateString('pt-BR') : 'Manual'}
        </span>
        {onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-full px-3 py-1 font-semibold text-error hover:bg-error-container/40 disabled:opacity-50"
          >
            Excluir
          </button>
        ) : null}
      </div>
    </div>
  )
}
