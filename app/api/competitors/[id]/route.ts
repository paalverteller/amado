import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const admin = getSupabaseAdmin()

    const { data: competitor, error: competitorError } = await admin
      .from('competitors')
      .select('*')
      .eq('id', id)
      .single()

    if (competitorError) {
      return NextResponse.json({ error: competitorError.message }, { status: 404 })
    }

    const { data: sources } = await admin
      .from('rss_sources')
      .select('id, name, url, source_type, active, health_status, last_success_at, last_failure_at')
      .eq('competitor_id', id)
      .order('name', { ascending: true })

    const { data: latestReview } = await admin
      .from('knowledge_assets')
      .select('id, title, raw_text, processing_status, created_at')
      .eq('competitor_id', id)
      .eq('content_type', 'competitor_note')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ competitor, sources: sources ?? [], latestReview: latestReview ?? null })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const body = await request.json() as {
      name?: string
      website?: string
      notes?: string
      status?: 'active' | 'archived'
    }

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

    const { data, error } = await getSupabaseAdmin()
      .from('competitors')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    // Sources and knowledge_assets keep existing (competitor_id -> SET NULL,
    // per migration 041) rather than cascading -- collected evidence and
    // written reviews stay in the DB even if the competitor entity is
    // removed, consistent with evidence_items never being deleted elsewhere
    // in this codebase either.
    const { error } = await getSupabaseAdmin().from('competitors').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
