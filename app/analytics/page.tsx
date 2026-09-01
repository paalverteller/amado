'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import { getErrorMessage } from '@/lib/api/error-message'

interface SourceHealth {
  id: string
  name: string
  url: string
  connectorType: string
  active: boolean
  category: string
  country: string
  health: {
    status: string
    consecutiveFailures: number
    lastSuccess: string | null
    lastFailure: string | null
    successRate24h: number | null
    events24h: number
  }
  itemsCount: number
}

interface HealthSummary {
  total: number
  healthy: number
  unhealthy: number
  inactive: number
  activeRate: number
  healthRate: number
}

interface PipelineMetrics {
  generatedToday: number
  publishedToday: number
  failedToday: number
  pendingRequests: number
}

const STATUS_DOT: Record<string, string> = {
  healthy: 'var(--aug-success-fg)',
  degraded: 'var(--aug-warning-fg)',
  unhealthy: 'var(--aug-danger-fg)',
}

function getStatusDotColor(status: string): string {
  return STATUS_DOT[status] ?? 'var(--aug-neutral-fg)'
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'healthy': return 'Работает'
    case 'degraded': return 'Нестабильно'
    case 'unhealthy': return 'Критично'
    default: return 'Неизвестно'
  }
}

export default function AnalyticsPage() {
  const [sources, setSources] = useState<SourceHealth[]>([])
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [pipeline, setPipeline] = useState<PipelineMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // fetchData synchronizes the page with the sources-health and pipeline APIs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      setError('')

      const healthRes = await fetch('/api/sources/health')
      if (!healthRes.ok) throw new Error('Не удалось загрузить состояние источников')
      const healthData = await healthRes.json()
      setSources(healthData.sources || [])
      setSummary(healthData.summary || null)

      const pipelineRes = await fetch('/api/analytics/pipeline')
      if (pipelineRes.ok) {
        const pipelineData = await pipelineRes.json()
        setPipeline(pipelineData.metrics || null)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--aug-ink)' }}>Аналитика</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--aug-muted)' }}>Метрики источников и контентного потока</p>
        </div>

        {loading && (
          <div className="m3-card p-8 text-center text-sm" style={{ color: 'var(--aug-muted)' }}>
            Загрузка аналитики…
          </div>
        )}

        {!loading && error && (
          <div className="m3-card p-8 text-center text-sm" style={{ color: 'var(--aug-danger-fg)' }}>
            Ошибка: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="m3-card p-6">
                  <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Всего источников</div>
                  <div className="text-3xl font-bold" style={{ color: 'var(--aug-ink)' }}>{summary.total}</div>
                </div>
                <div className="m3-card p-6">
                  <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Рабочие источники</div>
                  <div className="text-3xl font-bold" style={{ color: 'var(--aug-success-fg)' }}>{summary.healthy}</div>
                  <div className="text-sm" style={{ color: 'var(--aug-dark-muted)' }}>{summary.healthRate}% от общего числа</div>
                </div>
                <div className="m3-card p-6">
                  <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Проблемные источники</div>
                  <div className="text-3xl font-bold" style={{ color: 'var(--aug-danger-fg)' }}>{summary.unhealthy}</div>
                </div>
                <div className="m3-card p-6">
                  <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Доля активных</div>
                  <div className="text-3xl font-bold" style={{ color: 'var(--aug-accent)' }}>{summary.activeRate}%</div>
                </div>
              </div>
            )}

            {pipeline && (
              <div className="m3-card">
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--aug-border)' }}>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--aug-ink)' }}>Контент за 24 часа</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                  <div>
                    <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Создано</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--aug-accent)' }}>{pipeline.generatedToday}</div>
                  </div>
                  <div>
                    <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Опубликовано</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--aug-success-fg)' }}>{pipeline.publishedToday}</div>
                  </div>
                  <div>
                    <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>Ошибки</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--aug-danger-fg)' }}>{pipeline.failedToday}</div>
                  </div>
                  <div>
                    <div className="text-sm mb-1" style={{ color: 'var(--aug-muted)' }}>В очереди</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--aug-warning-fg)' }}>{pipeline.pendingRequests}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="m3-card">
              <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--aug-border)' }}>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--aug-ink)' }}>Состояние источников</h2>
                <button type="button" onClick={fetchData} className="aug-button aug-button--secondary">
                  {t('action.refresh')}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--aug-soft)' }}>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aug-muted)' }}>Источник</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aug-muted)' }}>Статус</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aug-muted)' }}>Успешность за 24 часа</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aug-muted)' }}>Ошибки подряд</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aug-muted)' }}>Материалы</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aug-muted)' }}>Последний успех</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source) => (
                      <tr key={source.id} style={{ borderTop: '1px solid var(--aug-border)' }}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium" style={{ color: 'var(--aug-ink)' }}>{source.name}</div>
                          <div className="text-sm" style={{ color: 'var(--aug-muted)' }}>{source.connectorType}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 8, height: 8, background: getStatusDotColor(source.health.status) }}
                            />
                            <span className="text-sm" style={{ color: 'var(--aug-ink)' }}>{getStatusLabel(source.health.status)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm" style={{ color: 'var(--aug-ink)' }}>
                            {source.health.successRate24h !== null ? `${source.health.successRate24h}%` : 'Н/Д'}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--aug-muted)' }}>{source.health.events24h} событий</div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="text-sm font-medium"
                            style={{ color: source.health.consecutiveFailures > 2 ? 'var(--aug-danger-fg)' : 'var(--aug-ink)' }}
                          >
                            {source.health.consecutiveFailures}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm" style={{ color: 'var(--aug-ink)' }}>{source.itemsCount}</td>
                        <td className="px-6 py-4 text-sm" style={{ color: 'var(--aug-muted)' }}>
                          {source.health.lastSuccess
                            ? new Date(source.health.lastSuccess).toLocaleDateString('ru-RU')
                            : 'Никогда'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
