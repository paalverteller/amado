/* eslint-disable react-hooks/set-state-in-effect -- guard-clause reset-and-return
 * on an unready/invalid market is a confirmed false positive, not a
 * cascading-render bug: see https://github.com/facebook/react/issues/34743
 * and docs/AMADO_ROADMAP.md item 0. */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { useMarket } from '@/lib/market-context'

type BaseItem = {
  id: string
  title: string | null
  description: string | null
  link: string | null
  collected_at: string | null
  published_at: string | null
  source: { name?: string | null; country?: string | null; source_type?: string | null } | null
}

function formatDate(value: string | null): string {
  if (!value) return 'sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'sem data'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MarketBasePage() {
  const { currentRegion, ready: marketReady, error: marketError } = useMarket()
  const currentRegionId = currentRegion?.id ?? null
  const [items, setItems] = useState<BaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!marketReady || !currentRegionId) {
      setItems([])
      setLoading(true)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/market/base?region_id=${encodeURIComponent(currentRegionId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({})) as { items?: BaseItem[]; error?: string }
        if (!r.ok) throw new Error(d.error ?? 'Не удалось загрузить базу рынка')
        return d
      })
      .then((d) => setItems(d.items ?? []))
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить базу рынка')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [currentRegionId, marketReady])

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 overflow-hidden">
        <div className="m3-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="m3-label text-primary">База рынка</p>
              <h1 className="m-0 mt-2 text-3xl font-semibold tracking-tight text-on-surface">
                50 últimos materiais coletados
              </h1>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Esta é a camada bruta da base: RSS, PubMed e HTML parsing. Registros antigos são automaticamente removidos após novas coletas.
              </p>
            </div>
            <Link href="/market" className="rounded-full bg-surface-container-highest px-4 py-2 text-sm font-semibold text-primary">
              Вернуться к анализу
            </Link>
          </div>
        </div>

        {(error || marketError) && (
          <div className="m3-card p-5">
            <p className="text-sm text-error">{error || marketError}</p>
          </div>
        )}

        {(loading || !marketReady) && !error && !marketError ? (
          <div className="m3-card p-6 text-sm text-on-surface-variant">Загрузка…</div>
        ) : null}

        {!loading && marketReady && items.length === 0 && !error && !marketError ? (
          <div className="m3-card p-6 text-center">
            <p className="text-sm text-on-surface-variant">
              Материалов для выбранного рынка пока нет.
            </p>
          </div>
        ) : null}

        <div className="grid min-w-0 grid-cols-1 gap-4">
          {items.map((item) => (
            <article key={item.id} className="m3-card min-w-0 overflow-hidden p-5">
              <div className="flex flex-wrap gap-2 text-xs font-medium text-on-surface-variant">
                <span className="rounded-full bg-secondary-container px-2.5 py-1 text-on-secondary-container">
                  {item.source?.country ?? 'Mundo'}
                </span>
                <span>{item.source?.name ?? 'Источник'}</span>
                <span>{formatDate(item.published_at ?? item.collected_at)}</span>
              </div>

              <h2 className="mt-3 break-words text-lg font-semibold text-on-surface [overflow-wrap:anywhere]">
                {item.title || 'Sem título'}
              </h2>
              <p className="mt-2 line-clamp-4 break-words text-sm leading-6 text-on-surface-variant [overflow-wrap:anywhere]">
                {item.description || 'Sem descrição'}
              </p>

              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                  Открыть источник
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </Layout>
  )
}
