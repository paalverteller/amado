import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    const admin = getSupabaseAdmin()

    const { data: run, error: runError } = await admin
      .from('briefing_runs')
      .select('id, run_date, status, items_count, created_at, completed_at')
      .order('run_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })
    if (!run) return NextResponse.json({ run: null, items: [] })

    if (run.status !== 'ready') {
      return NextResponse.json({ run, items: [] })
    }

    const { data: items, error: itemsError } = await admin
      .from('briefing_items')
      .select(`
        id, rank, why_it_matters, feedback, sent_to_generation_at,
        evidence_item:evidence_item_id (
          id, source_title, source_summary, canonical_url, published_at, hydration_status
        )
      `)
      .eq('run_id', run.id)
      .order('rank', { ascending: true })

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

    return NextResponse.json({ run, items: items ?? [] })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
