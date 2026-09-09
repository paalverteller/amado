import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'
import type { CompetitorSummary } from '@/lib/domain/competitor'

export const dynamic = 'force-dynamic'

const MAX_COMPETITORS = 12

type CompetitorRow = {
  id: string
  name: string
  website: string | null
  status: string
  last_reviewed_at: string | null
}

type SourceRow = {
  id: string
  competitor_id: string | null
  active: boolean | null
  health_status: string | null
}

type ReviewRow = {
  competitor_id: string | null
  title: string
  raw_text: string
  created_at: string
}

function snippet(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const brandId = request.nextUrl.searchParams.get('brand_id')
    const regionId = request.nextUrl.searchParams.get('region_id')
    const admin = getSupabaseAdmin()

    let competitorQuery = admin
      .from('competitors')
      .select('id, name, website, status, last_reviewed_at')
      .eq('status', 'active')
      .order('last_reviewed_at', { ascending: false, nullsFirst: false })
      .limit(MAX_COMPETITORS)

    if (brandId) {
      competitorQuery = competitorQuery.eq('brand_id', brandId)
    } else if (regionId) {
      const { data: brandsInRegion, error: brandsError } = await admin.from('brand_profiles').select('id').eq('region_id', regionId)
      if (brandsError) return NextResponse.json({ error: brandsError.message }, { status: 500 })
      const brandIds = (brandsInRegion ?? []).map((brand: { id: string }) => brand.id)
      if (brandIds.length === 0) return NextResponse.json({ competitors: [] })
      competitorQuery = competitorQuery.in('brand_id', brandIds)
    }

    const { data: competitors, error: competitorsError } = await competitorQuery
    if (competitorsError) return NextResponse.json({ error: competitorsError.message }, { status: 500 })

    const rows = (competitors ?? []) as CompetitorRow[]
    if (rows.length === 0) return NextResponse.json({ competitors: [] })
    const ids = rows.map((competitor) => competitor.id)

    const [directSourcesResult, linksResult, reviewsResult] = await Promise.all([
      admin.from('rss_sources').select('id, competitor_id, active, health_status').in('competitor_id', ids),
      admin.from('competitor_source_links').select('competitor_id, source_id').in('competitor_id', ids),
      admin
        .from('knowledge_assets')
        .select('competitor_id, title, raw_text, created_at')
        .in('competitor_id', ids)
        .eq('content_type', 'competitor_note')
        .order('created_at', { ascending: false }),
    ])

    if (directSourcesResult.error) return NextResponse.json({ error: directSourcesResult.error.message }, { status: 500 })
    if (linksResult.error) return NextResponse.json({ error: linksResult.error.message }, { status: 500 })
    if (reviewsResult.error) return NextResponse.json({ error: reviewsResult.error.message }, { status: 500 })

    const linkedSourceIds = Array.from(new Set((linksResult.data ?? []).map((row: { source_id: string }) => row.source_id)))
    const linkedSourcesResult = linkedSourceIds.length > 0
      ? await admin.from('rss_sources').select('id, active, health_status').in('id', linkedSourceIds)
      : { data: [], error: null }
    if (linkedSourcesResult.error) return NextResponse.json({ error: linkedSourcesResult.error.message }, { status: 500 })

    const linkedSourceById = new Map<string, Omit<SourceRow, 'competitor_id'>>()
    for (const source of (linkedSourcesResult.data ?? []) as Array<Omit<SourceRow, 'competitor_id'>>) linkedSourceById.set(source.id, source)

    const sourcesByCompetitor = new Map<string, Map<string, SourceRow>>()
    function addSource(competitorId: string, source: SourceRow) {
      const map = sourcesByCompetitor.get(competitorId) ?? new Map<string, SourceRow>()
      map.set(source.id, source)
      sourcesByCompetitor.set(competitorId, map)
    }

    for (const source of (directSourcesResult.data ?? []) as SourceRow[]) {
      if (source.competitor_id) addSource(source.competitor_id, source)
    }
    for (const link of (linksResult.data ?? []) as Array<{ competitor_id: string; source_id: string }>) {
      const source = linkedSourceById.get(link.source_id)
      if (source) addSource(link.competitor_id, { ...source, competitor_id: link.competitor_id })
    }

    const latestReviewByCompetitor = new Map<string, ReviewRow>()
    for (const review of (reviewsResult.data ?? []) as ReviewRow[]) {
      if (!review.competitor_id || latestReviewByCompetitor.has(review.competitor_id)) continue
      latestReviewByCompetitor.set(review.competitor_id, review)
    }

    const summaries: CompetitorSummary[] = rows.map((competitor) => {
      const sources = Array.from(sourcesByCompetitor.get(competitor.id)?.values() ?? [])
      const activeSources = sources.filter((source) => source.active !== false)
      const review = latestReviewByCompetitor.get(competitor.id) ?? null
      return {
        id: competitor.id,
        name: competitor.name,
        website: competitor.website,
        lastReviewedAt: competitor.last_reviewed_at,
        sourceCount: activeSources.length,
        healthySourceCount: activeSources.filter((source) => source.health_status === 'healthy').length,
        latestReview: review ? { title: review.title, snippet: snippet(review.raw_text), createdAt: review.created_at } : null,
      }
    })

    return NextResponse.json({ competitors: summaries })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
