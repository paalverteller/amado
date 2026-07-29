import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .select('id, name, tone_description, content_types, is_default, is_active, usage_count, version')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name',       { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ templates: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { id?: string; is_active?: boolean }
    if (!body.id || typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'id and is_active required' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .update({ is_active: body.is_active })
      .eq('id', body.id)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
