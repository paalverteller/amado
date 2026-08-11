import { getSupabaseAdmin } from '@/lib/supabase/client'
import type { TokenUsage } from '@/lib/ai'

function envNumber(key: string, defaultValue: number): number {
  const val = process.env[key]
  if (val === undefined) return defaultValue
  const n = Number(val)
  return Number.isFinite(n) ? n : defaultValue
}

/**
 * Records one AI call for cost visibility. Fire-and-forget: a logging
 * failure must never break the feature that generated the content --
 * this never throws.
 */
export async function recordAiUsage(feature: string, model: string, usage: TokenUsage | null): Promise<void> {
  try {
    await getSupabaseAdmin().from('ai_usage_log').insert({
      feature,
      model,
      prompt_tokens: usage?.promptTokens ?? null,
      completion_tokens: usage?.completionTokens ?? null,
      total_tokens: usage?.totalTokens ?? null,
    })
  } catch (err) {
    console.warn('[ai-usage] failed to record usage (non-critical):', err)
  }
}

export interface BudgetCheckResult {
  withinBudget: boolean
  callsToday: number
  limit: number
}

/**
 * Simple call-count budget for a 24h rolling window. Call count, not
 * token count, is the reliable signal here -- not every provider path
 * reports tokens (see lib/ai.ts's TokenUsage, null for the DeepSeek
 * path), so a token-based cap would silently under-count.
 *
 * Only wired into cron-triggered features that are safe to skip a day
 * (lib/briefing.ts) -- deliberately NOT applied to /api/generate or
 * on-demand competitor reviews, both human-initiated actions where a
 * silent budget block would be a confusing product regression, not a
 * cost-safety win. Those still log usage via recordAiUsage above for
 * visibility; they just don't get blocked by this check.
 */
export async function checkDailyAiBudget(feature?: string): Promise<BudgetCheckResult> {
  const limit = envNumber('AMADO_MAX_AI_CALLS_PER_DAY', 500)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  let query = getSupabaseAdmin()
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  if (feature) query = query.eq('feature', feature)

  const { count, error } = await query
  if (error) {
    console.warn('[ai-usage] budget check failed, defaulting to within-budget:', error.message)
    return { withinBudget: true, callsToday: 0, limit }
  }

  const callsToday = count ?? 0
  return { withinBudget: callsToday < limit, callsToday, limit }
}
