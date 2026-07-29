import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
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
        // Mark as processing
        await getSupabaseAdmin()
          .from('content_requests')
          .update({ status: 'processing', retry_count: request.retry_count + 1 })
          .eq('id', request.id)

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

        results.push({ id: request.id, status: 'completed' })
      } catch (err) {
        const errorMessage = getErrorMessage(err)
        const shouldRetry = (request.retry_count ?? 0) < (request.max_retries ?? 3)

        await getSupabaseAdmin()
          .from('content_requests')
          .update({
            status: shouldRetry ? 'pending' : 'failed',
            error_message: errorMessage,
          })
          .eq('id', request.id)

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
