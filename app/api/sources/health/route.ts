import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    // Aggregate health by source
    const { data: healthData, error: healthError } = await getSupabaseAdmin()
      .from('source_health_events')
      .select('source_id, event_type, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (healthError) {
      return NextResponse.json({ error: healthError.message }, { status: 500 })
    }

    // Get source metadata
    const { data: sources, error: sourcesError } = await getSupabaseAdmin()
      .from('rss_sources')
      .select('id, name, url, source_type, active, health_status, consecutive_failures, last_success_at, last_failure_at, items_count, country, source_category')
      .order('name', { ascending: true })

    if (sourcesError) {
      return NextResponse.json({ error: sourcesError.message }, { status: 500 })
    }

    // Calculate 24h stats per source
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000

    const sourceStats = (sources ?? []).map(source => {
      const sourceEvents = (healthData ?? []).filter(e => e.source_id === source.id)
      const recentEvents = sourceEvents.filter(e => new Date(e.created_at).getTime() > dayAgo)
      
      const success24h = recentEvents.filter(e => e.event_type === 'success').length
      const failure24h = recentEvents.filter(e => e.event_type === 'failure').length
      const total24h = success24h + failure24h
      
      return {
        id: source.id,
        name: source.name,
        url: source.url,
        connectorType: source.source_type,
        active: source.active,
        category: source.source_category,
        country: source.country,
        health: {
          status: source.health_status ?? 'unknown',
          consecutiveFailures: source.consecutive_failures ?? 0,
          lastSuccess: source.last_success_at,
          lastFailure: source.last_failure_at,
          successRate24h: total24h > 0 ? Math.round((success24h / total24h) * 100) : null,
          events24h: total24h,
        },
        itemsCount: source.items_count ?? 0,
      }
    })

    // Global stats
    const totalSources = sourceStats.length
    const healthySources = sourceStats.filter(s => s.health.status === 'healthy').length
    const unhealthySources = sourceStats.filter(s => s.health.status === 'unhealthy').length
    const inactiveSources = sourceStats.filter(s => !s.active).length

    return NextResponse.json({
      sources: sourceStats,
      summary: {
        total: totalSources,
        healthy: healthySources,
        unhealthy: unhealthySources,
        inactive: inactiveSources,
        activeRate: totalSources > 0 ? Math.round(((totalSources - inactiveSources) / totalSources) * 100) : 0,
        healthRate: totalSources > 0 ? Math.round((healthySources / totalSources) * 100) : 0,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
