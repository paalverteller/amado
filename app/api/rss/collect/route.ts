import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchAndSaveRss } from '@/lib/rss'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function POST(): Promise<NextResponse> {
  try {
    const { data: sources, error } = await getSupabaseAdmin()
      .from('rss_sources')
      .select('id, name, url, source_type')
      .eq('active', true)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!sources || sources.length === 0) {
      return NextResponse.json({ processed: 0, newItems: 0, results: [] })
    }

    let totalNew = 0
    const results: { name: string; newItems: number; error?: string }[] = []

    for (const source of sources) {
      try {
        const newItems = await fetchAndSaveRss(source.id, source.url, source.source_type ?? 'rss')
        totalNew += newItems
        results.push({ name: source.name, newItems })
      } catch (err) {
        const msg = getErrorMessage(err)
        console.error(`[rss/collect] ${source.name}:`, msg)
        results.push({ name: source.name, newItems: 0, error: msg })
      }
    }

    return NextResponse.json({ processed: sources.length, newItems: totalNew, results })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
