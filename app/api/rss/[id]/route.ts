import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const body = await request.json() as {
      active?: boolean
      name?: string
      url?: string
      country?: string
      source_type?: string
    }

    const update: Record<string, string | boolean> = {}

    if (typeof body.active === 'boolean') update.active = body.active
    if (typeof body.name === 'string') update.name = body.name.trim()
    if (typeof body.url === 'string') update.url = body.url.trim()
    if (typeof body.country === 'string') update.country = body.country.trim()
    if (typeof body.source_type === 'string') update.source_type = body.source_type.trim()

    const { data, error } = await getSupabaseAdmin()
      .from('rss_sources')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params

    // Removed cascading delete to preserve historical market data forever

    const { error } = await getSupabaseAdmin()
      .from('rss_sources')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
