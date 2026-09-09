'use client'

import { useEffect, useId, useState } from 'react'
import Layout from '@/components/Layout'
import { toast } from '@/components/ui/AugustFeedback'
import { t } from '@/lib/i18n/config'
import { useMarket } from '@/lib/market-context'

// AMADO_MARKET_INTELLIGENCE_SPRINT_20260909

type Competitor = {
  id: string
  name: string
  website: string | null
  notes: string | null
  status: 'active' | 'archived'
  last_reviewed_at: string | null
}

type CompetitorSource = {
  id: string
  name: string
  url: string
  source_type: string
  active: boolean
  health_status: string | null
  last_success_at?: string | null
  last_failure_at?: string | null
}

type LatestReview = {
  id: string
  title: string
  raw_text: string
  processing_status: string
  created_at: string
} | null

type SourceLoadState = 'idle' | 'loading' | 'ready' | 'error'

type ApiError = { error?: string }

const SOURCE_HEALTH_LABELS: Record<string, string> = {
  healthy: 'Работает',
  degraded: 'Есть сбои',
  unhealthy: 'Не работает',
  failed: 'Ошибка',
  error: 'Ошибка',
  unknown: 'Не проверен',
}

function sourceHealthLabel(status: string | null): string {
  return SOURCE_HEALTH_LABELS[status ?? 'unknown'] ?? 'Не проверен'
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>
}

function CompetitorCard({ competitor, onChanged }: { competitor: Competitor; onChanged: () => void }) {
  const detailsId = useId()
  const [expanded, setExpanded] = useState(false)
  const [sources, setSources] = useState<CompetitorSource[]>([])
  const [review, setReview] = useState<LatestReview>(null)
  const [sourceLoadState, setSourceLoadState] = useState<SourceLoadState>('idle')
  const [reviewing, setReviewing] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)
  const [showSourceForm, setShowSourceForm] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceType, setSourceType] = useState('rss')
  const [addingSource, setAddingSource] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!expanded) return
    const controller = new AbortController()
    setSourceLoadState('loading')

    fetch(`/api/competitors/${competitor.id}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await readJson<{ sources?: CompetitorSource[]; latestReview?: LatestReview; error?: string }>(response)
        if (!response.ok) throw new Error(data.error ?? 'Не удалось загрузить данные конкурента')
        return data
      })
      .then((data) => {
        setSources(data.sources ?? [])
        setReview(data.latestReview ?? null)
        setSourceLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setSourceLoadState('error')
        toast.error(error instanceof Error ? error.message : 'Не удалось загрузить источники', competitor.name)
      })

    return () => controller.abort()
  }, [competitor.id, competitor.name, expanded, reloadKey])

  function reloadDetails() {
    setReloadKey((value) => value + 1)
  }

  async function addSource() {
    if (!sourceName.trim() || !sourceUrl.trim()) return
    setAddingSource(true)
    try {
      const response = await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sourceName.trim(),
          url: sourceUrl.trim(),
          source_type: sourceType,
          competitor_id: competitor.id,
        }),
      })
      const data = await readJson<ApiError>(response)
      if (!response.ok) throw new Error(data.error ?? 'Не удалось добавить источник')
      setSourceName('')
      setSourceUrl('')
      setShowSourceForm(false)
      reloadDetails()
      toast.success('Источник добавлен в мониторинг.', competitor.name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось добавить источник', competitor.name)
    } finally {
      setAddingSource(false)
    }
  }

  async function generateReview() {
    setReviewing(true)
    setReviewMessage(null)
    try {
      const response = await fetch(`/api/competitors/${competitor.id}/review`, { method: 'POST' })
      const data = await readJson<{ status?: string; error?: string }>(response)
      if (!response.ok || data.status === 'failed') {
        throw new Error(data.error ?? 'Не удалось собрать обзор')
      }
      if (data.status === 'no_content') {
        setReviewMessage(t('competitors.review_no_content'))
      } else {
        reloadDetails()
        onChanged()
        toast.success('Обзор обновлён по официальным и независимым сигналам.', competitor.name)
      }
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : 'Не удалось собрать обзор')
    } finally {
      setReviewing(false)
    }
  }

  async function toggleArchive() {
    const nextStatus = competitor.status === 'active' ? 'archived' : 'active'
    setArchiving(true)
    try {
      const response = await fetch(`/api/competitors/${competitor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await readJson<ApiError>(response)
      if (!response.ok) throw new Error(data.error ?? 'Не удалось изменить статус конкурента')
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось изменить статус конкурента', competitor.name)
    } finally {
      setArchiving(false)
    }
  }

  return (
    <article className="m3-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={detailsId}
          >
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-on-surface">{competitor.name}</span>
              {competitor.status === 'archived' ? (
                <span className="m3-chip px-2 py-0.5 text-[10px] font-bold uppercase">архив</span>
              ) : null}
              <span className="text-xs text-on-surface-variant" aria-hidden="true">{expanded ? '−' : '+'}</span>
            </span>
            {competitor.notes ? <span className="mt-1 block text-sm text-on-surface-variant">{competitor.notes}</span> : null}
            <span className="mt-1 block text-xs text-on-surface-variant">
              {t('competitors.last_reviewed')}: {competitor.last_reviewed_at ? new Date(competitor.last_reviewed_at).toLocaleDateString('ru-RU') : '—'}
            </span>
          </button>
          {competitor.website ? (
            <a href={competitor.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary no-underline hover:underline">
              {competitor.website}
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleArchive}
          disabled={archiving}
          aria-label={`${competitor.status === 'active' ? t('competitors.archive') : t('competitors.restore')}: ${competitor.name}`}
          className="aug-button aug-button--secondary shrink-0 text-xs"
        >
          {archiving ? '…' : competitor.status === 'active' ? t('competitors.archive') : t('competitors.restore')}
        </button>
      </div>

      {expanded ? (
        <div id={detailsId} className="mt-4 border-t border-surface-variant/40 pt-4 flex flex-col gap-4">
          <section aria-labelledby={`${detailsId}-sources`}>
            <div className="mb-2 flex items-center justify-between">
              <h4 id={`${detailsId}-sources`} className="text-sm font-semibold text-on-surface">{t('competitors.sources_title')}</h4>
              <button type="button" onClick={() => setShowSourceForm((value) => !value)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t('competitors.add_source')}
              </button>
            </div>

            {sourceLoadState === 'loading' ? <p className="text-xs text-on-surface-variant">Загружаю источники…</p> : null}
            {sourceLoadState === 'error' ? <p className="text-xs text-error" role="alert">Не удалось загрузить источники. Закройте и откройте карточку или повторите позже.</p> : null}
            {sourceLoadState === 'ready' && sources.length === 0 && !showSourceForm ? (
              <p className="text-xs text-on-surface-variant">{t('competitors.no_sources')}</p>
            ) : null}

            <div className="flex flex-col gap-1">
              {sources.map((source) => {
                const health = sourceHealthLabel(source.health_status)
                return (
                  <div key={source.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="sr-only">Состояние источника: {health}.</span>
                    <span className="inline-block h-2 w-2 rounded-full bg-surface-variant" data-health={source.health_status ?? 'unknown'} aria-hidden="true" />
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-on-surface hover:underline">{source.name}</a>
                    <span className="uppercase text-on-surface-variant">{source.source_type}</span>
                    <span className="text-on-surface-variant">· {health}</span>
                  </div>
                )
              })}
            </div>

            {showSourceForm ? (
              <div className="mt-3 flex flex-col gap-3">
                <label className="aug-field">
                  <span>{t('competitors.source_name')}</span>
                  <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Например: Product newsroom" />
                </label>
                <label className="aug-field">
                  <span>{t('competitors.source_url')}</span>
                  <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} inputMode="url" placeholder="https://…" />
                </label>
                <label className="aug-field">
                  <span>Тип источника</span>
                  <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                    <option value="rss">RSS</option>
                    <option value="atom">Atom</option>
                    <option value="html_index">HTML</option>
                    <option value="manual">Вручную</option>
                  </select>
                </label>
                <button type="button" onClick={addSource} disabled={addingSource || !sourceName.trim() || !sourceUrl.trim()} className="aug-button aug-button--primary w-fit">
                  {addingSource ? 'Добавляю…' : t('competitors.add')}
                </button>
              </div>
            ) : null}
          </section>

          <section aria-labelledby={`${detailsId}-review`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 id={`${detailsId}-review`} className="text-sm font-semibold text-on-surface">{t('competitors.review_title')}</h4>
              <button type="button" onClick={generateReview} disabled={reviewing} className="aug-button aug-button--primary text-xs" aria-busy={reviewing}>
                {reviewing ? t('competitors.generating_review') : review ? t('competitors.refresh_review') : t('competitors.generate_review')}
              </button>
            </div>
            {reviewMessage ? <p className="mb-2 text-xs text-error" role="alert">{reviewMessage}</p> : null}
            {review ? (
              <div className="rounded-md bg-surface-container px-3 py-2 text-sm text-on-surface whitespace-pre-wrap">{review.raw_text}</div>
            ) : (
              <p className="text-xs text-on-surface-variant">{t('competitors.no_review')}</p>
            )}
          </section>
        </div>
      ) : null}
    </article>
  )
}

export default function CompetitorsPage() {
  const { currentRegion, ready, error: marketError } = useMarket()
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loadState, setLoadState] = useState<'waiting' | 'loading' | 'ready' | 'error'>('waiting')
  const [reloadKey, setReloadKey] = useState(0)
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!ready || !currentRegion) {
      setCompetitors([])
      setLoadState('waiting')
      return
    }

    const controller = new AbortController()
    setCompetitors([])
    setLoadState('loading')

    fetch(`/api/competitors?region_id=${encodeURIComponent(currentRegion.id)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await readJson<{ competitors?: Competitor[]; error?: string }>(response)
        if (!response.ok) throw new Error(data.error ?? 'Не удалось загрузить конкурентов')
        return data
      })
      .then((data) => {
        setCompetitors(data.competitors ?? [])
        setLoadState('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setLoadState('error')
        toast.error(error instanceof Error ? error.message : 'Не удалось загрузить конкурентов', 'Конкуренты')
      })

    return () => controller.abort()
  }, [currentRegion, ready, reloadKey])

  function reload() {
    setReloadKey((value) => value + 1)
  }

  async function addCompetitor() {
    if (!name.trim() || !ready || !currentRegion) return
    setAdding(true)
    try {
      const response = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), website: website.trim(), notes: notes.trim(), region_id: currentRegion.id }),
      })
      const data = await readJson<ApiError>(response)
      if (!response.ok) throw new Error(data.error ?? 'Не удалось добавить конкурента')
      setName('')
      setWebsite('')
      setNotes('')
      setShowAddForm(false)
      reload()
      toast.success('Конкурент добавлен в выбранный рынок.', 'Конкуренты')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось добавить конкурента', 'Конкуренты')
    } finally {
      setAdding(false)
    }
  }

  const active = competitors.filter((competitor) => competitor.status === 'active')
  const archived = competitors.filter((competitor) => competitor.status === 'archived')

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">{t('competitors.title')}</h1>
            <p className="mt-1 text-sm text-on-surface-variant">{t('competitors.subtitle')}</p>
          </div>
          <button type="button" onClick={() => setShowAddForm((value) => !value)} disabled={!ready || !currentRegion} className="aug-button aug-button--primary">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('competitors.add_competitor')}
          </button>
        </div>

        {marketError ? <div className="rounded-xl bg-error-container p-4 text-sm font-medium text-on-error-container" role="alert">{marketError}</div> : null}

        {showAddForm ? (
          <div className="m3-card p-5 flex flex-col gap-3">
            <label className="aug-field">
              <span>{t('competitors.name')}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="aug-field">
              <span>{t('competitors.website')}</span>
              <input value={website} onChange={(event) => setWebsite(event.target.value)} inputMode="url" placeholder="https://…" />
            </label>
            <label className="aug-field">
              <span>{t('competitors.notes')}</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="resize-none" />
            </label>
            <button type="button" onClick={addCompetitor} disabled={adding || !name.trim() || !ready || !currentRegion} className="aug-button aug-button--primary w-fit">
              {adding ? 'Добавляю…' : t('competitors.add')}
            </button>
          </div>
        ) : null}

        {loadState === 'loading' || loadState === 'waiting' ? (
          <div className="m3-card p-6 text-sm text-on-surface-variant" aria-live="polite">Загружаю конкурентов выбранного рынка…</div>
        ) : null}

        {loadState === 'error' ? (
          <div className="m3-card p-6" role="alert">
            <h2 className="text-base font-semibold text-on-surface">Не удалось загрузить конкурентов</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Данные не заменены пустым списком. Повторите запрос.</p>
            <button type="button" className="aug-button aug-button--secondary mt-4" onClick={reload}>Повторить</button>
          </div>
        ) : null}

        {loadState === 'ready' && competitors.length === 0 && !showAddForm ? (
          <div className="m3-card p-8 text-center flex flex-col items-center gap-2">
            <h2 className="text-base font-semibold text-on-surface">{t('competitors.no_competitors_title')}</h2>
            <p className="text-sm max-w-md text-on-surface-variant">{t('competitors.no_competitors_body')}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {active.map((competitor) => <CompetitorCard key={competitor.id} competitor={competitor} onChanged={reload} />)}
        </div>

        {archived.length > 0 ? (
          <section className="flex flex-col gap-3" aria-labelledby="competitors-archive-heading">
            <h2 id="competitors-archive-heading" className="text-sm font-semibold text-on-surface-variant">Архив</h2>
            {archived.map((competitor) => <CompetitorCard key={competitor.id} competitor={competitor} onChanged={reload} />)}
          </section>
        ) : null}
      </div>
    </Layout>
  )
}
