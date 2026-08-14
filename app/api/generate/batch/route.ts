import { NextRequest, NextResponse } from 'next/server'
import { generateAndPersistArticle } from '@/lib/content-generation/generate-article'
import { isValidContentFormat } from '@/lib/content-formats'
import { GENERATION_CONFIG } from '@/lib/amado-config'
import { getErrorMessage } from '@/lib/api/error-message'
import { resolveDefaultBrandProfileId } from '@/lib/brand-snapshot'
import type { ContentFormat } from '@/lib/content-formats'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

type BatchTopic = { title: string; context: string; contentType?: string; evidenceItemId?: string }
type BatchBody = {
  topics?: BatchTopic[]
  templateId?: string
  brandProfileId?: string
  regionId?: string
  evidenceItemIds?: string[]
  marketingCampaignId?: string
}
type BatchResult = { topic: string; status: 'ok' | 'error'; articleId?: string; contentRequestId?: string; error?: string }

const MAX_BATCH_SIZE = GENERATION_CONFIG.maxBatchSize

/**
 * Batch generation now delegates to the same canonical pipeline as /api/generate.
 * That guarantees BrandSnapshot + market evidence + direct competitor evidence +
 * Knowledge/RAG + persistence/usage logging are identical for single and batch.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as BatchBody
    const topics = body.topics ?? []
    if (topics.length === 0) return NextResponse.json({ error: 'Topic list is empty' }, { status: 400 })
    if (topics.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `Maximum ${MAX_BATCH_SIZE} topics per batch` }, { status: 400 })
    }

    const resolvedBrandProfileId = await resolveDefaultBrandProfileId(body.brandProfileId)
    const results: BatchResult[] = []
    for (const item of topics) {
      const title = (item.title ?? '').trim()
      const context = (item.context ?? item.title ?? '').trim()
      const contentType = (item.contentType ?? 'article') as ContentFormat
      if (!title || !context) {
        results.push({ topic: title || '(no topic)', status: 'error', error: 'Empty topic' })
        continue
      }
      if (!isValidContentFormat(contentType)) {
        results.push({ topic: title, status: 'error', error: `Invalid format: ${contentType}` })
        continue
      }

      try {
        const generated = await generateAndPersistArticle({
          topic: title,
          context,
          contentType,
          templateId: body.templateId,
          brandProfileId: resolvedBrandProfileId ?? undefined,
          regionId: body.regionId,
          evidenceItemIds: item.evidenceItemId ? [item.evidenceItemId] : body.evidenceItemIds,
          marketingCampaignId: body.marketingCampaignId,
        })
        results.push({
          topic: title,
          status: 'ok',
          articleId: generated.articleId ?? undefined,
          contentRequestId: generated.contentRequestId ?? undefined,
        })
      } catch (error) {
        results.push({ topic: title, status: 'error', error: getErrorMessage(error) })
      }
    }

    return NextResponse.json({
      results,
      total: topics.length,
      succeeded: results.filter((result) => result.status === 'ok').length,
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
