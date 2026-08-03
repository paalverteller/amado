import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseKnowledgeRepository } from '@/lib/repositories/knowledge-repository'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const { id } = await params
    const repo = createSupabaseKnowledgeRepository()
    const asset = await repo.get(id)
    if (!asset) return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 })
    return NextResponse.json(asset)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

const ALLOWED_PATCH = ['title', 'collection', 'retrieval_mode', 'active']

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const { id } = await params
    const body = (await req.json()) as Record<string, unknown>

    const patch: Record<string, unknown> = {}
    for (const key of ALLOWED_PATCH) {
      if (key in body) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const repo = createSupabaseKnowledgeRepository()
    const updated = await repo.update(id, patch)
    if (!updated) return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const { id } = await params
    const repo = createSupabaseKnowledgeRepository()
    await repo.remove(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
