import { NextRequest, NextResponse } from 'next/server'
import { generatePerformanceHypothesis } from '@/lib/performance-hypothesis'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

export const maxDuration = 30

export async function POST(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const result = await generatePerformanceHypothesis(id)
    return NextResponse.json(result, { status: result.status === 'failed' ? 400 : 200 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
