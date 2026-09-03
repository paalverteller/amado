'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/api-client'

interface Pillar {
  id: string
  name: string
  purpose: string
  defaultProductExplicitness: string
  riskLevel: string
  sortOrder: number
}

const RISK_BADGE_STYLE: Record<string, { background: string; color: string }> = {
  high: { background: 'var(--aug-danger-bg)', color: 'var(--aug-danger-fg)' },
  medium: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
  low: { background: 'var(--aug-success-bg)', color: 'var(--aug-success-fg)' },
}

export default function ContentPillarsTab({ brandId }: { brandId: string }) {
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPillars = useCallback(async () => {
    const data = await fetchJson<{ pillars?: Pillar[] }>(`/api/brands/${brandId}/pillars`)
    if (data) setPillars(data.pillars ?? [])
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPillars()
  }, [brandId, fetchPillars])

  if (!brandId) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Выберите бренд</div>
  if (loading) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Загрузка...</div>

  const riskLabel = (risk: string) =>
    risk === 'high' ? 'Высокий риск' : risk === 'medium' ? 'Средний риск' : 'Низкий риск'

  return (
    <div className="space-y-4">
      {pillars.sort((a, b) => a.sortOrder - b.sortOrder).map(pillar => (
        <div key={pillar.id} className="m3-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' }}
              >
                {pillar.sortOrder}
              </span>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--aug-ink)' }}>{pillar.name}</h3>
            </div>
            <div className="flex space-x-2">
              <span
                className="px-2 py-1 rounded text-xs"
                style={RISK_BADGE_STYLE[pillar.riskLevel] ?? RISK_BADGE_STYLE.low}
              >
                {riskLabel(pillar.riskLevel)}
              </span>
              <span
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--aug-neutral-bg)', color: 'var(--aug-neutral-fg)' }}
              >
                {pillar.defaultProductExplicitness}
              </span>
            </div>
          </div>
          <p style={{ color: 'var(--aug-muted)' }}>{pillar.purpose}</p>
        </div>
      ))}
    </div>
  )
}
