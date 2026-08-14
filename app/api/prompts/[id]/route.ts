import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

const EDITABLE = new Set([
  'name',
  'tone_description',
  'system_prompt',
  'content_types',
  'is_default',
  'is_active',
  'version',
])

interface Context {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const body = await request.json() as Record<string, unknown>
    const patch: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(body)) {
      if (EDITABLE.has(key)) patch[key] = value
    }

    if (typeof patch.name === 'string') patch.name = patch.name.trim()
    if (typeof patch.system_prompt === 'string') patch.system_prompt = patch.system_prompt.trim()
    if (Array.isArray(patch.content_types)) {
      patch.content_types = patch.content_types.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      )
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
