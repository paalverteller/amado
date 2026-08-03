import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseKnowledgeRepository } from '@/lib/repositories/knowledge-repository'
import { processKnowledgeAsset } from '@/lib/knowledge/process-asset'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_CONTENT_TYPES = ['book', 'report', 'note', 'transcript', 'guideline', 'competitor_note', 'other']
const VALID_RETRIEVAL_MODES = ['idea', 'evidence', 'brand']

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const repo = createSupabaseKnowledgeRepository()
    const items = await repo.list({
      brandId: searchParams.get('brandId') ?? undefined,
      collection: searchParams.get('collection') ?? undefined,
      retrievalMode: searchParams.get('retrievalMode') ?? undefined,
      activeOnly: searchParams.get('activeOnly') === 'true',
    })
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

type CreateBody = {
  title?: string
  contentType?: string
  rawText?: string
  collection?: string
  retrievalMode?: string
  brandId?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as CreateBody
    const title = body.title?.trim()
    const rawText = body.rawText?.trim()
    const contentType = body.contentType ?? 'note'
    const retrievalMode = body.retrievalMode ?? 'idea'

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!rawText) return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    if (!VALID_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json({ error: `Invalid contentType: "${contentType}"` }, { status: 400 })
    }
    if (!VALID_RETRIEVAL_MODES.includes(retrievalMode)) {
      return NextResponse.json({ error: `Invalid retrievalMode: "${retrievalMode}"` }, { status: 400 })
    }

    const repo = createSupabaseKnowledgeRepository()
    const asset = await repo.create({
      brand_id: body.brandId ?? null,
      title,
      content_type: contentType,
      raw_text: rawText,
      collection: body.collection?.trim() || null,
      retrieval_mode: retrievalMode,
      source_note: null,
    })

    try {
      await processKnowledgeAsset(asset.id)
    } catch (processError) {
      // The row exists and processKnowledgeAsset already marked it
      // 'error' with a message — surface the failure, don't pretend
      // nothing was created.
      return NextResponse.json(
        { error: getErrorMessage(processError), assetId: asset.id },
        { status: 502 },
      )
    }

    const ready = await repo.get(asset.id)
    return NextResponse.json(ready, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
