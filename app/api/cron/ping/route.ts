import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { requireCronAuth } from '@/lib/cron-auth'
import { startCronRun, finishCronRun } from '@/lib/cron-log'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

const KEEPALIVE_INTERVAL_DAYS = 5
const DAY_MS = 24 * 60 * 60 * 1000

export function shouldRunSupabaseKeepalive(now = new Date()): boolean {
  const utcDay = Math.floor(now.getTime() / DAY_MS)
  return utcDay % KEEPALIVE_INTERVAL_DAYS === 0
}

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  // Vercel invokes this route daily, but the gate runs before any Supabase call.
  // That keeps actual database activity on a deterministic five-day cadence.
  if (!shouldRunSupabaseKeepalive()) {
    return NextResponse.json({
      status: 'skipped',
      message: 'Supabase keepalive is not due today',
      timestamp: new Date().toISOString(),
    })
  }

  const runId = await startCronRun('ping')
  try {
    const { error } = await getSupabaseAdmin().from('rss_sources').select('id').limit(1)

    if (error) throw error

    await finishCronRun(runId, 'success')
    return NextResponse.json({
      status: 'ok',
      message: 'Supabase keepalive query completed',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    await finishCronRun(runId, 'failed', undefined, getErrorMessage(error))
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}