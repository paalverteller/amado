import { NextRequest, NextResponse } from 'next/server'
import { runBriefing } from '@/lib/briefing'
import { requireCronAuth } from '@/lib/cron-auth'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    const result = await runBriefing()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/briefing] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
