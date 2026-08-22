import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

const MAX_TOTAL = 100
const MAX_PER_SOURCE = 6
const MAX_SEARCH_RESULTS = 50
const MAX_SEARCH_PER_QUERY = 30
const FEED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

type Src = {
  name?: string | null
  url?: string | null
  country?: string | null
  source_type?: string | null
  source_category?: string | null
  region_id?: string | null
}

type EvidenceRow = {
  id: string
  source_title: string | null
  source_summary: string | null
  full_text?: string | null
  canonical_url: string | null
  published_at: string | null
  discovered_at: string | null
  hydration_status: string | null
  source: Src | Src[] | null
}

type MarketItem = {
  id: string
  title: string | null
  description: string | null
  title_ru: string
  summary_ru: string
  link: string | null
  published_at: string | null
  collected_at: string | null
  hydrationStatus: string | null
  source: Src | null
}

function normSrc(source: EvidenceRow['source']): Src | null {
  return Array.isArray(source) ? source[0] ?? null : source
}

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function itemTs(row: EvidenceRow): number {
  const raw = row.published_at ?? row.discovered_at
  const parsed = raw ? Date.parse(raw) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function toMarketItem(row: EvidenceRow, regionId?: string | null): MarketItem | null {
  const source = normSrc(row.source)
  // Competitor evidence has its own workspace and is injected separately
  // into generation. The market feed should remain a market/trend feed.
  if (source?.source_category === 'competitor') return null

  // Sprint 12 Phase 4: when a market is selected, only show sources scoped
  // to that region. A source with no region_id (pre-Sprint-12 rows, or a
  // deliberately global source) is treated as visible in every market
  // rather than hidden everywhere -- excluding it outright would silently
  // empty the feed for existing Brazil sources that predate region_id.
  if (regionId && source?.region_id && source.region_id !== regionId) return null

  const title = clean(row.source_title)
  if (!title) return null

  return {
    id: row.id,
    title,
    description: clean(row.source_summary),
    title_ru: title,
    summary_ru: clean(row.source_summary),
    link: row.canonical_url,
    published_at: row.published_at,
    collected_at: row.discovered_at,
    hydrationStatus: row.hydration_status,
    source,
  }
}

function pick(items: MarketItem[]): MarketItem[] {
  const counts = new Map<string, number>()
  const out: MarketItem[] = []
  for (const item of items) {
    if (out.length >= MAX_TOTAL) break
    const key = item.source?.url ?? item.source?.name ?? 'unknown'
    const count = counts.get(key) ?? 0
    if (count >= MAX_PER_SOURCE) continue
    counts.set(key, count + 1)
    out.push(item)
  }
  return out
}

async function searchEvidence(rawQuery: string, regionId?: string | null): Promise<NextResponse> {
  try {
    const term = rawQuery.trim().slice(0, 200)
    if (!term) return NextResponse.json({ items: [], meta: { total: 0, query: rawQuery } })

    const pattern = `%${term.replace(/[%_]/g, '\\$&')}%`
    const columns = 'id, source_title, source_summary, full_text, canonical_url, published_at, discovered_at, hydration_status, source:source_id(name, url, country, source_type, source_category, region_id)'

    const [byTitle, bySummary, byFullText] = await Promise.all([
      getSupabaseAdmin().from('evidence_items').select(columns).ilike('source_title', pattern).order('published_at', { ascending: false }).limit(MAX_SEARCH_PER_QUERY),
      getSupabaseAdmin().from('evidence_items').select(columns).ilike('source_summary', pattern).order('published_at', { ascending: false }).limit(MAX_SEARCH_PER_QUERY),
      getSupabaseAdmin().from('evidence_items').select(columns).ilike('full_text', pattern).order('published_at', { ascending: false }).limit(MAX_SEARCH_PER_QUERY),
    ])

    for (const result of [byTitle, bySummary, byFullText]) {
      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    const byId = new Map<string, EvidenceRow>()
    for (const rows of [byTitle.data, bySummary.data, byFullText.data]) {
      for (const row of (rows ?? []) as unknown as EvidenceRow[]) byId.set(row.id, row)
    }

    const lowerTerm = term.toLowerCase()
    const items = Array.from(byId.values())
      .filter((row) => normSrc(row.source)?.source_category !== 'competitor')
      .filter((row) => {
        if (!regionId) return true
        const rowRegionId = normSrc(row.source)?.region_id
        return !rowRegionId || rowRegionId === regionId
      })
      .sort((a, b) => itemTs(b) - itemTs(a))
      .slice(0, MAX_SEARCH_RESULTS)
      .map((row) => {
        const item = toMarketItem(row, regionId)
        return item ? {
          ...item,
          matchedInFullText: Boolean(row.full_text?.toLowerCase().includes(lowerTerm)),
        } : null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    return NextResponse.json({ items, meta: { total: items.length, query: term } })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const q = request.nextUrl.searchParams.get('q')
  const regionId = request.nextUrl.searchParams.get('region_id')
  if (q?.trim()) return searchEvidence(q, regionId)

  try {
    const cutoff = new Date(Date.now() - FEED_WINDOW_MS).toISOString()
    const { data, error } = await getSupabaseAdmin()
      .from('evidence_items')
      .select('id, source_title, source_summary, canonical_url, published_at, discovered_at, hydration_status, source:source_id(name, url, country, source_type, source_category, region_id)')
      .gte('discovered_at', cutoff)
      .order('discovered_at', { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const available = ((data ?? []) as unknown as EvidenceRow[])
      .map((row) => toMarketItem(row, regionId))
      .filter((item): item is MarketItem => item !== null)
      .sort((a, b) => Date.parse(b.published_at ?? b.collected_at ?? '') - Date.parse(a.published_at ?? a.collected_at ?? ''))

    const items = pick(available)
    return NextResponse.json({
      items,
      meta: {
        total: items.length,
        available: available.length,
        maxTotal: MAX_TOTAL,
        maxPerSource: MAX_PER_SOURCE,
        sources: items.reduce<Record<string, number>>((acc, item) => {
          const name = item.source?.name ?? 'Unknown'
          acc[name] = (acc[name] ?? 0) + 1
          return acc
        }, {}),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}