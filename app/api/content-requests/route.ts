import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const brandProfileId = searchParams.get('brandProfileId')
    const regionId = searchParams.get('regionId')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    let query = getSupabaseAdmin()
      .from('content_requests')
      .select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (brandProfileId) query = query.eq('brand_profile_id', brandProfileId)
    if (regionId) query = query.eq('region_id', regionId)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      requests: data ?? [],
      pagination: { limit, offset, total: count ?? data?.length ?? 0 },
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const {
      topic,
      contentFormat = 'article',
      locale = 'pt-BR',
      seoMode = false,
      context,
      evidenceItemIds,
      brandProfileId,
      regionId,
      templateId,
      priority = 5,
      scheduledAt,
    } = body

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('content_requests')
      .insert({
        status: 'pending',
        topic: topic.trim(),
        content_format: contentFormat,
        locale,
        seo_mode: seoMode,
        context: context || null,
        evidence_item_ids: evidenceItemIds || null,
        brand_profile_id: brandProfileId || null,
        region_id: regionId || null,
        template_id: templateId || null,
        priority,
        scheduled_at: scheduledAt || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ request: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
