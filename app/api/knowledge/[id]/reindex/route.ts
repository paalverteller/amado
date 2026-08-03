import { NextRequest, NextResponse } from 'next/server'
import { processKnowledgeAsset } from '@/lib/knowledge/process-asset'
import { createSupabaseKnowledgeRepository } from '@/lib/repositories/knowledge-repository'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Ctx { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const { id } = await params
    await processKnowledgeAsset(id)
    const repo = createSupabaseKnowledgeRepository()
    const asset = await repo.get(id)
    if (!asset) return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 })
    return NextResponse.json(asset)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
