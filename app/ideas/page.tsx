'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import { getErrorMessage } from '@/lib/api/error-message'

type TrendItem = {
  id: string
  title: string | null
  description: string | null
  link: string | null
  published_at: string | null
  collected_at: string
  source?: { name: string } | null
}

export default function IdeasPage() {
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchTrends() {
    try {
      const res = await fetch('/api/market?limit=20', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Не удалось загрузить тренды')
      setTrends(data.items || [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Confirmed false positive for "call an async fetcher from a mount
    // effect"; see https://github.com/facebook/react/issues/34743
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTrends()
  }, [])

  function formatDate(value: string | null): string {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-background">Пульс рынка</h1>
          <p className="mt-1 text-base text-on-surface-variant">Что происходит на выбранном рынке сейчас</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-sm bg-error-container text-on-error-container font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="m3-card p-8 animate-pulse space-y-4">
            <div className="h-4 bg-surface-variant/40 rounded w-1/3 mb-6" />
            <div className="h-4 bg-surface-variant/30 rounded w-full" />
            <div className="h-4 bg-surface-variant/30 rounded w-full" />
            <div className="h-4 bg-surface-variant/30 rounded w-2/3" />
          </div>
        ) : trends.length === 0 ? (
          <div className="m3-card p-8 text-center">
            <p className="text-sm text-on-surface-variant">
              Nenhuma tendência disponível. Vá para <Link href="/market" className="text-primary font-medium">{t('market.title')}</Link> para coletar dados.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {trends.map((item) => (
              <div key={item.id} className="m3-card p-5 shadow-sm relative overflow-hidden">
                <div className="flex flex-wrap gap-2 text-xs font-medium text-on-surface-variant mb-3">
                  {item.source?.name && (
                    <span className="rounded-full bg-primary-container px-2.5 py-1 text-on-primary-container">
                      {item.source.name}
                    </span>
                  )}
                  <span>{formatDate(item.published_at ?? item.collected_at)}</span>
                </div>

                <h3 className="m-0 text-base font-semibold leading-6 text-on-surface mb-2">
                  {item.title ?? 'Без названия'}
                </h3>

                <p className="m-0 text-sm leading-relaxed text-on-surface-variant line-clamp-3">
                  {item.description ?? ''}
                </p>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-surface-variant/30">
                  <Link
                    href={`/generate?topic=${encodeURIComponent(item.title ?? '')}&context=${encodeURIComponent(item.description ?? '')}`}
                    className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 no-underline"
                  >
                    Создать контент
                  </Link>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-surface-container-highest px-4 py-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface no-underline"
                    >
                      Источник
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
