'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/api-client'

interface BrandOverview {
  id: string
  brandName: string
  positioning: string
  voiceDescription: string
  targetAudience: string
  competitors: string
  isActive: boolean
  isDefault: boolean
  regionName: string
  locale: string
  ruleSetVersion: string
  ruleSetStatus: string
  totalRules: number
  approvedRules: number
  pendingRules: number
}

export default function OverviewTab({ brandId }: { brandId: string }) {
  const [overview, setOverview] = useState<BrandOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOverview = useCallback(async () => {
    const data = await fetchJson<{ overview?: BrandOverview }>(`/api/brands/${brandId}/overview`)
    if (data) setOverview(data.overview ?? null)
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOverview()
  }, [brandId, fetchOverview])

  if (!brandId) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--aug-muted)' }}>Выберите бренд, чтобы увидеть данные</p>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Загрузка...</div>
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--aug-muted)' }}>Для этого бренда пока нет данных</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Positioning Card */}
      <div className="m3-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--aug-ink)' }}>Позиционирование бренда</h2>
        <div className="prose max-w-none">
          <p className="text-lg leading-relaxed" style={{ color: 'var(--aug-ink)' }}>{overview.positioning || '—'}</p>
        </div>
        <div className="mt-4 flex items-center space-x-4">
          <span
            className="px-3 py-1 rounded-full text-sm"
            style={{ background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' }}
          >
            {overview.regionName}
          </span>
          <span
            className="px-3 py-1 rounded-full text-sm"
            style={{ background: 'var(--aug-success-bg)', color: 'var(--aug-success-fg)' }}
          >
            {overview.locale}
          </span>
          {overview.isDefault && (
            <span
              className="px-3 py-1 rounded-full text-sm"
              style={{ background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' }}
            >
              По умолчанию
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="m3-card p-6">
          <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Версия политики</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--aug-ink)' }}>{overview.ruleSetVersion}</div>
          <div className="text-sm mt-1" style={{ color: overview.ruleSetStatus === 'active' ? 'var(--aug-success-fg)' : 'var(--aug-warning-fg)' }}>
            {overview.ruleSetStatus === 'active' ? 'Активна' : overview.ruleSetStatus === 'none' ? 'Нет активной версии' : 'Черновик'}
          </div>
        </div>
        <div className="m3-card p-6">
          <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Всего правил</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--aug-ink)' }}>{overview.totalRules}</div>
        </div>
        <div className="m3-card p-6">
          <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Утверждено</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--aug-success-fg)' }}>{overview.approvedRules}</div>
        </div>
        <div className="m3-card p-6">
          <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Ожидает проверки</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--aug-warning-fg)' }}>{overview.pendingRules}</div>
        </div>
      </div>

      {/* Voice & Audience */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="m3-card p-6">
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--aug-ink)' }}>Голос бренда</h3>
          <p style={{ color: 'var(--aug-ink)' }}>{overview.voiceDescription || '—'}</p>
        </div>
        <div className="m3-card p-6">
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--aug-ink)' }}>Целевая аудитория</h3>
          <p style={{ color: 'var(--aug-ink)' }}>{overview.targetAudience || '—'}</p>
        </div>
      </div>

      {/* Competitors */}
      <div className="m3-card p-6">
        <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--aug-ink)' }}>Конкуренты</h3>
        <div className="flex flex-wrap gap-2">
          {overview.competitors
            ? overview.competitors.split(',').map((comp, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-sm"
                  style={{ background: 'var(--aug-neutral-bg)', color: 'var(--aug-neutral-fg)' }}
                >
                  {comp.trim()}
                </span>
              ))
            : <span className="text-sm" style={{ color: 'var(--aug-muted)' }}>—</span>}
        </div>
      </div>
    </div>
  )
}
