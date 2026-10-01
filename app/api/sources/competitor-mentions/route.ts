import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'
import { competitorAliases, mentionsCompetitor, type CompetitorRow } from '@/lib/competitor-review'

export const dynamic = 'force-dynamic'

// Trailing window for the mention scan. Matches the review window used by
// generateCompetitorReview() (REVIEW_WINDOW_DAYS in lib/competitor-review.ts)
// so this observability view and an actual competitor review are looking at
// the same slice of evidence, even though they're computed independently.
const WINDOW_DAYS = 30
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000
// Same cap as gatherIndependentMentions()'s MAX_INDEPENDENT_SCAN, for the
// same reason: bound the amount of evidence text scanned per request.
const MAX_EVIDENCE_SCAN = 2000

type SourceRow = {
  id: string
  name: string
  source_category: string | null
  active: boolean
}

type EvidenceRow = {
  source_id: string
  source_title: string | null
  source_summary: string | null
  full_text: string | null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const regionId = request.nextUrl.searchParams.get('region_id')
    if (!regionId) {
      return NextResponse.json({ error: 'region_id is required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    const { data: brandsInRegion, error: brandsError } = await admin
      .from('brand_profiles')
      .select('id')
      .eq('region_id', regionId)
    if (brandsError) return NextResponse.json({ error: brandsError.message }, { status: 500 })

    const brandIds = (brandsInRegion ?? []).map((brand: { id: string }) => brand.id)

    const { data: competitors, error: competitorsError } = brandIds.length > 0
      ? await admin
          .from('competitors')
          .select('id, brand_id, name, website, notes')
          .eq('status', 'active')
          .in('brand_id', brandIds)
      : { data: [] as CompetitorRow[], error: null }
    if (competitorsError) return NextResponse.json({ error: competitorsError.message }, { status: 500 })

    const competitorRows = (competitors ?? []) as CompetitorRow[]

    // Build one alias list per competitor, keeping the competitor identity
    // attached — a source that mentions two different competitors should
    // count once per competitor, not once total, since "surfaces
    // competitive signal" is about breadth of coverage.
    const competitorsWithAliases = competitorRows
      .map((competitor) => ({ competitor, aliases: competitorAliases(competitor) }))
      .filter((entry) => entry.aliases.length > 0)

    const { data: marketSources, error: sourcesError } = await admin
      .from('rss_sources')
      .select('id, name, source_category, active')
      .eq('region_id', regionId)
      .eq('active', true)
    if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })

    const nonCompetitorSources = ((marketSources ?? []) as SourceRow[])
      .filter((source) => source.source_category !== 'competitor')

    if (nonCompetitorSources.length === 0 || competitorsWithAliases.length === 0) {
      return NextResponse.json({
        sources: nonCompetitorSources.map((source) => ({
          id: source.id,
          name: source.name,
          mentionCount: 0,
          competitorsCovered: 0,
        })),
        competitorsScanned: competitorsWithAliases.length,
        windowDays: WINDOW_DAYS,
        generatedAt: new Date().toISOString(),
      })
    }

    const sourceIds = nonCompetitorSources.map((source) => source.id)
    const windowStartIso = new Date(Date.now() - WINDOW_MS).toISOString()

    const { data: evidenceRows, error: evidenceError } = await admin
      .from('evidence_items')
      .select('source_id, source_title, source_summary, full_text')
      .in('source_id', sourceIds)
      .gte('discovered_at', windowStartIso)
      .limit(MAX_EVIDENCE_SCAN)
    if (evidenceError) return NextResponse.json({ error: evidenceError.message }, { status: 500 })

    // Per source: total mention count (a source can rack up multiple
    // mentions of the same competitor over the window) and how many
    // distinct competitors it has surfaced at least once — breadth vs.
    // volume are different signals for "is this source worth keeping."
    const mentionCountBySource = new Map<string, number>()
    const competitorsCoveredBySource = new Map<string, Set<string>>()

    for (const row of (evidenceRows ?? []) as EvidenceRow[]) {
      for (const { competitor, aliases } of competitorsWithAliases) {
        if (!mentionsCompetitor(row, aliases)) continue
        mentionCountBySource.set(row.source_id, (mentionCountBySource.get(row.source_id) ?? 0) + 1)
        const covered = competitorsCoveredBySource.get(row.source_id) ?? new Set<string>()
        covered.add(competitor.id)
        competitorsCoveredBySource.set(row.source_id, covered)
      }
    }

    const sources = nonCompetitorSources
      .map((source) => ({
        id: source.id,
        name: source.name,
        mentionCount: mentionCountBySource.get(source.id) ?? 0,
        competitorsCovered: competitorsCoveredBySource.get(source.id)?.size ?? 0,
      }))
      .sort((a, b) => b.mentionCount - a.mentionCount)

    return NextResponse.json({
      sources,
      competitorsScanned: competitorsWithAliases.length,
      windowDays: WINDOW_DAYS,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
