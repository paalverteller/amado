import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

const HORIZONS = ['3h', '24h', '72h', '7d', 'manual'] as const
const METRIC_FIELDS = [
  'reach', 'impressions', 'followers', 'non_follower_reach', 'saves', 'shares',
  'replies', 'comments', 'likes', 'watch_time_seconds', 'retention_rate',
  'rewatches', 'profile_visits', 'dms', 'whatsapp_starts', 'link_clicks',
] as const

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const { data, error } = await getSupabaseAdmin()
      .from('performance_snapshots')
      .select('*')
      .eq('article_id', id)
      .order('recorded_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ snapshots: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>

    const platform = typeof body.platform === 'string' ? body.platform.trim() : ''
    if (!platform) return NextResponse.json({ error: 'platform is required' }, { status: 400 })

    const horizon = typeof body.horizon === 'string' ? body.horizon : 'manual'
    if (!HORIZONS.includes(horizon as (typeof HORIZONS)[number])) {
      return NextResponse.json({ error: `horizon must be one of: ${HORIZONS.join(', ')}` }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    const { data: article, error: articleError } = await admin
      .from('articles')
      .select('id, brand_profile_id, status')
      .eq('id', id)
      .single()

    if (articleError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const insert: Record<string, unknown> = {
      article_id: id,
      brand_id: article.brand_profile_id ?? null,
      platform,
      horizon,
      source: 'manual',
      qualitative_notes: typeof body.qualitative_notes === 'string' ? body.qualitative_notes.trim() || null : null,
    }

    for (const field of METRIC_FIELDS) {
      const value = body[field]
      if (typeof value === 'number' && Number.isFinite(value)) insert[field] = value
    }

    const { data: snapshot, error: insertError } = await admin
      .from('performance_snapshots')
      .insert(insert)
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Recording performance implies the piece went out -- reflect that on
    // the article if it wasn't already marked published. Doesn't
    // overwrite an already-published_at timestamp.
    if (article.status !== 'published') {
      await admin.from('articles').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id)
    }

    return NextResponse.json(snapshot, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
