import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { startCronRun, finishCronRun } from '@/lib/cron-log'
import { getErrorMessage } from '@/lib/api/error-message'
import { inspectStaleProcessing, reapStaleProcessing } from '@/lib/stale-processing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request): Promise<NextResponse> {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const runId = await startCronRun('stale-processing')
  try {
    const before = await inspectStaleProcessing()
    const reaped = before.total > 0 ? await reapStaleProcessing() : {
      reapedAt: new Date().toISOString(),
      cutoff: before.cutoff,
      thresholdMinutes: before.thresholdMinutes,
      total: 0,
      contentRequests: 0,
      guidelineImports: 0,
    }
    const after = await inspectStaleProcessing()
    const clean = after.total === 0
    const errorMessage = clean ? undefined : `${after.total} stale processing row(s) remain after reaping`

    await finishCronRun(runId, clean ? 'success' : 'failed', { before, reaped, after }, errorMessage)

    return NextResponse.json(
      { status: clean ? 'ok' : 'warning', before, reaped, after },
      { status: clean ? 200 : 503 },
    )
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('[cron/stale-processing] error:', message)
    await finishCronRun(runId, 'failed', undefined, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
