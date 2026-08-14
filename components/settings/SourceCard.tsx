'use client'

import { useState } from 'react'
import { confirmAction } from '@/components/ui/AugustFeedback'

interface SourceHealth {
  status: string
  consecutiveFailures: number
  lastSuccess: string | null
  lastFailure: string | null
  lastErrorMessage: string | null
  successRate24h: number | null
}

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
  health?: SourceHealth
  onToggleActive: (id: string, currentStatus: boolean) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

const HEALTH_LABEL: Record<string, string> = {
  healthy: 'Здорова',
  degraded: 'Нестабильна',
  unhealthy: 'Не работает',
  unknown: 'Нет данных',
}

const HEALTH_COLOR: Record<string, string> = {
  healthy: 'bg-green-100 text-green-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  unhealthy: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-600',
}

export default function SourceCard({ source, health, onToggleActive, onDelete }: SourceCardProps) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualResult, setManualResult] = useState<string | null>(null)
  const isActive = source.is_active ?? source.active ?? true
  const type = source.source_type ?? source.type ?? 'rss'
  const healthStatus = health?.status ?? 'unknown'

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
    const confirmed = await confirmAction({
      title: 'Удалить источник?',
      message: `Источник «${source.name}» и связанные материалы будут удалены.`,
      confirmLabel: 'Удалить',
      danger: true,
    })
    if (!confirmed) return

    setLoading(true)
    try {
      await onDelete(source.id)
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/sources/${source.id}/test`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setTestResult(`Ошибка: ${data.error ?? 'неизвестная ошибка'}`)
      } else if (data.status === 'skipped') {
        setTestResult('Источник неактивен')
      } else {
        const count = data.ingestion?.itemsFetched ?? 0
        setTestResult(
          data.status === 'healthy'
            ? `Успешно: получено ${count} материалов`
            : data.status === 'degraded'
              ? 'Источник отвечает, но новых материалов не найдено'
              : `Не удалось получить данные: ${data.ingestion?.error ?? 'см. лог'}`
        )
      }
    } catch (err) {
      setTestResult(`Ошибка сети: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  async function handleManualSubmit() {
    if (!manualTitle.trim() || !manualContent.trim()) return
    setManualSubmitting(true)
    setManualResult(null)
    try {
      const res = await fetch(`/api/rss/${source.id}/manual-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: manualTitle, content: manualContent, url: manualUrl || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setManualResult(`Ошибка: ${data.error ?? 'неизвестная ошибка'}`)
      } else {
        setManualResult('Материал добавлен')
        setManualTitle('')
        setManualContent('')
        setManualUrl('')
      }
    } catch (err) {
      setManualResult(`Ошибка сети: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setManualSubmitting(false)
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
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${HEALTH_COLOR[healthStatus] ?? HEALTH_COLOR.unknown}`}>
              {HEALTH_LABEL[healthStatus] ?? HEALTH_LABEL.unknown}
            </span>
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

        {health?.lastErrorMessage && healthStatus !== 'healthy' && (
          <p className="mt-2 line-clamp-2 text-[11px] text-red-600" title={health.lastErrorMessage}>
            {health.lastErrorMessage}
          </p>
        )}

        {health?.consecutiveFailures ? (
          <p className="mt-1 text-[11px] text-on-surface-variant">
            Подряд неудач: {health.consecutiveFailures}
            {health.successRate24h !== null && ` · за 24ч успешно: ${health.successRate24h}%`}
          </p>
        ) : null}

        {testResult && (
          <p className="mt-2 text-[11px] text-on-surface-variant">{testResult}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-surface-variant/50 pt-3 text-[11px] font-medium text-on-surface-variant">
        <span>
          Синхронизация: {source.last_fetched_at ? new Date(source.last_fetched_at).toLocaleDateString('ru-RU') : 'Вручную'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {type === 'manual' ? (
            <button
              type="button"
              onClick={() => setShowManualForm(v => !v)}
              className="rounded-full px-3 py-1 font-semibold text-primary hover:bg-primary/10"
            >
              {showManualForm ? 'Скрыть' : '+ Добавить материал'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || loading}
              className="rounded-full px-3 py-1 font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {testing ? 'Проверка...' : 'Проверить'}
            </button>
          )}
          {onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="rounded-full px-3 py-1 font-semibold text-error hover:bg-error-container/40 disabled:opacity-50"
            >
              Удалить
            </button>
          ) : null}
        </div>
      </div>

      {type === 'manual' && showManualForm && (
        <div className="border-t border-surface-variant/50 pt-3 space-y-2">
          <input
            value={manualTitle}
            onChange={e => setManualTitle(e.target.value)}
            placeholder="Заголовок"
            className="w-full rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none"
          />
          <textarea
            value={manualContent}
            onChange={e => setManualContent(e.target.value)}
            placeholder="Текст материала (вставьте сюда содержание рассылки, статьи и т.п.)"
            rows={4}
            className="w-full rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none resize-none"
          />
          <input
            value={manualUrl}
            onChange={e => setManualUrl(e.target.value)}
            placeholder="Ссылка на источник (необязательно)"
            className="w-full rounded-md bg-surface-container px-3 py-1.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={manualSubmitting || !manualTitle.trim() || !manualContent.trim()}
            className="m3-button-filled w-full py-1.5 disabled:opacity-50"
          >
            {manualSubmitting ? 'Добавление...' : 'Добавить'}
          </button>
          {manualResult && (
            <p className="text-[11px] text-on-surface-variant">{manualResult}</p>
          )}
        </div>
      )}
    </div>
  )
}