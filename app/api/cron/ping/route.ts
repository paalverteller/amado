import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { requireCronAuth } from '@/lib/cron-auth'
import { startCronRun, finishCronRun } from '@/lib/cron-log'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const runId = await startCronRun('ping')
  try {
    // Ping Supabase to keep it alive (7 days inactivity timer)
    const { error } = await getSupabaseAdmin().from('rss_sources').select('id').limit(1)

    if (error) throw error

    await finishCronRun(runId, 'success')
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Supabase is kept alive',
      timestamp: new Date().toISOString() 
    })
  } catch (error) {
    await finishCronRun(runId, 'failed', undefined, getErrorMessage(error))
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}