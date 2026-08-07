import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseContentRequestRepository } from '@/lib/repositories/content-request-repository'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params
    const repo = createSupabaseContentRequestRepository()

    const request = await repo.getById(id)
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const thread = request.thread_id ? await repo.getThread(request.thread_id) : [request]

    return NextResponse.json({ request, thread })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
