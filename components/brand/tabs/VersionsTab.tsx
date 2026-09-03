'use client'

import { useState, useEffect, useCallback } from 'react'

interface RuleSet {
  id: string
  version: string
  status: 'draft' | 'review' | 'active' | 'archived'
  createdAt: string
  activatedAt: string | null
  totalRules: number
  createdBy: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  review: 'На проверке',
  active: 'Активна',
  archived: 'В архиве',
}

const STATUS_BADGE_STYLE: Record<string, { background: string; color: string }> = {
  draft: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
  review: { background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' },
  active: { background: 'var(--aug-success-bg)', color: 'var(--aug-success-fg)' },
  archived: { background: 'var(--aug-neutral-bg)', color: 'var(--aug-neutral-fg)' },
}

export default function VersionsTab({ brandId }: { brandId: string }) {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([])
  const [loading, setLoading] = useState(true)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const fetchRuleSets = useCallback(async () => {
    try {
      const res = await fetch(`/api/brands/${brandId}/rule-sets`)
      if (res.ok) setRuleSets((await res.json()).ruleSets || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRuleSets()
  }, [brandId, fetchRuleSets])

  async function handlePublish(ruleSetId: string) {
    setPublishingId(ruleSetId)
    setActionError('')
    try {
      const res = await fetch(`/api/brands/${brandId}/rule-sets/${ruleSetId}/publish`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Не удалось опубликовать версию')
      await fetchRuleSets()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось опубликовать версию')
    } finally {
      setPublishingId(null)
    }
  }

  if (!brandId) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Выберите бренд</div>
  if (loading) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Загрузка...</div>

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-2xl text-sm px-4 py-2" style={{ background: 'var(--aug-danger-bg)', color: 'var(--aug-danger-fg)' }}>{actionError}</div>
      )}

      {ruleSets.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Версий пока нет</div>
      )}

      {ruleSets.map(rs => (
        <div key={rs.id} className="m3-card p-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--aug-ink)' }}>Версия {rs.version}</h3>
              <span
                className="px-2 py-1 rounded text-xs"
                style={STATUS_BADGE_STYLE[rs.status] ?? STATUS_BADGE_STYLE.draft}
              >
                {STATUS_LABEL[rs.status] ?? rs.status}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--aug-muted)' }}>{rs.totalRules} правил</span>
              {rs.status !== 'active' && (
                <button
                  type="button"
                  disabled={publishingId === rs.id}
                  onClick={() => handlePublish(rs.id)}
                  className="aug-button aug-button--primary text-xs"
                >
                  {publishingId === rs.id
                    ? 'Публикуем...'
                    : rs.status === 'archived'
                      ? 'Восстановить'
                      : 'Опубликовать'}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm" style={{ color: 'var(--aug-muted)' }}>
            <div>Создано: {new Date(rs.createdAt).toLocaleDateString('ru-RU')}</div>
            <div>Активировано: {rs.activatedAt ? new Date(rs.activatedAt).toLocaleDateString('ru-RU') : '—'}</div>
            <div>Автор: {rs.createdBy || '—'}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
