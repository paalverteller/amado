import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function loadCompetitorSourceIds(competitorId: string): Promise<string[]> {
  const admin = getSupabaseAdmin()
  const [linksResult, legacyResult] = await Promise.all([
    admin.from('competitor_source_links').select('source_id').eq('competitor_id', competitorId),
    admin.from('rss_sources').select('id').eq('competitor_id', competitorId),
  ])
  if (linksResult.error) throw new Error(linksResult.error.message)
  if (legacyResult.error) throw new Error(legacyResult.error.message)
  return Array.from(new Set([
    ...(linksResult.data ?? []).map((row: { source_id: string }) => row.source_id),
    ...(legacyResult.data ?? []).map((row: { id: string }) => row.id),
  ]))
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const admin = getSupabaseAdmin()

    const { data: competitor, error: competitorError } = await admin.from('competitors').select('*').eq('id', id).single()
    if (competitorError) return NextResponse.json({ error: competitorError.message }, { status: 404 })

    const sourceIds = await loadCompetitorSourceIds(id)
    const sourcesResult = sourceIds.length > 0
      ? await admin
        .from('rss_sources')
        .select('id, name, url, source_type, active, health_status, last_success_at, last_failure_at')
        .in('id', sourceIds)
        .order('name', { ascending: true })
      : { data: [], error: null }
    if (sourcesResult.error) return NextResponse.json({ error: sourcesResult.error.message }, { status: 500 })

    const { data: latestReview, error: reviewError } = await admin
      .from('knowledge_assets')
      .select('id, title, raw_text, processing_status, created_at')
      .eq('competitor_id', id)
      .eq('content_type', 'competitor_note')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 })

    return NextResponse.json({ competitor, sources: sourcesResult.data ?? [], latestReview: latestReview ?? null })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const body = await request.json() as { name?: string; website?: string; notes?: string; status?: 'active' | 'archived' }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) update.name = body.name.trim()
    if (body.website !== undefined) update.website = body.website.trim() || null
    if (body.notes !== undefined) update.notes = body.notes.trim() || null
    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'archived') {
        return NextResponse.json({ error: "status must be 'active' or 'archived'" }, { status: 400 })
      }
      update.status = body.status
    }

    const { data, error } = await getSupabaseAdmin().from('competitors').update(update).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const { error } = await getSupabaseAdmin().from('competitors').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
