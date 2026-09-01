'use client'

import { useCallback, useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import { useMarket } from '@/lib/market-context'

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
}

type LatestReview = {
  id: string
  title: string
  raw_text: string
  processing_status: string
  created_at: string
} | null

const SOURCE_DOT_COLOR: Record<string, string> = {
  healthy: 'var(--aug-success-fg)',
}

function getSourceDotColor(status: string | null): string {
  return (status && SOURCE_DOT_COLOR[status]) ?? 'var(--aug-warning-fg)'
}

function CompetitorCard({ competitor, onChanged }: { competitor: Competitor; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [sources, setSources] = useState<CompetitorSource[]>([])
  const [review, setReview] = useState<LatestReview>(null)
  const [loaded, setLoaded] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)
  const [showSourceForm, setShowSourceForm] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceType, setSourceType] = useState('rss')
  const [addingSource, setAddingSource] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/competitors/${competitor.id}`)
      .then((res) => res.json())
      .then((data: { sources: CompetitorSource[]; latestReview: LatestReview }) => {
        setSources(data.sources ?? [])
        setReview(data.latestReview ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [competitor.id])

  useEffect(() => {
    if (expanded && !loaded) load()
  }, [expanded, loaded, load])

  async function addSource() {
    if (!sourceName.trim() || !sourceUrl.trim()) return
    setAddingSource(true)
    try {
      await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sourceName,
          url: sourceUrl,
          source_type: sourceType,
          competitor_id: competitor.id,
        }),
      })
      setSourceName('')
      setSourceUrl('')
      setShowSourceForm(false)
      load()
    } finally {
      setAddingSource(false)
    }
  }

  async function generateReview() {
    setReviewing(true)
    setReviewMessage(null)
    try {
      const res = await fetch(`/api/competitors/${competitor.id}/review`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.status === 'failed') {
        setReviewMessage(`Ошибка: ${data.error ?? 'неизвестная ошибка'}`)
      } else if (data.status === 'no_content') {
        setReviewMessage(t('competitors.review_no_content'))
      } else {
        setReviewMessage(null)
        load()
        onChanged()
      }
    } catch (err) {
      setReviewMessage(`Ошибка сети: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setReviewing(false)
    }
  }

  async function toggleArchive() {
    await fetch(`/api/competitors/${competitor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: competitor.status === 'active' ? 'archived' : 'active' }),
    })
    onChanged()
  }

  return (
    <div className="m3-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold" style={{ color: 'var(--aug-ink)' }}>
              {competitor.name}
            </h3>
            {competitor.status === 'archived' && (
              <span className="m3-chip px-2 py-0.5 text-[10px] font-bold uppercase">
                архив
              </span>
            )}
          </div>
          {competitor.website && (
            <a
              href={competitor.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs no-underline hover:underline"
              style={{ color: 'var(--aug-accent)' }}
            >
              {competitor.website}
            </a>
          )}
          {competitor.notes && (
            <p className="text-sm mt-1" style={{ color: 'var(--aug-muted)' }}>{competitor.notes}</p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--aug-muted)' }}>
            {t('competitors.last_reviewed')}: {competitor.last_reviewed_at ? new Date(competitor.last_reviewed_at).toLocaleDateString('ru-RU') : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleArchive}
          className="aug-button aug-button--secondary shrink-0 text-xs"
        >
          {competitor.status === 'active' ? t('competitors.archive') : t('competitors.restore')}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t flex flex-col gap-4" style={{ borderColor: 'var(--aug-border)' }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--aug-ink)' }}>{t('competitors.sources_title')}</h4>
              <button
                type="button"
                onClick={() => setShowSourceForm((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--aug-accent)' }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t('competitors.add_source')}
              </button>
            </div>

            {sources.length === 0 && !showSourceForm && (
              <p className="text-xs" style={{ color: 'var(--aug-muted)' }}>{t('competitors.no_sources')}</p>
            )}

            <div className="flex flex-col gap-1">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 6, height: 6, background: getSourceDotColor(s.health_status) }}
                  />
                  <span style={{ color: 'var(--aug-ink)' }}>{s.name}</span>
                  <span className="uppercase" style={{ color: 'var(--aug-muted)' }}>{s.source_type}</span>
                </div>
              ))}
            </div>

            {showSourceForm && (
              <div className="mt-2 flex flex-col gap-2">
                <label className="aug-field">
                  <input
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder={t('competitors.source_name')}
                  />
                </label>
                <label className="aug-field">
                  <input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder={t('competitors.source_url')}
                  />
                </label>
                <label className="aug-field">
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                  >
                    <option value="rss">RSS</option>
                    <option value="atom">Atom</option>
                    <option value="html_index">HTML</option>
                    <option value="manual">Вручную</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={addSource}
                  disabled={addingSource || !sourceName.trim() || !sourceUrl.trim()}
                  className="aug-button aug-button--primary"
                >
                  {addingSource ? '...' : t('competitors.add')}
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--aug-ink)' }}>{t('competitors.review_title')}</h4>
              <button
                type="button"
                onClick={generateReview}
                disabled={reviewing}
                className="aug-button aug-button--primary text-xs"
              >
                {reviewing ? t('competitors.generating_review') : review ? t('competitors.refresh_review') : t('competitors.generate_review')}
              </button>
            </div>
            {reviewMessage && (
              <p className="text-xs mb-2" style={{ color: 'var(--aug-muted)' }}>{reviewMessage}</p>
            )}
            {review ? (
              <div className="rounded-md px-3 py-2 text-sm whitespace-pre-wrap" style={{ background: 'var(--aug-soft)', color: 'var(--aug-ink)' }}>
                {review.raw_text}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--aug-muted)' }}>{t('competitors.no_review')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CompetitorsPage() {
  const { regions, marketCode } = useMarket()
  const currentRegionId = regions.find((region) => region.code === marketCode)?.id ?? null
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    fetch(currentRegionId ? `/api/competitors?region_id=${encodeURIComponent(currentRegionId)}` : '/api/competitors')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data: { competitors: Competitor[] }) => {
        setCompetitors(data.competitors ?? [])
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [currentRegionId])

  useEffect(() => load(), [load])

  async function addCompetitor() {
    if (!name.trim()) return
    setAdding(true)
    try {
      await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, website, notes }),
      })
      setName('')
      setWebsite('')
      setNotes('')
      setShowAddForm(false)
      load()
    } finally {
      setAdding(false)
    }
  }

  const active = competitors.filter((c) => c.status === 'active')
  const archived = competitors.filter((c) => c.status === 'archived')

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--aug-ink)' }}>{t('competitors.title')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--aug-muted)' }}>{t('competitors.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="aug-button aug-button--primary"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('competitors.add_competitor')}
          </button>
        </div>

        {showAddForm && (
          <div className="m3-card p-5 flex flex-col gap-2">
            <label className="aug-field">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('competitors.name')} />
            </label>
            <label className="aug-field">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder={t('competitors.website')} />
            </label>
            <label className="aug-field">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('competitors.notes')} rows={2} className="resize-none" />
            </label>
            <button
              type="button"
              onClick={addCompetitor}
              disabled={adding || !name.trim()}
              className="aug-button aug-button--primary w-fit"
            >
              {adding ? '...' : t('competitors.add')}
            </button>
          </div>
        )}

        {loadState === 'ready' && competitors.length === 0 && !showAddForm && (
          <div className="m3-card p-8 text-center flex flex-col items-center gap-2">
            <h2 className="text-base font-semibold" style={{ color: 'var(--aug-ink)' }}>{t('competitors.no_competitors_title')}</h2>
            <p className="text-sm max-w-md" style={{ color: 'var(--aug-muted)' }}>{t('competitors.no_competitors_body')}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {active.map((c) => (
            <CompetitorCard key={c.id} competitor={c} onChanged={load} />
          ))}
        </div>

        {archived.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--aug-muted)' }}>Архив</h2>
            {archived.map((c) => (
              <CompetitorCard key={c.id} competitor={c} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
