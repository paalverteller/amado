'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/api-client'

interface Term {
  id: string
  term: string
  policy: 'preferred' | 'allowed' | 'discouraged' | 'forbidden'
  replacement: string
  notes: string
}

const POLICY_BORDER_COLOR: Record<Term['policy'], string> = {
  forbidden: 'var(--aug-danger-fg)',
  preferred: 'var(--aug-success-fg)',
  discouraged: 'var(--aug-warning-fg)',
  allowed: 'var(--aug-neutral-fg)',
}

const POLICY_BADGE_STYLE: Record<Term['policy'], { background: string; color: string }> = {
  forbidden: { background: 'var(--aug-danger-bg)', color: 'var(--aug-danger-fg)' },
  preferred: { background: 'var(--aug-success-bg)', color: 'var(--aug-success-fg)' },
  discouraged: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
  allowed: { background: 'var(--aug-neutral-bg)', color: 'var(--aug-neutral-fg)' },
}

export default function VoiceVocabularyTab({ brandId }: { brandId: string }) {
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'forbidden' | 'preferred' | 'discouraged'>('all')

  const fetchTerms = useCallback(async () => {
    const data = await fetchJson<{ terms?: Term[] }>(`/api/brands/${brandId}/terms`)
    if (data) setTerms(data.terms ?? [])
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTerms()
  }, [brandId, fetchTerms])

  const filtered = filter === 'all' ? terms : terms.filter(t => t.policy === filter)

  if (!brandId) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Выберите бренд</div>
  if (loading) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Загрузка...</div>

  const policyLabel = (policy: Term['policy']) =>
    policy === 'forbidden' ? 'Запрещено' :
    policy === 'preferred' ? 'Рекомендовано' :
    policy === 'discouraged' ? 'Нежелательно' : 'Допустимо'

  return (
    <div className="space-y-6">
      <div className="flex space-x-2">
        {(['all', 'forbidden', 'preferred', 'discouraged'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`aug-button ${filter === f ? 'aug-button--primary' : 'aug-button--secondary'}`}
          >
            {f === 'all' ? 'Все' : f === 'forbidden' ? 'Запрещённые' : f === 'preferred' ? 'Рекомендованные' : 'Нежелательные'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(term => (
          <div
            key={term.id}
            className="m3-card p-4"
            style={{ borderLeft: `4px solid ${POLICY_BORDER_COLOR[term.policy]}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold" style={{ color: 'var(--aug-ink)' }}>{term.term}</span>
              <span
                className="px-2 py-1 rounded text-xs"
                style={POLICY_BADGE_STYLE[term.policy]}
              >
                {policyLabel(term.policy)}
              </span>
            </div>
            {term.replacement && <p className="text-sm" style={{ color: 'var(--aug-accent)' }}>→ {term.replacement}</p>}
            {term.notes && <p className="text-sm mt-1" style={{ color: 'var(--aug-muted)' }}>{term.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
