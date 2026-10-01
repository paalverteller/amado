import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

// Trailing window for yield/freshness/extraction/duplicate metrics. Sources
// with no evidence in this window are "stale" for observability purposes,
// even if rss_sources.health_status still reports the last fetch as healthy.
const WINDOW_DAYS = 30
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000
// Re-fetch detection tolerance: saveEvidence() always bumps updated_at on
// every touch (see lib/evidence.ts), including the initial insert. Only
// count it as "seen again" (a same-URL re-fetch) once updated_at trails
// created_at by more than this, which absorbs same-request timing noise.
const REFETCH_TOLERANCE_MS = 60_000

type SourceRow = {
  id: string
  name: string
  url: string
  source_type: string | null
  active: boolean
  region_id: string | null
  country: string | null
  source_category: string | null
  health_status: string | null
  consecutive_failures: number | null
  last_success_at: string | null
  last_failure_at: string | null
}

type EvidenceRow = {
  source_id: string
  content_fingerprint: string | null
  hydration_status: string | null
  discovered_at: string
  created_at: string
  updated_at: string
}

type RegionRow = {
  id: string
  code: string
  name: string
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const regionId = request.nextUrl.searchParams.get('region_id')

    const [{ data: sources, error: sourcesError }, { data: regions, error: regionsError }] = await Promise.all([
      getSupabaseAdmin()
        .from('rss_sources')
        .select('id, name, url, source_type, active, region_id, country, source_category, health_status, consecutive_failures, last_success_at, last_failure_at')
        .order('name', { ascending: true }),
      getSupabaseAdmin()
        .from('regions')
        .select('id, code, name')
        .eq('active', true),
    ])

    if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })
    if (regionsError) return NextResponse.json({ error: regionsError.message }, { status: 500 })

    const allSources = (sources ?? []) as SourceRow[]
    const scopedSources = regionId
      ? allSources.filter((s) => !s.region_id || s.region_id === regionId)
      : allSources

    if (scopedSources.length === 0) {
      const emptyCoverageRegions = regionId
        ? (regions ?? []).filter((r: RegionRow) => r.id === regionId)
        : (regions ?? [])
      return NextResponse.json({
        sources: [],
        regionCoverage: emptyCoverageRegions.map((r: RegionRow) => ({
          regionId: r.id, code: r.code, name: r.name,
          totalSources: 0, activeSources: 0, healthySources: 0, evidenceYield30d: 0,
        })),
        windowDays: WINDOW_DAYS,
        generatedAt: new Date().toISOString(),
      })
    }

    const sourceIds = scopedSources.map((s) => s.id)
    const windowStartIso = new Date(Date.now() - WINDOW_MS).toISOString()

    const { data: evidenceRows, error: evidenceError } = await getSupabaseAdmin()
      .from('evidence_items')
      .select('source_id, content_fingerprint, hydration_status, discovered_at, created_at, updated_at')
      .in('source_id', sourceIds)
      .gte('discovered_at', windowStartIso)

    if (evidenceError) return NextResponse.json({ error: evidenceError.message }, { status: 500 })

    const evidenceBySource = new Map<string, EvidenceRow[]>()
    for (const row of (evidenceRows ?? []) as EvidenceRow[]) {
      const list = evidenceBySource.get(row.source_id) ?? []
      list.push(row)
      evidenceBySource.set(row.source_id, list)
    }

    const sourceStats = scopedSources.map((source) => {
      const rows = evidenceBySource.get(source.id) ?? []
      const yieldCount = rows.length

      const mostRecent = rows.reduce<string | null>((latest, row) => {
        if (!latest || row.discovered_at > latest) return row.discovered_at
        return latest
      }, null)

      const hydrated = rows.filter((r) => r.hydration_status === 'full_text').length
      const failed = rows.filter((r) => r.hydration_status === 'failed').length
      const extractionSuccessRate = yieldCount > 0 ? Math.round((hydrated / yieldCount) * 100) : null

      const refetched = rows.filter((r) => {
        const created = new Date(r.created_at).getTime()
        const updated = new Date(r.updated_at).getTime()
        return updated - created > REFETCH_TOLERANCE_MS
      }).length
      const refetchRate = yieldCount > 0 ? Math.round((refetched / yieldCount) * 100) : null

      const fingerprintCounts = new Map<string, number>()
      for (const row of rows) {
        if (!row.content_fingerprint) continue
        fingerprintCounts.set(row.content_fingerprint, (fingerprintCounts.get(row.content_fingerprint) ?? 0) + 1)
      }
      const fingerprintDuplicates = Array.from(fingerprintCounts.values()).reduce(
        (sum, count) => sum + Math.max(0, count - 1),
        0,
      )

      return {
        id: source.id,
        name: source.name,
        url: source.url,
        connectorType: source.source_type,
        active: source.active,
        category: source.source_category,
        country: source.country,
        regionId: source.region_id,
        availability: {
          status: source.health_status ?? 'unknown',
          consecutiveFailures: source.consecutive_failures ?? 0,
          lastSuccess: source.last_success_at,
          lastFailure: source.last_failure_at,
        },
        freshness: {
          lastEvidenceAt: mostRecent,
          daysSinceLastEvidence: daysSince(mostRecent),
        },
        yield: {
          windowDays: WINDOW_DAYS,
          evidenceCount: yieldCount,
        },
        extraction: {
          fullTextCount: hydrated,
          failedCount: failed,
          successRate: extractionSuccessRate,
        },
        duplication: {
          // Same canonical URL discovered again inside the window (a real
          // re-fetch signal from saveEvidence()'s update path).
          refetchRate,
          // Distinct URLs within the same source that produced an
          // identical title+summary fingerprint — a fuzzy same-story
          // signal, not a hard duplicate (evidence_items.duplicate_of is
          // not populated by any current write path, so this is computed
          // here rather than read from that column).
          fingerprintDuplicateCount: fingerprintDuplicates,
        },
      }
    })

    // When a specific region_id was requested, coverage rows are limited
    // to that region too -- the caller already gets a region-scoped
    // sources array, and computing every other region's coverage just to
    // have the client immediately discard it (see components/settings/
    // RegionCoverageCard.tsx's caller) was wasted work.
    const coverageRegions = regionId
      ? ((regions ?? []) as RegionRow[]).filter((r) => r.id === regionId)
      : ((regions ?? []) as RegionRow[])

    const regionCoverage = coverageRegions.map((region) => {
      const regionSources = allSources.filter((s) => s.region_id === region.id)
      const regionSourceIds = new Set(regionSources.map((s) => s.id))
      const regionYield = sourceStats
        .filter((s) => s.regionId && regionSourceIds.has(s.id))
        .reduce((sum, s) => sum + s.yield.evidenceCount, 0)

      return {
        regionId: region.id,
        code: region.code,
        name: region.name,
        totalSources: regionSources.length,
        activeSources: regionSources.filter((s) => s.active).length,
        healthySources: regionSources.filter((s) => s.health_status === 'healthy').length,
        evidenceYield30d: regionYield,
      }
    })

    // Sources with no region_id are pre-multi-market/global and are
    // intentionally excluded from per-region coverage rollups (they don't
    // belong to any single region), matching the tolerant filter rule used
    // everywhere else in the market-scoped API surface.
    const unscopedSourceCount = allSources.filter((s) => !s.region_id).length

    return NextResponse.json({
      sources: sourceStats,
      regionCoverage,
      unscopedSourceCount,
      windowDays: WINDOW_DAYS,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
