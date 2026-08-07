'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import { formatRelativeTime } from '@/lib/locale'

type EvidenceRef = {
  id: string
  source_title: string | null
  source_summary: string | null
  canonical_url: string | null
  published_at: string | null
  hydration_status: string | null
}

type BriefingItem = {
  id: string
  rank: number
  why_it_matters: string
  feedback: 'useful' | 'irrelevant' | null
  sent_to_generation_at: string | null
  evidence_item: EvidenceRef | EvidenceRef[] | null
}

type BriefingRun = {
  id: string
  run_date: string
  status: 'generating' | 'ready' | 'failed' | 'empty'
  items_count: number
  created_at: string
  completed_at: string | null
}

function firstEvidence(ref: EvidenceRef | EvidenceRef[] | null): EvidenceRef | null {
  if (!ref) return null
  return Array.isArray(ref) ? (ref[0] ?? null) : ref
}

function isRealUrl(url: string | null): boolean {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'))
}

export default function OverviewPage() {
  const router = useRouter()
  const [run, setRun] = useState<BriefingRun | null>(null)
  const [items, setItems] = useState<BriefingItem[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(() => {
    let cancelled = false
    fetch('/api/briefing')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('request failed'))))
      .then((data: { run: BriefingRun | null; items: BriefingItem[] }) => {
        if (cancelled) return
        setRun(data.run)
        setItems(data.items ?? [])
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  async function setFeedback(itemId: string, feedback: 'useful' | 'irrelevant') {
    const next = items.map(i => i.id === itemId ? { ...i, feedback: i.feedback === feedback ? null : feedback } : i)
    setItems(next)
    const applied = next.find(i => i.id === itemId)?.feedback ?? null
    try {
      await fetch(`/api/briefing/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: applied }),
      })
    } catch {
      // Non-critical -- feedback is a nice-to-have signal, not worth
      // blocking or alarming the person over a failed PATCH.
    }
  }

  async function sendToGeneration(item: BriefingItem) {
    const ev = firstEvidence(item.evidence_item)
    const topic = ev?.source_title ?? ''
    const context = [ev?.source_summary, item.why_it_matters].filter(Boolean).join('\n\n')

    fetch(`/api/briefing/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentToGeneration: true }),
    }).catch(() => { /* non-critical, navigate regardless */ })

    router.push(`/generate?topic=${encodeURIComponent(topic)}&context=${encodeURIComponent(context)}`)
  }

  const freshnessDate = run?.completed_at ?? run?.created_at ?? null

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--v2-color-text-primary)' }}>
            {t('overview.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--v2-color-text-secondary)' }}>
            {t('overview.subtitle')}
          </p>
        </div>

        <div
          className="rounded-lg border px-4 py-3 text-sm inline-flex items-center gap-2 w-fit"
          style={{
            borderColor: 'var(--v2-color-border-default)',
            background: 'var(--v2-color-surface-alt)',
            color: 'var(--v2-color-text-secondary)',
          }}
        >
          <span
            className="inline-block rounded-full"
            style={{
              width: 8,
              height: 8,
              background: run?.status === 'ready' ? 'var(--v2-color-success)' : 'var(--v2-color-warning)',
            }}
          />
          {t('overview.freshness_label')}:{' '}
          <strong style={{ color: 'var(--v2-color-text-primary)' }}>
            {loadState === 'loading' ? '…' : freshnessDate ? formatRelativeTime(freshnessDate) : t('market.no_items')}
          </strong>
        </div>

        {loadState === 'ready' && run?.status === 'ready' && items.length > 0 ? (
          <div className="flex flex-col gap-3">
            {items.map((item) => {
              const ev = firstEvidence(item.evidence_item)
              return (
                <div
                  key={item.id}
                  className="rounded-lg border p-5 flex flex-col gap-2"
                  style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
                    >
                      {item.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold break-words" style={{ color: 'var(--v2-color-text-primary)' }}>
                        {ev?.source_title ?? '—'}
                      </h3>
                      {isRealUrl(ev?.canonical_url ?? null) && (
                        <a
                          href={ev!.canonical_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs no-underline hover:underline"
                          style={{ color: 'var(--v2-color-brand-primary)' }}
                        >
                          {t('overview.source_link')} ↗
                        </a>
                      )}
                    </div>
                  </div>

                  <div
                    className="rounded-md px-3 py-2 text-sm"
                    style={{ background: 'var(--v2-color-surface-alt)', color: 'var(--v2-color-text-primary)' }}
                  >
                    <span className="font-semibold">{t('overview.why_matters')}:</span> {item.why_it_matters}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setFeedback(item.id, 'useful')}
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        background: item.feedback === 'useful' ? 'var(--v2-color-success)' : 'var(--v2-color-surface-alt)',
                        color: item.feedback === 'useful' ? '#fff' : 'var(--v2-color-text-secondary)',
                      }}
                    >
                      {t('overview.mark_useful')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedback(item.id, 'irrelevant')}
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        background: item.feedback === 'irrelevant' ? 'var(--v2-color-danger)' : 'var(--v2-color-surface-alt)',
                        color: item.feedback === 'irrelevant' ? '#fff' : 'var(--v2-color-text-secondary)',
                      }}
                    >
                      {t('overview.mark_irrelevant')}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendToGeneration(item)}
                      className="rounded-full px-3 py-1 text-xs font-semibold ml-auto"
                      style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
                    >
                      {item.sent_to_generation_at ? `✓ ${t('overview.send_to_generation')}` : t('overview.send_to_generation')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : loadState === 'ready' && run?.status === 'generating' ? (
          <div
            className="rounded-lg border p-8 text-center flex flex-col items-center gap-2"
            style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>
              {t('overview.generating_title')}
            </h2>
            <p className="text-sm max-w-md" style={{ color: 'var(--v2-color-text-secondary)' }}>
              {t('overview.generating_body')}
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg border p-8 text-center flex flex-col items-center gap-2"
            style={{ borderColor: 'var(--v2-color-border-default)', background: 'var(--v2-color-surface-base)' }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--v2-color-text-primary)' }}>
              {t('overview.no_briefing_title')}
            </h2>
            <p className="text-sm max-w-md" style={{ color: 'var(--v2-color-text-secondary)' }}>
              {t('overview.no_briefing_body')}
            </p>
            <a
              href="/market"
              className="mt-3 inline-flex items-center rounded px-4 py-2 text-sm font-semibold no-underline"
              style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
            >
              {t('overview.go_to_market')}
            </a>
          </div>
        )}
      </div>
    </Layout>
  )
}
