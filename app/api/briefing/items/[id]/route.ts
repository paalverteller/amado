import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const body = await request.json() as { feedback?: 'useful' | 'irrelevant' | null; sentToGeneration?: boolean }

    const update: Record<string, unknown> = {}

    if (body.feedback !== undefined) {
      if (body.feedback !== null && body.feedback !== 'useful' && body.feedback !== 'irrelevant') {
        return NextResponse.json({ error: "feedback must be 'useful', 'irrelevant', or null" }, { status: 400 })
      }
      update.feedback = body.feedback
      update.feedback_at = body.feedback ? new Date().toISOString() : null
    }

    if (body.sentToGeneration) {
      update.sent_to_generation_at = new Date().toISOString()
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('briefing_items')
      .update(update)
      .eq('id', id)
      .select('id, feedback, sent_to_generation_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
