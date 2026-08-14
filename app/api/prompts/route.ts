import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

const EDITABLE = [
  'name',
  'tone_description',
  'system_prompt',
  'content_types',
  'is_default',
  'is_active',
  'version',
] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.nextUrl.searchParams.get('contentType')
    let query = getSupabaseAdmin()
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (contentType) query = query.contains('content_types', [contentType])

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const systemPrompt = typeof body.system_prompt === 'string' ? body.system_prompt.trim() : ''

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!systemPrompt) return NextResponse.json({ error: 'system_prompt is required' }, { status: 400 })

    const row: Record<string, unknown> = {
      name,
      system_prompt: systemPrompt,
      tone_description: typeof body.tone_description === 'string' ? body.tone_description.trim() : '',
      content_types: Array.isArray(body.content_types)
        ? body.content_types.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [],
      is_default: body.is_default === true,
      is_active: body.is_active !== false,
      version: typeof body.version === 'string' && body.version.trim() ? body.version.trim() : 'custom-v1',
      usage_count: 0,
    }

    const { data, error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .insert(row)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
