import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'
import type { CompetitorSummary } from '@/lib/domain/competitor'

export const dynamic = 'force-dynamic'

// Lightweight, read-only rollup for the Market page's "Конкуренты" section.
// Reuses the same tables as /api/competitors/[id] (rss_sources, knowledge_assets)
// but batches across all active competitors in a handful of queries instead of
// one round-trip per card, since the Market page renders every competitor at once.
const MAX_COMPETITORS = 12

type CompetitorRow = {
  id: string
  name: string
  website: string | null
  status: string
  last_reviewed_at: string | null
}

type SourceRow = {
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
      // Sprint 12 Phase 4: competitors have no region_id of their own --
      // they inherit their market through the brand they're tracked
      // against (see supabase/migrations/*_competitors.sql: only brand_id
      // is a FK). Resolve the region's brand ids first, then scope
      // competitors to those. A brand with no competitors of its own
      // (region has brands but nobody tracks anyone yet) correctly yields
      // an empty list here rather than falling back to showing every
      // competitor across every market.
      const { data: brandsInRegion, error: brandsError } = await admin
        .from('brand_profiles')
        .select('id')
        .eq('region_id', regionId)
      if (brandsError) return NextResponse.json({ error: brandsError.message }, { status: 500 })

      const brandIds = (brandsInRegion ?? []).map((b: { id: string }) => b.id)
      if (brandIds.length === 0) return NextResponse.json({ competitors: [] })
      competitorQuery = competitorQuery.in('brand_id', brandIds)
    }

    const { data: competitors, error: competitorsError } = await competitorQuery
    if (competitorsError) return NextResponse.json({ error: competitorsError.message }, { status: 500 })

    const rows = (competitors ?? []) as CompetitorRow[]
    if (rows.length === 0) return NextResponse.json({ competitors: [] })

    const ids = rows.map((c) => c.id)

    const [sourcesRes, reviewsRes] = await Promise.all([
      admin
        .from('rss_sources')
        .select('competitor_id, active, health_status')
        .in('competitor_id', ids),
      admin
        .from('knowledge_assets')
        .select('competitor_id, title, raw_text, created_at')
        .in('competitor_id', ids)
        .eq('content_type', 'competitor_note')
        .order('created_at', { ascending: false }),
    ])

    if (sourcesRes.error) return NextResponse.json({ error: sourcesRes.error.message }, { status: 500 })
    if (reviewsRes.error) return NextResponse.json({ error: reviewsRes.error.message }, { status: 500 })

    const sourcesByCompetitor = new Map<string, SourceRow[]>()
    for (const s of (sourcesRes.data ?? []) as SourceRow[]) {
      if (!s.competitor_id) continue
      const list = sourcesByCompetitor.get(s.competitor_id) ?? []
      list.push(s)
      sourcesByCompetitor.set(s.competitor_id, list)
    }

    // Reviews are ordered newest-first, so the first match per competitor is the latest.
    const latestReviewByCompetitor = new Map<string, ReviewRow>()
    for (const r of (reviewsRes.data ?? []) as ReviewRow[]) {
      if (!r.competitor_id || latestReviewByCompetitor.has(r.competitor_id)) continue
      latestReviewByCompetitor.set(r.competitor_id, r)
    }

    const summaries: CompetitorSummary[] = rows.map((c) => {
      const sources = sourcesByCompetitor.get(c.id) ?? []
      const activeSources = sources.filter((s) => s.active !== false)
      const review = latestReviewByCompetitor.get(c.id) ?? null

      return {
        id: c.id,
        name: c.name,
        website: c.website,
        lastReviewedAt: c.last_reviewed_at,
        sourceCount: activeSources.length,
        healthySourceCount: activeSources.filter((s) => s.health_status === 'healthy').length,
        latestReview: review
          ? { title: review.title, snippet: snippet(review.raw_text), createdAt: review.created_at }
          : null,
      }
    })

    return NextResponse.json({ competitors: summaries })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
