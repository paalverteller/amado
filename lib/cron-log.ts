import { getSupabaseAdmin } from '@/lib/supabase/client'

/**
 * Call at the start of a cron route handler, then finishCronRun() in a
 * finally block (or explicit success/failure branches). Logging failures
 * are swallowed -- a broken log must never take down the actual job.
 * See migration 044 for why this exists alongside the richer
 * domain-specific logs (ingestion_runs, briefing_runs): this is just
 * "did it run" visibility across every cron in one place, not a
 * replacement for those.
 */
export async function startCronRun(jobName: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('cron_runs')
      .insert({ job_name: jobName, status: 'running' })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  } catch (err) {
    console.warn(`[cron-log] failed to start run log for ${jobName}:`, err)
    return null
  }
}

export async function finishCronRun(
  runId: string | null,
  status: 'success' | 'failed',
  detail?: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  if (!runId) return
  try {
    await getSupabaseAdmin()
      .from('cron_runs')
      .update({
        status,
        detail: detail ?? null,
        error_message: errorMessage ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
  } catch (err) {
    console.warn(`[cron-log] failed to finish run log ${runId}:`, err)
  }
}
