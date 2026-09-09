import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { requireCronAuth } from '@/lib/cron-auth'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Fail-closed cron auth
  const authError = requireCronAuth(req)
  if (authError) return authError

  try {
    // Fetch pending requests ordered by priority
    const { data: requests, error } = await getSupabaseAdmin()
      .from('content_requests')
      .select('*')
      .eq('status', 'pending')
      .or('scheduled_at.is.null,scheduled_at.lte.now()')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending requests' })
    }

    const results = []
    for (const request of requests) {
      try {
        // Claim the pending row before starting generation. The previous
        // implementation ignored update failures and could leave an old
        // queued row in `processing` forever even when generation succeeded.
        // Stamping updated_at also gives the stale-processing reaper a precise
        // start point instead of falling back to the request's original
        // created_at timestamp.
        const processingStartedAt = new Date().toISOString()
        const { data: claimed, error: claimError } = await getSupabaseAdmin()
          .from('content_requests')
          .update({
            status: 'processing',
            retry_count: request.retry_count + 1,
            error_message: null,
            updated_at: processingStartedAt,
          })
          .eq('id', request.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()

        if (claimError) throw new Error(`Failed to claim content request: ${claimError.message}`)
        if (!claimed) {
          results.push({ id: request.id, status: 'skipped', reason: 'Request was already claimed by another worker' })
          continue
        }

        // Call the generate API internally
        const generateRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: request.topic,
            context: request.context,
            contentType: request.content_format,
            templateId: request.template_id,
            brandProfileId: request.brand_profile_id,
            regionId: request.region_id,
            evidenceItemIds: request.evidence_item_ids,
            seoMode: request.seo_mode,
          }),
        })

        if (!generateRes.ok) {
          const errorText = await generateRes.text()
          throw new Error(`Generate failed: ${errorText}`)
        }

        // The canonical /api/generate call records its own generation audit
        // row. This queued row still owns the queue state machine and must be
        // moved to a terminal state explicitly; previously it stayed
        // `processing` forever after every successful queue run.
        const completedAt = new Date().toISOString()
        const { data: completed, error: completeError } = await getSupabaseAdmin()
          .from('content_requests')
          .update({
            status: 'completed',
            error_message: null,
            processed_at: completedAt,
            updated_at: completedAt,
          })
          .eq('id', request.id)
          .eq('status', 'processing')
          .select('id')
          .maybeSingle()

        if (completeError) throw new Error(`Failed to complete content request: ${completeError.message}`)
        if (!completed) throw new Error('Content request left processing state before completion could be recorded')

        results.push({ id: request.id, status: 'completed' })
      } catch (err) {
        const errorMessage = getErrorMessage(err)
        const shouldRetry = (request.retry_count ?? 0) < (request.max_retries ?? 3)

        const { error: recoveryError } = await getSupabaseAdmin()
          .from('content_requests')
          .update({
            status: shouldRetry ? 'pending' : 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.id)
          .eq('status', 'processing')

        if (recoveryError) {
          console.error(`[content-requests/process] failed to persist recovery state for ${request.id}:`, recoveryError.message)
        }

        results.push({ id: request.id, status: shouldRetry ? 'retrying' : 'failed', error: errorMessage })
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
