import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'
import { loadMarketingInsights, resolveDefaultBrandId } from '@/lib/marketing-analytics'

export const dynamic = 'force-dynamic'

function first<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function saoPauloTodayStart(): string {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  // Brazil has not observed DST since 2019; product timezone is America/Sao_Paulo.
  return `${date}T03:00:00.000Z`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = getSupabaseAdmin()
    const brandId = await resolveDefaultBrandId(request.nextUrl.searchParams.get('brand_id'))
    const todayStart = saoPauloTodayStart()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const staleCompetitorBefore = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()

    let campaignQuery = admin
      .from('marketing_campaigns')
      .select('id, name, objective, primary_kpi, status, starts_at, ends_at, created_at')
      .in('status', ['planned', 'active', 'paused'])
      .order('starts_at', { ascending: false, nullsFirst: false })
      .limit(8)
    let upcomingQuery = admin
      .from('articles')
      .select('id, topic, content_type, status, scheduled_for, marketing_campaign_id, campaign:marketing_campaign_id(name)')
      .not('scheduled_for', 'is', null)
      .gte('scheduled_for', new Date().toISOString())
      .neq('status', 'published')
      .order('scheduled_for', { ascending: true })
      .limit(8)
    let performanceQuery = admin
      .from('performance_snapshots')
      .select('id, article_id, platform, horizon, reach, impressions, likes, comments, saves, shares, link_clicks, recorded_at, article:article_id(topic, content_type)')
      .not('article_id', 'is', null)
      .order('recorded_at', { ascending: false })
      .limit(8)
    let unscheduledQuery = admin
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .in('status', ['draft', 'reviewed'])
      .is('scheduled_for', null)
    let failedRequestsQuery = admin
      .from('content_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', sevenDaysAgo)
    let generatedTodayQuery = admin
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart)
    let publishedTodayQuery = admin
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', todayStart)
    let staleCompetitorsQuery = admin
      .from('competitors')
      .select('id, name, last_reviewed_at')
      .eq('status', 'active')
      .or(`last_reviewed_at.is.null,last_reviewed_at.lt.${staleCompetitorBefore}`)
      .limit(10)

    if (brandId) {
      campaignQuery = campaignQuery.eq('brand_id', brandId)
      upcomingQuery = upcomingQuery.eq('brand_profile_id', brandId)
      performanceQuery = performanceQuery.eq('brand_id', brandId)
      unscheduledQuery = unscheduledQuery.eq('brand_profile_id', brandId)
      failedRequestsQuery = failedRequestsQuery.eq('brand_profile_id', brandId)
      generatedTodayQuery = generatedTodayQuery.eq('brand_profile_id', brandId)
      publishedTodayQuery = publishedTodayQuery.eq('brand_profile_id', brandId)
      staleCompetitorsQuery = staleCompetitorsQuery.eq('brand_id', brandId)
    }

    const [
      briefingRunResult,
      campaignsResult,
      upcomingResult,
      performanceResult,
      unhealthyResult,
      failedRequestsResult,
      unscheduledResult,
      generatedTodayResult,
      publishedTodayResult,
      evidenceTodayResult,
      staleCompetitorsResult,
      insights,
    ] = await Promise.all([
      admin.from('briefing_runs').select('id, run_date, status, items_count, created_at, completed_at').order('run_date', { ascending: false }).limit(1).maybeSingle(),
      campaignQuery,
      upcomingQuery,
      performanceQuery,
      admin.from('rss_sources').select('id, name, health_status, consecutive_failures').eq('active', true).in('health_status', ['degraded', 'unhealthy']).order('consecutive_failures', { ascending: false }).limit(10),
      failedRequestsQuery,
      unscheduledQuery,
      generatedTodayQuery,
      publishedTodayQuery,
      admin.from('evidence_items').select('id', { count: 'exact', head: true }).gte('discovered_at', todayStart),
      staleCompetitorsQuery,
      loadMarketingInsights(brandId),
    ])

    const errors = [
      briefingRunResult.error, campaignsResult.error, upcomingResult.error, performanceResult.error,
      unhealthyResult.error, failedRequestsResult.error, unscheduledResult.error,
      generatedTodayResult.error, publishedTodayResult.error, evidenceTodayResult.error,
      staleCompetitorsResult.error,
    ].filter(Boolean)
    if (errors.length) throw new Error(errors[0]!.message)

    const run = briefingRunResult.data
    let briefingItems: unknown[] = []
    if (run?.status === 'ready') {
      const { data, error } = await admin
        .from('briefing_items')
        .select(`
          id, rank, why_it_matters, feedback, sent_to_generation_at,
          evidence_item:evidence_item_id (
            id, source_title, source_summary, canonical_url, published_at, hydration_status
          )
        `)
        .eq('run_id', run.id)
        .order('rank', { ascending: true })
      if (error) throw new Error(error.message)
      briefingItems = data ?? []
    }

    // Fallback opportunities when the briefing has not run yet: recent
    // general-market evidence only, never competitor-tagged sources.
    let opportunities = briefingItems
    if (opportunities.length === 0) {
      const { data, error } = await admin
        .from('evidence_items')
        .select('id, source_title, source_summary, canonical_url, published_at, hydration_status, source:source_id(name, source_category)')
        .order('discovered_at', { ascending: false })
        .limit(30)
      if (error) throw new Error(error.message)
      opportunities = (data ?? [])
        .filter((row) => first(row.source)?.source_category !== 'competitor')
        .slice(0, 6)
        .map((row, index) => ({
          id: `evidence-${row.id}`,
          rank: index + 1,
          why_it_matters: 'Свежий сигнал рынка. Briefing ещё не добавил объяснение — откройте источник или отправьте сигнал в генерацию.',
          feedback: null,
          sent_to_generation_at: null,
          evidence_item: {
            id: row.id,
            source_title: row.source_title,
            source_summary: row.source_summary,
            canonical_url: row.canonical_url,
            published_at: row.published_at,
            hydration_status: row.hydration_status,
          },
        }))
    }

    const attention: Array<{ severity: 'high' | 'medium' | 'low'; title: string; detail: string; href: string }> = []
    if ((unhealthyResult.data ?? []).length) {
      const names = (unhealthyResult.data ?? []).slice(0, 3).map((s) => s.name).join(', ')
      attention.push({ severity: 'high', title: 'Источники требуют внимания', detail: `${unhealthyResult.data!.length} источн. degraded/unhealthy: ${names}`, href: '/settings' })
    }
    if ((failedRequestsResult.count ?? 0) > 0) {
      attention.push({ severity: 'high', title: 'Ошибки генерации', detail: `${failedRequestsResult.count} неуспешных запросов за 7 дней`, href: '/history' })
    }
    if ((staleCompetitorsResult.data ?? []).length) {
      attention.push({ severity: 'medium', title: 'Обзоры конкурентов устарели', detail: `${staleCompetitorsResult.data!.length} активных конкурентов без обзора за 21 день`, href: '/competitors' })
    }
    if ((unscheduledResult.count ?? 0) > 0) {
      attention.push({ severity: 'low', title: 'Контент без даты', detail: `${unscheduledResult.count} материалов в draft/review не запланированы`, href: '/history' })
    }
    if (insights.fatigue.length) {
      attention.push({ severity: 'medium', title: 'Обнаружена усталость паттернов', detail: insights.fatigue[0].explanation, href: '#content-intelligence' })
    }

    return NextResponse.json({
      brandId,
      generatedAt: new Date().toISOString(),
      today: {
        generated: generatedTodayResult.count ?? 0,
        published: publishedTodayResult.count ?? 0,
        marketSignals: evidenceTodayResult.count ?? 0,
        briefingItems: run?.status === 'ready' ? (run.items_count ?? briefingItems.length) : 0,
      },
      briefing: { run: run ?? null, items: briefingItems },
      attention,
      campaigns: campaignsResult.data ?? [],
      upcoming: upcomingResult.data ?? [],
      recentPerformance: performanceResult.data ?? [],
      opportunities,
      insights,
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
