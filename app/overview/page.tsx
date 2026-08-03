'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import { formatRelativeTime } from '@/lib/locale'

// Phase 1 shell: shows real freshness data from the existing /api/market
// feed. The actual AI-generated briefing (Phase 5) replaces the empty
// state below once the scheduled summarization workflow exists.

type MarketItem = {
  id: string
  title_ru?: string | null
  title?: string | null
  collected_at: string | null
  published_at: string | null
}

export default function OverviewPage() {
  const [latest, setLatest] = useState<MarketItem | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/market')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('request failed'))))
      .then((data: { items?: MarketItem[] }) => {
        if (cancelled) return
        setLatest(data.items?.[0] ?? null)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const freshnessDate = latest?.collected_at ?? latest?.published_at ?? null

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
              background: loadState === 'ready' && freshnessDate ? 'var(--v2-color-success)' : 'var(--v2-color-warning)',
            }}
          />
          {t('overview.freshness_label')}:{' '}
          <strong style={{ color: 'var(--v2-color-text-primary)' }}>
            {loadState === 'loading'
              ? '…'
              : freshnessDate
                ? formatRelativeTime(freshnessDate)
                : t('market.no_items')}
          </strong>
        </div>

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
          <Link
            href="/market"
            className="mt-3 inline-flex items-center rounded px-4 py-2 text-sm font-semibold no-underline"
            style={{ background: 'var(--v2-color-brand-primary)', color: '#fff' }}
          >
            {t('overview.go_to_market')}
          </Link>
        </div>
      </div>
    </Layout>
  )
}
