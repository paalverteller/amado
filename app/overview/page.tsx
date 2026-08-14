'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import Layout from '@/components/Layout'

interface EvidenceRef {
  id: string
  source_title: string | null
  source_summary: string | null
  canonical_url: string | null
  published_at: string | null
  hydration_status: string | null
}

interface Opportunity {
  id: string
  rank: number
  why_it_matters: string
  feedback: 'useful' | 'irrelevant' | null
  sent_to_generation_at: string | null
  evidence_item: EvidenceRef | EvidenceRef[] | null
}

interface DimensionItem {
  key: string
  label: string
  sampleSize: number
  score: number | null
  explanation: string
}

interface DashboardData {
  generatedAt: string
  today: { generated: number; published: number; marketSignals: number; briefingItems: number }
  attention: Array<{ severity: 'high' | 'medium' | 'low'; title: string; detail: string; href: string }>
  campaigns: Array<{
    id: string; name: string; objective: string | null; primary_kpi: string | null
    status: string; starts_at: string | null; ends_at: string | null
  }>
  upcoming: Array<{
    id: string; topic: string; content_type: string; status: string; scheduled_for: string
    campaign: { name: string } | { name: string }[] | null
  }>
  recentPerformance: Array<{
    id: string; platform: string; horizon: string; reach: number | null; impressions: number | null
    likes: number | null; comments: number | null; saves: number | null; shares: number | null
    link_clicks: number | null; recorded_at: string
    article: { topic: string; content_type: string } | { topic: string; content_type: string }[] | null
  }>
  opportunities: Opportunity[]
  insights: {
    sampleSize: number
    scoredSampleSize: number
    metricDefinition: string
    dimensions: {
      hooks: DimensionItem[]; themes: DimensionItem[]; pillars: DimensionItem[]; ctas: DimensionItem[]
      lengths: DimensionItem[]; formats: DimensionItem[]; platforms: DimensionItem[]
    }
    fatigue: Array<{ dimension: string; value: string; explanation: string }>
    recommendations: string[]
  }
}

const EMPTY: DashboardData = {
  generatedAt: '',
  today: { generated: 0, published: 0, marketSignals: 0, briefingItems: 0 },
  attention: [], campaigns: [], upcoming: [], recentPerformance: [], opportunities: [],
  insights: {
    sampleSize: 0, scoredSampleSize: 0, metricDefinition: '',
    dimensions: { hooks: [], themes: [], pillars: [], ctas: [], lengths: [], formats: [], platforms: [] },
    fatigue: [], recommendations: [],
  },
}

function first<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function scoreLabel(score: number | null): string {
  return score === null ? 'нет базы' : `${(score * 100).toFixed(2)}%`
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="m3-card p-4 min-w-0">
      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="m-0 mt-2 text-3xl font-bold text-on-surface">{value}</p>
      <p className="m-0 mt-1 text-xs text-on-surface-variant">{detail}</p>
    </div>
  )
}

function SectionTitle({ title, note, href, linkLabel }: { title: string; note?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="m-0 text-lg font-semibold text-on-surface">{title}</h2>
        {note && <p className="m-0 mt-1 text-xs text-on-surface-variant">{note}</p>}
      </div>
      {href && <Link href={href} className="text-xs font-semibold text-primary no-underline">{linkLabel ?? 'Открыть →'}</Link>}
    </div>
  )
}

function DimensionCard({ title, items }: { title: string; items: DimensionItem[] }) {
  return (
    <div className="rounded-2xl border border-surface-variant/30 p-3 min-w-0">
      <p className="m-0 mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">{title}</p>
      {items.length === 0 ? (
        <p className="m-0 text-xs text-on-surface-variant">Недостаточно данных</p>
      ) : items.slice(0, 4).map((item) => (
        <div key={item.key} className="py-2 border-t border-surface-variant/20 first:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-on-surface truncate">{item.label}</span>
            <span className="text-xs font-bold text-primary shrink-0">{scoreLabel(item.score)}</span>
          </div>
          <p className="m-0 mt-1 text-[11px] leading-4 text-on-surface-variant">n={item.sampleSize}. {item.explanation}</p>
        </div>
      ))}
    </div>
  )
}

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [campaignSaving, setCampaignSaving] = useState(false)
  const [campaignForm, setCampaignForm] = useState({ name: '', objective: '', primary_kpi: '', starts_at: '', ends_at: '' })

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await fetch('/api/overview/dashboard', { cache: 'no-store' })
      const body = await response.json() as DashboardData & { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Не удалось загрузить обзор')
      setData(body)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить обзор')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function createCampaign() {
    if (!campaignForm.name.trim()) return
    setCampaignSaving(true)
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campaignForm,
          name: campaignForm.name.trim(),
          status: campaignForm.starts_at && new Date(campaignForm.starts_at) <= new Date() ? 'active' : 'planned',
          starts_at: campaignForm.starts_at ? new Date(campaignForm.starts_at).toISOString() : null,
          ends_at: campaignForm.ends_at ? new Date(campaignForm.ends_at).toISOString() : null,
        }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Не удалось создать кампанию')
      setCampaignForm({ name: '', objective: '', primary_kpi: '', starts_at: '', ends_at: '' })
      setCampaignOpen(false)
      setLoading(true)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось создать кампанию')
    } finally {
      setCampaignSaving(false)
    }
  }

  async function updateFeedback(item: Opportunity, feedback: 'useful' | 'irrelevant') {
    if (item.id.startsWith('evidence-')) return
    const next = item.feedback === feedback ? null : feedback
    setData((current) => ({
      ...current,
      opportunities: current.opportunities.map((candidate) => candidate.id === item.id ? { ...candidate, feedback: next } : candidate),
    }))
    await fetch(`/api/briefing/items/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedback: next }),
    }).catch(() => {})
  }

  async function markSent(item: Opportunity) {
    if (item.id.startsWith('evidence-')) return
    await fetch(`/api/briefing/items/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sentToGeneration: true }),
    }).catch(() => {})
  }

  if (loading) {
    return <Layout><div className="m3-card p-8 animate-pulse text-sm text-on-surface-variant">Собираем рабочий стол маркетолога…</div></Layout>
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-primary">Amado · Control Center</p>
            <h1 className="m-0 mt-1 text-3xl font-bold tracking-tight text-on-surface">Рабочий стол маркетолога</h1>
            <p className="m-0 mt-1 text-sm text-on-surface-variant">Что происходит сегодня, что требует внимания и какие сигналы стоит превратить в контент.</p>
          </div>
          <button onClick={() => { setLoading(true); void load() }} className="m3-button-tonal self-start">Обновить</button>
        </header>

        {error && <div className="rounded-2xl bg-error-container p-4 text-sm text-on-error-container">{error}</div>}

        <section>
          <SectionTitle title="Сегодня" note={data.generatedAt ? `Срез обновлён ${formatDateTime(data.generatedAt)}` : undefined} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Создано" value={data.today.generated} detail="материалов сегодня" />
            <StatCard label="Опубликовано" value={data.today.published} detail="по статусу публикации" />
            <StatCard label="Сигналы рынка" value={data.today.marketSignals} detail="новых evidence items" />
            <StatCard label="В briefing" value={data.today.briefingItems} detail="приоритетных возможностей" />
          </div>
        </section>

        <section>
          <SectionTitle title="Требует внимания" note="Только наблюдаемые сигналы: ошибки, здоровье источников, усталость паттернов и незапланированный контент." />
          <div className="m3-card divide-y divide-surface-variant/30 overflow-hidden">
            {data.attention.length === 0 ? (
              <p className="m-0 p-5 text-sm text-on-surface-variant">Критичных сигналов нет.</p>
            ) : data.attention.map((item, index) => (
              <Link key={`${item.title}-${index}`} href={item.href} className="flex items-start gap-3 p-4 no-underline hover:bg-surface-container-low">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.severity === 'high' ? 'var(--color-error)' : item.severity === 'medium' ? '#F59E0B' : 'var(--color-primary)' }} />
                <span className="min-w-0"><strong className="block text-sm text-on-surface">{item.title}</strong><span className="text-xs text-on-surface-variant">{item.detail}</span></span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><h2 className="m-0 text-lg font-semibold text-on-surface">Активные кампании</h2><p className="m-0 mt-1 text-xs text-on-surface-variant">Экземпляры кампаний, а не reusable campaign profiles.</p></div>
            <button onClick={() => setCampaignOpen((value) => !value)} className="m3-button-tonal text-xs">{campaignOpen ? 'Скрыть' : '+ Кампания'}</button>
          </div>
          {campaignOpen && (
            <div className="m3-card mb-3 grid gap-3 p-4 md:grid-cols-5">
              <input className="m3-input-outlined md:col-span-2" placeholder="Название кампании" value={campaignForm.name} onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="m3-input-outlined" placeholder="Цель" value={campaignForm.objective} onChange={(e) => setCampaignForm((f) => ({ ...f, objective: e.target.value }))} />
              <input className="m3-input-outlined" placeholder="Главный KPI" value={campaignForm.primary_kpi} onChange={(e) => setCampaignForm((f) => ({ ...f, primary_kpi: e.target.value }))} />
              <button className="m3-button-filled" disabled={campaignSaving || !campaignForm.name.trim()} onClick={createCampaign}>{campaignSaving ? 'Создаём…' : 'Создать'}</button>
              <label className="text-xs text-on-surface-variant">Начало<input className="m3-input-outlined mt-1" type="datetime-local" value={campaignForm.starts_at} onChange={(e) => setCampaignForm((f) => ({ ...f, starts_at: e.target.value }))} /></label>
              <label className="text-xs text-on-surface-variant">Окончание<input className="m3-input-outlined mt-1" type="datetime-local" value={campaignForm.ends_at} onChange={(e) => setCampaignForm((f) => ({ ...f, ends_at: e.target.value }))} /></label>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.campaigns.length === 0 ? <div className="m3-card p-5 text-sm text-on-surface-variant">Пока нет активных или запланированных кампаний.</div> : data.campaigns.map((campaign) => (
              <div key={campaign.id} className="m3-card p-4">
                <div className="flex items-start justify-between gap-2"><h3 className="m-0 text-base font-semibold text-on-surface">{campaign.name}</h3><span className="rounded-full bg-primary-container px-2 py-1 text-[10px] font-bold text-on-primary-container">{campaign.status}</span></div>
                {campaign.objective && <p className="m-0 mt-2 text-sm text-on-surface-variant">{campaign.objective}</p>}
                <p className="m-0 mt-3 text-xs text-on-surface-variant">{formatDate(campaign.starts_at)} → {formatDate(campaign.ends_at)}{campaign.primary_kpi ? ` · KPI: ${campaign.primary_kpi}` : ''}</p>
                <Link href={`/generate?campaignId=${encodeURIComponent(campaign.id)}`} className="mt-3 inline-block text-xs font-semibold text-primary no-underline">Создать контент →</Link>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Ближайший контент" note="Материалы с scheduled_for; публикация остаётся ручной/внешней." href="/history" linkLabel="История →" />
          <div className="m3-card overflow-hidden divide-y divide-surface-variant/30">
            {data.upcoming.length === 0 ? <p className="m-0 p-5 text-sm text-on-surface-variant">Нет запланированных материалов.</p> : data.upcoming.map((item) => (
              <Link key={item.id} href={`/history/${item.id}`} className="flex items-center justify-between gap-4 p-4 no-underline hover:bg-surface-container-low">
                <div className="min-w-0"><p className="m-0 truncate text-sm font-semibold text-on-surface">{item.topic}</p><p className="m-0 mt-1 text-xs text-on-surface-variant">{item.content_type}{first(item.campaign)?.name ? ` · ${first(item.campaign)!.name}` : ''}</p></div>
                <span className="shrink-0 text-xs font-semibold text-primary">{formatDateTime(item.scheduled_for)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Последние результаты" note="Последние записанные performance snapshots." href="/history" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.recentPerformance.length === 0 ? <div className="m3-card p-5 text-sm text-on-surface-variant">Показатели ещё не внесены.</div> : data.recentPerformance.map((snapshot) => {
              const article = first(snapshot.article)
              return <div key={snapshot.id} className="m3-card p-4"><p className="m-0 text-xs font-bold uppercase tracking-wide text-primary">{snapshot.platform} · {snapshot.horizon}</p><p className="m-0 mt-2 line-clamp-2 text-sm font-semibold text-on-surface">{article?.topic ?? 'Материал'}</p><p className="m-0 mt-3 text-xs text-on-surface-variant">Охват {snapshot.reach ?? '—'} · реакции {(snapshot.likes ?? 0) + (snapshot.comments ?? 0) + (snapshot.saves ?? 0) + (snapshot.shares ?? 0)} · клики {snapshot.link_clicks ?? 0}</p></div>
            })}
          </div>
        </section>

        <section>
          <SectionTitle title="Возможности рынка" note="Приоритетный briefing; если он ещё не готов — свежие market evidence без конкурентов." href="/market" linkLabel="Весь рынок →" />
          <div className="grid gap-3 md:grid-cols-2">
            {data.opportunities.length === 0 ? <div className="m3-card p-5 text-sm text-on-surface-variant">Сегодня сигналов ещё нет.</div> : data.opportunities.slice(0, 6).map((item) => {
              const evidence = first(item.evidence_item)
              if (!evidence) return null
              const generateHref = `/generate?topic=${encodeURIComponent(evidence.source_title ?? '')}&context=${encodeURIComponent(`${evidence.source_summary ?? ''}\n\nПочему важно: ${item.why_it_matters}`)}&evidenceId=${encodeURIComponent(evidence.id)}`
              return (
                <article key={item.id} className="m3-card flex flex-col p-4">
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant"><span className="rounded-full bg-primary-container px-2 py-1 font-bold text-on-primary-container">#{item.rank}</span><span>{formatDate(evidence.published_at)}</span></div>
                  <h3 className="m-0 mt-3 text-base font-semibold leading-6 text-on-surface">{evidence.source_title ?? 'Без заголовка'}</h3>
                  <p className="m-0 mt-2 text-sm leading-6 text-on-surface-variant">{item.why_it_matters}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={generateHref} onClick={() => { void markSent(item) }} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary no-underline">В генерацию</Link>
                    {!item.id.startsWith('evidence-') && <><button onClick={() => { void updateFeedback(item, 'useful') }} className="rounded-full border border-surface-variant bg-transparent px-3 py-1.5 text-xs">{item.feedback === 'useful' ? '✓ Полезно' : 'Полезно'}</button><button onClick={() => { void updateFeedback(item, 'irrelevant') }} className="rounded-full border border-surface-variant bg-transparent px-3 py-1.5 text-xs">{item.feedback === 'irrelevant' ? '✓ Неактуально' : 'Неактуально'}</button></>}
                    {evidence.canonical_url && <a href={evidence.canonical_url} target="_blank" rel="noreferrer" className="rounded-full border border-surface-variant px-3 py-1.5 text-xs text-on-surface-variant no-underline">Источник</a>}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section id="content-intelligence" className="scroll-mt-6">
          <SectionTitle title="Content intelligence" note={`${data.insights.sampleSize} публикац. в выборке · ${data.insights.scoredSampleSize} с reach/impressions. Аналитика объяснимая, не причинная.`} />
          <div className="m3-card p-4">
            <p className="m-0 mb-4 rounded-xl bg-surface-container-low p-3 text-xs leading-5 text-on-surface-variant">{data.insights.metricDefinition}</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DimensionCard title="Hooks" items={data.insights.dimensions.hooks} />
              <DimensionCard title="Темы" items={data.insights.dimensions.themes} />
              <DimensionCard title="Content pillars" items={data.insights.dimensions.pillars} />
              <DimensionCard title="CTA" items={data.insights.dimensions.ctas} />
              <DimensionCard title="Длина" items={data.insights.dimensions.lengths} />
              <DimensionCard title="Форматы" items={data.insights.dimensions.formats} />
              <DimensionCard title="Площадки" items={data.insights.dimensions.platforms} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div><h3 className="m-0 text-sm font-semibold text-on-surface">Fatigue detection</h3>{data.insights.fatigue.length === 0 ? <p className="mt-2 text-xs text-on-surface-variant">Выраженного повторения в последних публикациях не обнаружено.</p> : <ul className="mt-2 space-y-2 pl-5 text-xs leading-5 text-on-surface-variant">{data.insights.fatigue.map((finding, i) => <li key={`${finding.dimension}-${i}`}>{finding.explanation}</li>)}</ul>}</div>
              <div><h3 className="m-0 text-sm font-semibold text-on-surface">Рекомендации</h3>{data.insights.recommendations.length === 0 ? <p className="mt-2 text-xs text-on-surface-variant">Пока недостаточно данных для рекомендаций.</p> : <ul className="mt-2 space-y-2 pl-5 text-xs leading-5 text-on-surface-variant">{data.insights.recommendations.map((recommendation, i) => <li key={i}>{recommendation}</li>)}</ul>}</div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}
