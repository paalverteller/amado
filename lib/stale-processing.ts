import { getSupabaseAdmin } from '@/lib/supabase/client'

// FABLE_REVIEW_PHASE3B_STALE_PROCESSING_20260909
export const STALE_PROCESSING_THRESHOLD_MINUTES = 15
const SAMPLE_LIMIT = 20

export interface StaleProcessingSample {
  id: string
  startedAt: string
}

export interface StaleProcessingBucket {
  count: number
  oldestStartedAt: string | null
  sample: StaleProcessingSample[]
}

export interface StaleProcessingReport {
  checkedAt: string
  cutoff: string
  thresholdMinutes: number
  total: number
  contentRequests: StaleProcessingBucket
  guidelineImports: StaleProcessingBucket
}

export interface StaleProcessingReapResult {
  reapedAt: string
  cutoff: string
  thresholdMinutes: number
  total: number
  contentRequests: number
  guidelineImports: number
}

export function buildStaleProcessingCutoff(
  now: Date = new Date(),
  thresholdMinutes = STALE_PROCESSING_THRESHOLD_MINUTES,
): string {
  return new Date(now.getTime() - thresholdMinutes * 60_000).toISOString()
}

export function buildStaleProcessingTimeoutMessage(kind: 'content_request' | 'guideline_import'): string {
  const label = kind === 'content_request' ? 'Content request' : 'Guideline import'
  return `${label} automatically failed after remaining in processing for more than ${STALE_PROCESSING_THRESHOLD_MINUTES} minutes.`
}

function bucketFromRows(
  rows: Array<{ id: string; started_at: string }> | null,
  count: number | null,
): StaleProcessingBucket {
  const sample = (rows ?? []).map((row) => ({ id: row.id, startedAt: row.started_at }))
  return {
    count: count ?? sample.length,
    oldestStartedAt: sample[0]?.startedAt ?? null,
    sample,
  }
}

export async function inspectStaleProcessing(now: Date = new Date()): Promise<StaleProcessingReport> {
  const admin = getSupabaseAdmin()
  const cutoff = buildStaleProcessingCutoff(now)

  const [contentResult, guidelineResult] = await Promise.all([
    admin
      .from('content_requests')
      .select('id, started_at:updated_at', { count: 'exact' })
      .eq('status', 'processing')
      .lt('updated_at', cutoff)
      .order('updated_at', { ascending: true })
      .limit(SAMPLE_LIMIT),
    admin
      .from('guideline_import_runs')
      .select('id, started_at:created_at', { count: 'exact' })
      .eq('status', 'processing')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(SAMPLE_LIMIT),
  ])

  if (contentResult.error) throw new Error(`content_requests stale check failed: ${contentResult.error.message}`)
  if (guidelineResult.error) throw new Error(`guideline_import_runs stale check failed: ${guidelineResult.error.message}`)

  const contentRequests = bucketFromRows(
    contentResult.data as Array<{ id: string; started_at: string }> | null,
    contentResult.count,
  )
  const guidelineImports = bucketFromRows(
    guidelineResult.data as Array<{ id: string; started_at: string }> | null,
    guidelineResult.count,
  )

  return {
    checkedAt: now.toISOString(),
    cutoff,
    thresholdMinutes: STALE_PROCESSING_THRESHOLD_MINUTES,
    total: contentRequests.count + guidelineImports.count,
    contentRequests,
    guidelineImports,
  }
}

export async function reapStaleProcessing(now: Date = new Date()): Promise<StaleProcessingReapResult> {
  const admin = getSupabaseAdmin()
  const cutoff = buildStaleProcessingCutoff(now)
  const reapedAt = now.toISOString()

  const [contentResult, guidelineResult] = await Promise.all([
    admin
      .from('content_requests')
      .update({
        status: 'failed',
        error_message: buildStaleProcessingTimeoutMessage('content_request'),
        updated_at: reapedAt,
      })
      .eq('status', 'processing')
      .lt('updated_at', cutoff)
      .select('id'),
    admin
      .from('guideline_import_runs')
      .update({
        status: 'failed',
        error_summary: JSON.stringify({
          code: 'stale_processing_timeout',
          message: buildStaleProcessingTimeoutMessage('guideline_import'),
        }),
      })
      .eq('status', 'processing')
      .lt('created_at', cutoff)
      .select('id'),
  ])

  if (contentResult.error) throw new Error(`content_requests stale reap failed: ${contentResult.error.message}`)
  if (guidelineResult.error) throw new Error(`guideline_import_runs stale reap failed: ${guidelineResult.error.message}`)

  const contentRequests = contentResult.data?.length ?? 0
  const guidelineImports = guidelineResult.data?.length ?? 0

  return {
    reapedAt,
    cutoff,
    thresholdMinutes: STALE_PROCESSING_THRESHOLD_MINUTES,
    total: contentRequests + guidelineImports,
    contentRequests,
    guidelineImports,
  }
}
