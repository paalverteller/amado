'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/api-client'

interface QaFinding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  description: string
  status: 'open' | 'in_review' | 'resolved' | 'waived'
  createdAt: string
}

const SEVERITY_BADGE_STYLE: Record<QaFinding['severity'], { background: string; color: string }> = {
  critical: { background: 'var(--aug-danger-bg)', color: 'var(--aug-danger-fg)' },
  high: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
  medium: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
  low: { background: 'var(--aug-accent-bg)', color: 'var(--aug-accent-fg)' },
}

const SEVERITY_BORDER_COLOR: Record<QaFinding['severity'], string> = {
  critical: 'var(--aug-danger-fg)',
  high: 'var(--aug-warning-fg)',
  medium: 'var(--aug-warning-fg)',
  low: 'var(--aug-accent)',
}

const FINDING_STATUS_BADGE_STYLE: Record<QaFinding['status'], { background: string; color: string }> = {
  open: { background: 'var(--aug-danger-bg)', color: 'var(--aug-danger-fg)' },
  resolved: { background: 'var(--aug-success-bg)', color: 'var(--aug-success-fg)' },
  in_review: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
  waived: { background: 'var(--aug-warning-bg)', color: 'var(--aug-warning-fg)' },
}

export default function ComplianceTab({ brandId }: { brandId: string }) {
  const [findings, setFindings] = useState<QaFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'critical'>('all')

  const fetchFindings = useCallback(async () => {
    const data = await fetchJson<{ findings?: QaFinding[] }>(`/api/brands/${brandId}/qa-findings`)
    if (data) setFindings(data.findings ?? [])
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    if (!brandId) return
    // Confirmed false positive for "call a memoized async fetcher from an
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFindings()
  }, [brandId, fetchFindings])

  const filtered = filter === 'all' ? findings :
    filter === 'open' ? findings.filter(f => f.status === 'open') :
    findings.filter(f => f.severity === 'critical')

  const stats = {
    total: findings.length,
    open: findings.filter(f => f.status === 'open').length,
    critical: findings.filter(f => f.severity === 'critical').length,
  }

  if (!brandId) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Выберите бренд</div>
  if (loading) return <div className="text-center py-12" style={{ color: 'var(--aug-muted)' }}>Загрузка...</div>

  const severityLabel = (s: QaFinding['severity']) =>
    s === 'critical' ? 'Критично' : s === 'high' ? 'Высокая' : s === 'medium' ? 'Средняя' : 'Низкая'

  const statusLabel = (s: QaFinding['status']) =>
    s === 'open' ? 'Открыто' : s === 'resolved' ? 'Решено' : s === 'in_review' ? 'На проверке' : 'Отклонено'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="m3-card p-4">
          <div className="text-sm" style={{ color: 'var(--aug-muted)' }}>Всего замечаний</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--aug-ink)' }}>{stats.total}</div>
        </div>
        <div className="m3-card p-4">
          <div className="text-sm" style={{ color: 'var(--aug-muted)' }}>Открыто</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--aug-warning-fg)' }}>{stats.open}</div>
        </div>
        <div className="m3-card p-4">
          <div className="text-sm" style={{ color: 'var(--aug-muted)' }}>Критичных</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--aug-danger-fg)' }}>{stats.critical}</div>
        </div>
      </div>

      <div className="flex space-x-2">
        {(['all', 'open', 'critical'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`aug-button ${filter === f ? 'aug-button--primary' : 'aug-button--secondary'}`}
          >
            {f === 'all' ? 'Все' : f === 'open' ? 'Открытые' : 'Критичные'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(finding => (
          <div
            key={finding.id}
            className="m3-card p-4"
            style={{ borderLeft: `4px solid ${SEVERITY_BORDER_COLOR[finding.severity]}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={SEVERITY_BADGE_STYLE[finding.severity]}
                >
                  {severityLabel(finding.severity)}
                </span>
                <span className="text-sm" style={{ color: 'var(--aug-muted)' }}>{finding.category}</span>
              </div>
              <span
                className="px-2 py-1 rounded text-xs"
                style={FINDING_STATUS_BADGE_STYLE[finding.status]}
              >
                {statusLabel(finding.status)}
              </span>
            </div>
            <p style={{ color: 'var(--aug-ink)' }}>{finding.description}</p>
            <p className="text-xs mt-2" style={{ color: 'var(--aug-muted)' }}>{new Date(finding.createdAt).toLocaleDateString('ru-RU')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
