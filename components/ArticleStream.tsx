'use client'

import { useState } from 'react'

interface ArticleStreamProps {
  content: string
  isStreaming: boolean
  model: string
  articleId?: string
  onRated?: (rating: number, comment: string) => void
}

function InlineRating({
  articleId,
  onRated,
}: {
  articleId: string
  onRated?: (rating: number, comment: string) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const display = hovered ?? selected

  async function handleSave() {
    if (selected === 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: selected, comment }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setSaved(true)
      onRated?.(selected, comment)
    } catch (err) {
      console.error('[inline-rating] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <p className="text-sm text-green-600 font-medium">
        {'★'.repeat(selected)} Avaliação salva
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Avalie o rascunho</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setSelected(i)}
            className="text-2xl transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${i} estrela`}
          >
            <span className={i <= display ? 'text-yellow-400' : 'text-gray-300'}>★</span>
          </button>
        ))}
      </div>

      {selected > 0 && (
        <div className="space-y-2 animate-fade-in-up">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Notas sobre o rascunho (opcional)..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none text-gray-900"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-blue text-white text-sm px-4 py-1.5 rounded-lg hover:bg-brand-blue2 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar avaliação'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ArticleStream({
  content,
  isStreaming,
  model,
  articleId,
  onRated,
}: ArticleStreamProps) {
  const [copied, setCopied] = useState(false)

  if (!content && !isStreaming) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // área de transferência indisponível
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Texto do artigo */}
      <div className="bg-white border border-surface-border rounded-2xl p-6 shadow-card min-h-32">
        <div
          className="text-gray-800 leading-relaxed text-base"
          style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
        >
          {content}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-gray-700 ml-0.5 animate-blink align-middle" />
          )}
        </div>
      </div>

      {/* Painel abaixo do texto */}
      <div className="flex items-center justify-between">
        {model && (
          <span className="text-xs text-surface-muted">Modelo: {model}</span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {!isStreaming && content && (
            <button
              onClick={handleCopy}
              className="text-sm text-gray-500 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-lg transition-colors hover:border-gray-400"
            >
              {copied ? 'Copiado ✓' : 'Copiar'}
            </button>
          )}
          {!isStreaming && articleId && (
            <a
              href={`/history/${articleId}`}
              className="text-sm text-brand-blue hover:text-brand-blue2 border border-brand-blue/30 hover:border-brand-blue px-3 py-1.5 rounded-lg transition-colors"
            >
              Abrir no histórico →
            </a>
          )}
        </div>
      </div>

      {/* Avaliação inline — mostrada apenas quando o stream termina */}
      {!isStreaming && articleId && (
        <div className="bg-surface rounded-2xl border border-surface-border p-4">
          <InlineRating articleId={articleId} onRated={onRated} />
        </div>
      )}
    </div>
  )
}
