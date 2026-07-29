import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cron-auth'
import { CRON_CONFIG } from '@/lib/amado-config'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const THROTTLE_HOURS = CRON_CONFIG.marketRefreshThrottleHours
const STATE_KEY = 'market_refresh_last_run'

export async function GET(request: Request): Promise<NextResponse> {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const admin = getSupabaseAdmin()

    const { data: stateRow } = await admin
      .from('cron_state')
      .select('last_run_at')
      .eq('key', STATE_KEY)
      .maybeSingle()

    const lastRun = stateRow?.last_run_at ? new Date(stateRow.last_run_at).getTime() : 0
    const hoursSince = (Date.now() - lastRun) / (1000 * 60 * 60)

    if (lastRun && hoursSince < THROTTLE_HOURS) {
      return NextResponse.json({
        status: 'skipped',
        reason: `Only ${hoursSince.toFixed(1)}h since last run, need ${THROTTLE_HOURS}h`,
      })
    }

    // Trigger the existing market refresh logic via internal fetch
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/market/refresh`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))

    await admin
      .from('cron_state')
      .upsert({ key: STATE_KEY, last_run_at: new Date().toISOString() }, { onConflict: 'key' })

    return NextResponse.json({ status: 'ok', marketRefreshResult: data })
  } catch (err) {
    console.error('[cron/market-refresh] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
