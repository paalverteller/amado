import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/api/error-message'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const { id } = await params
    const { data, error } = await getSupabaseAdmin()
      .from('articles').select('*').eq('id', id).single()

    if (error || !data) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

const ALLOWED_PATCH = ['final_content', 'rating', 'comment', 'status', 'published_at', 'tags', 'draft_content']

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const { id } = await params
    const body = await req.json() as Record<string, unknown>

    const update: Record<string, unknown> = {}
    for (const key of ALLOWED_PATCH) {
      if (key in body) update[key] = body[key]
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('articles').update(update).eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
