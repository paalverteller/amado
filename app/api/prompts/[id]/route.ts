import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal Server Error'
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json() as { system_prompt?: string }

    if (typeof body.system_prompt !== 'string') {
      return NextResponse.json({ error: 'system_prompt is required' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .update({ system_prompt: body.system_prompt })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
