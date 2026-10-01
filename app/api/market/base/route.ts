import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'
export const dynamic = 'force-dynamic'

const MAX_ITEMS = 50
// Over-fetch before region filtering, same tolerance pattern as
// /api/market/route.ts: a source with no region_id is legacy/global and
// stays visible in every market rather than being silently dropped.
const FETCH_LIMIT = 400

type Src = {
  name?: string | null
  url?: string | null
  country?: string | null
  source_type?: string | null
  region_id?: string | null
}

type BaseRow = {
  id: string
  title: string | null
  title_ru: string | null
  description: string | null
  summary_ru: string | null
  link: string | null
  published_at: string | null
  collected_at: string | null
  source: Src | Src[] | null
}

function normSrc(source: BaseRow['source']): Src | null {
  return Array.isArray(source) ? source[0] ?? null : source
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const regionId = request.nextUrl.searchParams.get('region_id')

    const { data, error } = await getSupabaseAdmin()
      .from('rss_items')
      .select(`
        id,
        title,
        title_ru,
        description,
        summary_ru,
        link,
        published_at,
        collected_at,
        source:source_id (
          name,
          url,
          country,
          source_type,
          region_id
        )
      `)
      .order('collected_at', { ascending: false })
      .limit(FETCH_LIMIT)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as unknown as BaseRow[]
    const filtered = regionId
      ? rows.filter((row) => {
          const rowRegionId = normSrc(row.source)?.region_id
          return !rowRegionId || rowRegionId === regionId
        })
      : rows

    const items = filtered.slice(0, MAX_ITEMS).map((row) => ({
      ...row,
      source: normSrc(row.source),
    }))

    return NextResponse.json({ items, total: items.length, max: MAX_ITEMS })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
