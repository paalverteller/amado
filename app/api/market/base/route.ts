import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
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
        source_type
      )
    `)
    .order('collected_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [], total: data?.length ?? 0, max: 50 })
}
