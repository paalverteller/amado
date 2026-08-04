import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { saveManualItem } from '@/lib/rss'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const body = await request.json() as { title?: string; content?: string; url?: string }

    const title = body.title?.trim()
    const content = body.content?.trim()
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

    const { data: source, error: sourceError } = await getSupabaseAdmin()
      .from('rss_sources')
      .select('id, source_type, active')
      .eq('id', id)
      .single()

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }
    if (source.source_type !== 'manual') {
      return NextResponse.json(
        { error: `Source type is '${source.source_type}', not 'manual' — this endpoint is only for manual sources` },
        { status: 400 },
      )
    }
    if (!source.active) {
      return NextResponse.json({ error: 'Source is inactive' }, { status: 400 })
    }

    const result = await saveManualItem(id, { title, content, url: body.url })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
