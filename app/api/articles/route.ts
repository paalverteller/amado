import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, Article } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as Article['status'] | null
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100)

    let query = getSupabaseAdmin()
      .from('articles')
      .select('id, topic, content_type, status, rating, generation_model, created_at, word_count')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && ['draft', 'reviewed', 'published'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) {
      console.error('[articles] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ articles: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
