import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Content generated today
    const { data: generatedData, error: generatedError } = await getSupabaseAdmin()
      .from('articles')
      .select('id', { count: 'exact' })
      .gte('created_at', dayAgo.toISOString())

    if (generatedError) {
      return NextResponse.json({ error: generatedError.message }, { status: 500 })
    }

    // Content published today
    const { data: publishedData, error: publishedError } = await getSupabaseAdmin()
      .from('articles')
      .select('id', { count: 'exact' })
      .eq('status', 'published')
      .gte('created_at', dayAgo.toISOString())

    if (publishedError) {
      return NextResponse.json({ error: publishedError.message }, { status: 500 })
    }

    // Failed content requests
    const { data: failedData, error: failedError } = await getSupabaseAdmin()
      .from('content_requests')
      .select('id', { count: 'exact' })
      .eq('status', 'failed')
      .gte('created_at', dayAgo.toISOString())

    if (failedError) {
      return NextResponse.json({ error: failedError.message }, { status: 500 })
    }

    // Pending requests
    const { data: pendingData, error: pendingError } = await getSupabaseAdmin()
      .from('content_requests')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')

    if (pendingError) {
      return NextResponse.json({ error: pendingError.message }, { status: 500 })
    }

    // Ingestion metrics
    const { data: ingestionData, error: ingestionError } = await getSupabaseAdmin()
      .from('ingestion_runs')
      .select('items_discovered, items_saved')
      .gte('started_at', dayAgo.toISOString())
      .eq('success', true)

    if (ingestionError) {
      return NextResponse.json({ error: ingestionError.message }, { status: 500 })
    }

    const totalDiscovered = ingestionData?.reduce((sum, run) => sum + (run.items_discovered ?? 0), 0) ?? 0
    const totalSaved = ingestionData?.reduce((sum, run) => sum + (run.items_saved ?? 0), 0) ?? 0

    return NextResponse.json({
      metrics: {
        generatedToday: generatedData?.length ?? 0,
        publishedToday: publishedData?.length ?? 0,
        failedToday: failedData?.length ?? 0,
        pendingRequests: pendingData?.length ?? 0,
        itemsDiscovered24h: totalDiscovered,
        itemsSaved24h: totalSaved,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 }
    )
  }
}
