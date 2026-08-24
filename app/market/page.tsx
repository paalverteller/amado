'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PromptTemplate } from '@/lib/domain/prompt-template'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { t } from '@/lib/i18n/config'
import { useMarket } from '@/lib/market-context'
import type { CompetitorSummary } from '@/lib/domain/competitor'

// ─── Types ────────────────────────────────────────────────────────────────────

type Source = {
  name?: string | null
  url?: string | null
  country?: string | null
  source_type?: string | null
}

 type MarketItem = {
   id: string
   title: string | null
   description: string | null
   link: string | null
   published_at: string | null
   collected_at: string | null
   source: Source | null
 }

 type MarketMeta = {
   total?: number
   minVisibleItems?: number
   maxTotal?: number
   maxPerSource?: number
   hasEnoughItems?: boolean
   countries?: Record<string, number>
 }

 // ─── Constants ────────────────────────────────────────────────────────────────

 const LOADING_PHRASES = [
   'Coletando dados…',
   'Analisando o mercado…',
   'Lendo a imprensa…',
   'Verificando fontes…',
   'Processando materiais recentes…',
   'Coletando contexto para conteúdo futuro…',
 ]

 // ─── Helpers ──────────────────────────────────────────────────────────────────

 function formatDate(value: string | null): string {
   if (!value) return 'data não informada'
   const date = new Date(value)
   if (Number.isNaN(date.getTime())) return 'data não informada'
   return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
 }

function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  return { selectedIds, toggleSelect, clearSelection }
}

function buildGenerationTopic(item: MarketItem): string {
  const sourceName = item.source?.name ? `Fonte: ${item.source.name}. ` : ''
  const summary = item.description ? ` Contexto: ${item.description.slice(0, 360)}` : ''
  return `${sourceName}${item.title ?? ''}.${summary}`.replace(/\s+/g, ' ').trim()
}

// Clean, short title for display purposes (History feed, article topic column)
function buildDisplayTitle(item: MarketItem): string {
  return (item.title ?? '').replace(/\s+/g, ' ').trim()
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function fetchMarketItems(regionId?: string | null): Promise<{ items: MarketItem[]; meta: MarketMeta }> {
  const url = regionId ? `/api/market?region_id=${encodeURIComponent(regionId)}` : '/api/market'
  const res  = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? 'Não foi possível carregar a análise de mercado')
  return { items: Array.isArray(data.items) ? data.items : [], meta: data.meta ?? {} }
}

async function refreshMarketItems(regionId?: string | null): Promise<{ items: MarketItem[]; meta: MarketMeta }> {
  const refreshRes  = await fetch('/api/market/refresh', { method: 'POST', cache: 'no-store' })
  const refreshData = await refreshRes.json().catch(() => ({}))
  if (!refreshRes.ok) throw new Error(refreshData?.error ?? 'Não foi possível coletar dados recentes')
  return fetchMarketItems(regionId)
}

async function fetchCompetitorSummaries(regionId?: string | null): Promise<CompetitorSummary[]> {
  const url = regionId ? `/api/competitors/summary?region_id=${encodeURIComponent(regionId)}` : '/api/competitors/summary'
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json().catch(() => ({}))
  return Array.isArray(data.competitors) ? data.competitors : []
}

function formatReviewDate(value: string | null): string {
  if (!value) return 'ещё нет обзора'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'ещё нет обзора'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const { selectedIds, toggleSelect, clearSelection } = useBatchSelection()
  const router = useRouter()
  const { regions, marketCode } = useMarket()
  const currentRegionId = regions.find((r) => r.code === marketCode)?.id ?? null
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchContentType, setBatchContentType] = useState('linkedin_post')
  const [batchTemplateId, setBatchTemplateId] = useState('')
  const [batchTemplates, setBatchTemplates] = useState<PromptTemplate[]>([])

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json() as Promise<{ templates: PromptTemplate[] }>)
      .then(d => setBatchTemplates(d.templates ?? []))
      .catch(() => {})
  }, [])

  const [items, setItems]               = useState<MarketItem[]>([])
  const [meta, setMeta]                 = useState<MarketMeta>({})
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [phraseIndex, setPhraseIndex]   = useState(0)
  const [error, setError]               = useState<string | null>(null)
  const [competitors, setCompetitors]   = useState<CompetitorSummary[]>([])
  const [competitorsLoading, setCompetitorsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setInitialLoading(true)
      clearSelection()
      try {
        const result = await fetchMarketItems(currentRegionId)
        if (!cancelled) { setItems(result.items); setMeta(result.meta); setError(null) }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados')
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [currentRegionId])

  useEffect(() => {
    let cancelled = false
    setCompetitorsLoading(true)
    fetchCompetitorSummaries(currentRegionId)
      .then((result) => { if (!cancelled) setCompetitors(result) })
      .finally(() => { if (!cancelled) setCompetitorsLoading(false) })
    return () => { cancelled = true }
  }, [currentRegionId])

  useEffect(() => {
    if (!refreshing) return
    const timer = window.setInterval(
      () => setPhraseIndex((c) => (c + 1) % LOADING_PHRASES.length),
      9000,
    )
    return () => window.clearInterval(timer)
  }, [refreshing])

  const countrySummary = useMemo(() => {
    const countries = meta.countries ?? {}
    return Object.entries(countries)
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([country, count]) => `${country}: ${count}`)
      .join(' · ')
  }, [meta.countries])

  async function handleRefresh() {
    setRefreshing(true)
    setPhraseIndex(0)
    setError(null)
    try {
      const result = await refreshMarketItems(currentRegionId)
      setItems(result.items)
      setMeta(result.meta)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível coletar dados')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/market/analysis" className="aug-button aug-button--growth">Глубокий анализ · 60 дней</Link>
      </div>
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 overflow-hidden">

        {/* ── Header card ── */}
        <section className="m3-card overflow-hidden p-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="m3-label text-primary">{t('market.title')}</p>
              <h1 className="m-0 mt-2 text-3xl font-semibold tracking-tight text-on-surface sm:text-4xl">
                Tendências e Sinais
              </h1>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4 lg:mt-0">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Coletar materiais recentes"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? (
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 animate-spin">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                ) : (
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                )}
              </button>
              <Link
                href="/market/base"
                title="Base de materiais"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-primary transition-colors hover:bg-primary-container"
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="mt-5 flex min-w-0 flex-col gap-2 rounded-3xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant lg:flex-row lg:items-center lg:justify-between">
            <span className="min-w-0 break-words">
              Fontes internacionais: <strong className="text-on-surface">{items.length}</strong> materiais
              {typeof meta.total === 'number' && meta.total !== items.length
                ? <> · exibidos: <strong className="text-on-surface">{meta.total}</strong></>
                : null}
            </span>
            {countrySummary ? (
              <span className="min-w-0 break-words">{countrySummary}</span>
            ) : null}
          </div>
        </section>

        {/* ── Competitor intelligence summary ── */}
        {(competitorsLoading || competitors.length > 0) && (
          <section className="m3-card overflow-hidden p-5 sm:p-6">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <p className="m3-label text-primary">{t('market.competitors')}</p>
              <Link
                href="/competitors"
                className="shrink-0 text-xs font-semibold text-primary hover:opacity-80"
              >
                Все конкуренты →
              </Link>
            </div>

            {competitorsLoading ? (
              <p className="mt-3 text-sm text-on-surface-variant">Загрузка…</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {competitors.map((c) => (
                  <Link
                    key={c.id}
                    href="/competitors"
                    className="flex min-w-0 flex-col gap-2 rounded-2xl border border-transparent bg-surface-container p-4 transition-colors hover:border-primary/20 hover:bg-primary-container/40"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <h3 className="m-0 min-w-0 truncate text-sm font-semibold text-on-surface">
                        {c.name}
                      </h3>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          background: c.sourceCount > 0 && c.healthySourceCount === c.sourceCount
                            ? 'var(--aug-success-bg)' : c.sourceCount === 0
                              ? 'var(--aug-neutral-bg)' : 'var(--aug-warning-bg)',
                          color: c.sourceCount > 0 && c.healthySourceCount === c.sourceCount
                            ? 'var(--aug-success-fg)' : c.sourceCount === 0
                              ? 'var(--aug-neutral-fg)' : 'var(--aug-warning-fg)',
                        }}
                      >
                        {c.sourceCount === 0 ? 'нет источников' : `${c.healthySourceCount}/${c.sourceCount} источ.`}
                      </span>
                    </div>

                    {c.latestReview ? (
                      <p className="m-0 line-clamp-3 break-words text-xs leading-5 text-on-surface-variant [overflow-wrap:anywhere]">
                        {c.latestReview.snippet}
                      </p>
                    ) : (
                      <p className="m-0 text-xs text-on-surface-variant">
                        Обзор ещё не сгенерирован
                      </p>
                    )}

                    <span className="mt-auto text-[11px] font-medium text-on-surface-variant">
                      Обновлено: {formatReviewDate(c.lastReviewedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── International sources grid ── */}
        {error && (
          <div className="m3-card p-5">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {refreshing && (
          <div className="m3-card p-5 text-center">
            <p className="text-sm text-on-surface-variant">{LOADING_PHRASES[phraseIndex]}</p>
          </div>
        )}

          {!initialLoading && !refreshing && items.length === 0 && !error && (
            <div className="m3-card p-6 text-center">
              <p className="text-sm text-on-surface-variant">
                Nenhum material salvo. Clique em 🔄 para coletar recentes.
              </p>
            </div>
          )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <article
                key={item.id}
                className="m3-card flex min-w-0 flex-col gap-3 overflow-hidden p-5 relative"
                style={selectedIds.has(item.id) ? { borderColor: '#6E5CF6', boxShadow: '0 0 0 2px rgba(110,92,246,0.25)' } : undefined}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(item.id)}
                  aria-label="Selecionar para geração em lote"
                  style={{
                    position: 'absolute', top: 12, right: 12, zIndex: 1,
                    width: 24, height: 24, borderRadius: 8,
                    border: selectedIds.has(item.id) ? 'none' : '1.5px solid rgba(110,92,246,0.3)',
                    background: selectedIds.has(item.id) ? '#6E5CF6' : 'rgba(255,255,255,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 150ms ease',
                  }}
                >
                  {selectedIds.has(item.id) && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <div className="flex flex-wrap gap-2 text-xs font-medium text-on-surface-variant">
                  {item.source?.country && (
                    <span className="rounded-full bg-secondary-container px-2.5 py-1 text-on-secondary-container">
                      {item.source.country}
                    </span>
                  )}
                  {item.source?.name && <span>{item.source.name}</span>}
                  <span>{formatDate(item.published_at ?? item.collected_at)}</span>
                </div>

                <h2 className="m-0 break-words text-base font-semibold leading-6 text-on-surface [overflow-wrap:anywhere]">
                  {item.title}
                </h2>
                <p className="m-0 line-clamp-3 break-words text-sm leading-6 text-on-surface-variant [overflow-wrap:anywhere]">
                  {item.description}
                </p>

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/generate?topic=${encodeURIComponent(buildDisplayTitle(item))}&context=${encodeURIComponent(buildGenerationTopic(item))}&evidenceId=${encodeURIComponent(item.id)}`}
                    className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
                  >
                    Gerar
                  </Link>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-surface-container-highest px-4 py-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      Fonte
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── Floating Batch Action Bar ── */}
        {selectedIds.size > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: 'calc(72px + env(safe-area-inset-bottom))',
              left: '0.75rem',
              right: '0.75rem',
              maxWidth: 480,
              margin: '0 auto',
              zIndex: 50,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 20,
              background: 'rgba(29,58,138,0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px rgba(15,23,42,0.35)',
              color: '#fff',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Selecionados: {selectedIds.size}
            </span>

            <select
              value={batchContentType}
              onChange={(e) => setBatchContentType(e.target.value)}
              style={{
                fontSize: 11.5, fontWeight: 600, color: '#fff',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '0.3rem 0.4rem',
                cursor: 'pointer', appearance: 'none',
                minWidth: 0, maxWidth: 92, flexShrink: 1,
              }}
            >
              <option value="article" style={{ color: '#000' }}>{t('format.article')}</option>
              <option value="quick_note" style={{ color: '#000' }}>{t('format.quick_note')}</option>
              <option value="linkedin_post" style={{ color: '#000' }}>{t('format.linkedin_post')}</option>
              <option value="instagram_caption" style={{ color: '#000' }}>{t('format.instagram_caption')}</option>
              <option value="instagram_carousel" style={{ color: '#000' }}>{t('format.instagram_carousel')}</option>
              <option value="x_thread" style={{ color: '#000' }}>{t('format.x_thread')}</option>
              <option value="facebook_post" style={{ color: '#000' }}>{t('format.facebook_post')}</option>
              <option value="telegram_post" style={{ color: '#000' }}>{t('format.telegram_post')}</option>
              <option value="short_video_script" style={{ color: '#000' }}>{t('format.short_video_script')}</option>
            </select>

            <select
              value={batchTemplateId}
              onChange={(e) => setBatchTemplateId(e.target.value)}
              style={{
                fontSize: 11.5, fontWeight: 600, color: '#fff',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '0.3rem 0.4rem',
                cursor: 'pointer', appearance: 'none',
                minWidth: 0, maxWidth: 100, flexShrink: 1,
              }}
            >
              <option value="" style={{ color: '#000' }}>{t('generate.template')}...</option>
              {batchTemplates.map(t => (
                <option key={t.id} value={t.id} style={{ color: '#000' }}>{t.name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearSelection}
              style={{
                fontSize: 11.5, color: 'rgba(255,255,255,0.6)',
                background: 'none', border: 'none', cursor: 'pointer',
                flexShrink: 0, padding: '0.2rem',
              }}
            >
              Limpar
            </button>
            <button
              type="button"
              disabled={batchLoading || selectedIds.size > 10}
              onClick={async () => {
                setBatchLoading(true)
                try {
                  const selectedItems = items.filter(i => selectedIds.has(i.id))
                  const topics = selectedItems.map(i => ({
                    title: buildDisplayTitle(i),
                    context: buildGenerationTopic(i),
                    contentType: batchContentType,
                    evidenceItemId: i.id,
                  }))
                  const res = await fetch('/api/generate/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topics, templateId: batchTemplateId || undefined }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error ?? 'Erro na geração em lote')
                  clearSelection()
                  router.push('/history')
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Erro na geração em lote')
                } finally {
                  setBatchLoading(false)
                }
              }}
              style={{
                fontSize: 12.5, fontWeight: 700,
                padding: '0.5rem 1rem', borderRadius: 999,
                background: selectedIds.size > 10 ? 'rgba(255,255,255,0.2)' : '#6E5CF6',
                color: '#fff', border: 'none',
                cursor: batchLoading || selectedIds.size > 10 ? 'not-allowed' : 'pointer',
                opacity: batchLoading ? 0.6 : 1,
                whiteSpace: 'nowrap',
                flexBasis: '100%',
                order: 5,
              }}
            >
              {batchLoading
                ? 'Gerando...'
                : selectedIds.size > 10
                  ? 'Máximo 10'
                  : `Gerar (${selectedIds.size})`}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}