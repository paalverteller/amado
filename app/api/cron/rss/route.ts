import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { fetchAndSaveRss, resetHydrationBudget } from '@/lib/rss'
import { requireCronAuth } from '@/lib/cron-auth'
import { buildSourceConnector } from '@/lib/ingestion/types'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = requireCronAuth(request)
  if (denied) return denied

  resetHydrationBudget()

  const { data: sources, error } = await getSupabaseAdmin()
    .from('rss_sources')
    .select('id, name, url, source_type, type, country, region_id, language_code, parser_config')
    .eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!sources || sources.length === 0) {
    return NextResponse.json({ processed: 0, newItems: 0 })
  }

  let totalNew = 0
  const results: { name: string; newItems: number; error?: string }[] = []

  for (const source of sources) {
    try {
      const connector = buildSourceConnector(source)
      const newItems = await fetchAndSaveRss(source.id, source.url, connector.connectorType)
      totalNew += newItems
      results.push({ name: source.name, newItems })
    } catch (err) {
      const msg = getErrorMessage(err)
      console.error(`[cron/rss] ${source.name}:`, msg)
      results.push({ name: source.name, newItems: 0, error: msg })
    }
  }

  return NextResponse.json({ processed: sources.length, newItems: totalNew, results })
}