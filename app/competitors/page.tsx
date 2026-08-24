'use client'

import { useCallback, useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'

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
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>
              {competitor.name}
            </h3>
            {competitor.status === 'archived' && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: 'var(--v2-color-surface-alt)', color: 'var(--v2-color-text-secondary)' }}>
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
              style={{ color: 'var(--v2-color-brand-primary)' }}
            >
              {competitor.website}
            </a>
          )}
          {competitor.notes && (
            <p className="text-sm mt-1" style={{ color: 'var(--v2-color-text-secondary)' }}>{competitor.notes}</p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--v2-color-text-secondary)' }}>
            {t('competitors.last_reviewed')}: {competitor.last_reviewed_at ? new Date(competitor.last_reviewed_at).toLocaleDateString('ru-RU') : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleArchive}
          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: 'var(--v2-color-surface-alt)', color: 'var(--v2-color-text-secondary)' }}
        >
          {competitor.status === 'active' ? t('competitors.archive') : t('competitors.restore')}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t flex flex-col gap-4" style={{ borderColor: 'var(--v2-color-border-default)' }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('competitors.sources_title')}</h4>
              <button
                type="button"
                onClick={() => setShowSourceForm((v) => !v)}
                className="text-xs font-semibold"
                style={{ color: 'var(--v2-color-brand-primary)' }}
              >
                {t('competitors.add_source')}
              </button>
            </div>

            {sources.length === 0 && !showSourceForm && (
              <p className="text-xs" style={{ color: 'var(--v2-color-text-secondary)' }}>{t('competitors.no_sources')}</p>
            )}

            <div className="flex flex-col gap-1">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 6, height: 6, background: s.health_status === 'healthy' ? 'var(--v2-color-success)' : 'var(--v2-color-warning)' }}
                  />
                  <span style={{ color: 'var(--v2-color-text-primary)' }}>{s.name}</span>
                  <span className="uppercase" style={{ color: 'var(--v2-color-text-secondary)' }}>{s.source_type}</span>
                </div>
              ))}
            </div>

            {showSourceForm && (
              <div className="mt-2 flex flex-col gap-2">
                <input
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder={t('competitors.source_name')}
                  className="rounded-md px-3 py-1.5 text-sm outline-none"
                  style={{ background: 'var(--v2-color-surface-alt)' }}
                />
                <input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder={t('competitors.source_url')}
                  className="rounded-md px-3 py-1.5 text-sm outline-none"
                  style={{ background: 'var(--v2-color-surface-alt)' }}
                />
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="rounded-md px-3 py-1.5 text-sm outline-none"
                  style={{ background: 'var(--v2-color-surface-alt)' }}
                >
                  <option value="rss">RSS</option>
                  <option value="atom">Atom</option>
                  <option value="html_index">HTML</option>
                  <option value="manual">Вручную</option>
                </select>
                <button
                  type="button"
                  onClick={addSource}
                  disabled={addingSource || !sourceName.trim() || !sourceUrl.trim()}
                  className="rounded-md py-1.5 text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
                >
                  {addingSource ? '...' : t('competitors.add')}
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('competitors.review_title')}</h4>
              <button
                type="button"
                onClick={generateReview}
                disabled={reviewing}
                className="rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50"
                style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
              >
                {reviewing ? t('competitors.generating_review') : review ? t('competitors.refresh_review') : t('competitors.generate_review')}
              </button>
            </div>
            {reviewMessage && (
              <p className="text-xs mb-2" style={{ color: 'var(--v2-color-text-secondary)' }}>{reviewMessage}</p>
            )}
            {review ? (
              <div className="rounded-md px-3 py-2 text-sm whitespace-pre-wrap" style={{ background: 'var(--v2-color-surface-alt)', color: 'var(--v2-color-text-primary)' }}>
                {review.raw_text}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--v2-color-text-secondary)' }}>{t('competitors.no_review')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    fetch('/api/competitors')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data: { competitors: Competitor[] }) => {
        setCompetitors(data.competitors ?? [])
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [])

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
            <h1 className="text-2xl font-bold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('competitors.title')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--v2-color-text-secondary)' }}>{t('competitors.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
          >
            {t('competitors.add_competitor')}
          </button>
        </div>

        {showAddForm && (
          <div className="rounded-lg border p-5 flex flex-col gap-2" style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('competitors.name')} className="rounded-md px-3 py-2 text-sm outline-none" style={{ background: 'var(--v2-color-surface-alt)' }} />
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder={t('competitors.website')} className="rounded-md px-3 py-2 text-sm outline-none" style={{ background: 'var(--v2-color-surface-alt)' }} />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('competitors.notes')} rows={2} className="rounded-md px-3 py-2 text-sm outline-none resize-none" style={{ background: 'var(--v2-color-surface-alt)' }} />
            <button
              type="button"
              onClick={addCompetitor}
              disabled={adding || !name.trim()}
              className="rounded px-4 py-2 text-sm font-semibold disabled:opacity-50 w-fit"
              style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
            >
              {adding ? '...' : t('competitors.add')}
            </button>
          </div>
        )}

        {loadState === 'ready' && competitors.length === 0 && !showAddForm && (
          <div className="rounded-lg border p-8 text-center flex flex-col items-center gap-2" style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>{t('competitors.no_competitors_title')}</h2>
            <p className="text-sm max-w-md" style={{ color: 'var(--v2-color-text-secondary)' }}>{t('competitors.no_competitors_body')}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {active.map((c) => (
            <CompetitorCard key={c.id} competitor={c} onChanged={load} />
          ))}
        </div>

        {archived.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--v2-color-text-secondary)' }}>Архив</h2>
            {archived.map((c) => (
              <CompetitorCard key={c.id} competitor={c} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
