'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import ArticleCard from '@/components/ArticleCard'
import { Article } from '@/lib/domain/article'
function SkeletonCard() {
  return (
    <div className="bg-white border border-surface-variant/30 rounded-2xl p-5 animate-pulse">
      <div className="h-4 bg-surface-variant/40 rounded w-3/4 mb-3" />
      <div className="h-3 bg-surface-variant/20 rounded w-1/2" />
    </div>
  )
}

export default function HistoryPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ limit: '100' })

    fetch(`/api/articles?${params}`)
      .then((r) => r.json() as Promise<{ articles: Article[] }>)
      .then((data) => { if (!cancelled) setArticles(data.articles) })
      .catch((err) => console.error('[history] load error:', err))
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((a) =>
      a.topic.toLowerCase().includes(q)
    )
  }, [articles, search])

  return (
    <Layout>
      <div className="min-w-0 space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-on-background" style={{ fontFamily: 'var(--font-display)' }}>
              Histórico de Conteúdo
            </h1>
          </div>
          <Link href="/generate" className="m3-button-tonal no-underline text-sm py-2 px-4">
            + Novo conteúdo
          </Link>
        </div>

        {/* Search */}
        <div className="w-full">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tema..."
            className="m3-input-outlined w-full h-11"
          />
        </div>

        {/* Feed */}
        {loading ? (
          <div className="flex flex-col gap-3 min-w-0 max-w-full">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="m3-card text-center py-20 px-4">
            <p className="font-semibold text-on-surface m-0">Nada encontrado</p>
            <p className="text-sm text-on-surface-variant mt-1.5 m-0">Tente alterar o termo de busca</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-w-0 max-w-full mx-auto" style={{ maxWidth: 720 }}>
            {filtered.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
