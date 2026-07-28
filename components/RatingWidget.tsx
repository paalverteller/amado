'use client'

import { useState } from 'react'

interface Props {
  articleId:      string
  currentRating:  number | null
  currentComment: string | null
  onSaved:        (rating: number, comment: string) => void
}

export default function RatingWidget({ articleId, currentRating, currentComment, onSaved }: Props) {
  const [hovered,     setHovered]     = useState<number | null>(null)
  const [selected,    setSelected]    = useState(currentRating ?? 0)
  const [comment,     setComment]     = useState(currentComment ?? '')
  const [showComment, setShowComment] = useState(currentRating !== null)
  const [saving,      setSaving]      = useState(false)
  const [savedMsg,    setSavedMsg]    = useState('')

  const display = hovered ?? selected

  async function handleSave() {
    if (selected === 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rating: selected, comment }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setSavedMsg('Salvo ✓')
      onSaved(selected, comment)
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (err) {
      setSavedMsg((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-on-surface-variant m-0">
        Avaliação do rascunho
      </p>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { setSelected(i); setShowComment(true) }}
            aria-label={`${i} estrela`}
            className={`text-2xl p-1 bg-transparent border-none cursor-pointer transition-transform duration-200 ease-m3-emphasized active:scale-75 focus:outline-none ${i <= display ? 'text-[#e5b513]' : 'text-surface-variant'}`}
          >
            ★
          </button>
        ))}
      </div>

      {showComment && (
        <div className="flex flex-col gap-3 animate-[fadeIn_300ms_var(--ease-m3-emphasized)_forwards]">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Notas sobre o rascunho..."
            rows={2}
            className="m3-input-outlined w-full resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || selected === 0}
              className={`m3-button-filled ${saving || selected === 0 ? 'opacity-50 cursor-not-allowed bg-surface-variant text-on-surface-variant hover:shadow-none hover:bg-surface-variant' : ''}`}
            >
              {saving ? 'Salvando...' : 'Salvar avaliação'}
            </button>
            {savedMsg && (
              <span className="text-sm font-medium text-on-surface-variant">{savedMsg}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
