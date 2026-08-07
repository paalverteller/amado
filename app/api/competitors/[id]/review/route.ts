import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { generateCompetitorReview } from '@/lib/competitor-review'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

export const maxDuration = 60

export async function POST(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const result = await generateCompetitorReview(id)

    if (result.status === 'ready') {
      await getSupabaseAdmin()
        .from('competitors')
        .update({ last_reviewed_at: new Date().toISOString() })
        .eq('id', id)
    }

    const httpStatus = result.status === 'failed' ? 500 : 200
    return NextResponse.json(result, { status: httpStatus })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
