import { NextRequest, NextResponse } from 'next/server'
import { generateAndPersistArticle } from '@/lib/content-generation/generate-article'
import { isValidContentFormat } from '@/lib/content-formats'
import type { ContentFormat } from '@/lib/content-formats'
import { getErrorMessage } from '@/lib/api/error-message'
import { resolveDefaultBrandProfileId } from '@/lib/brand-snapshot'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

type GenerateBody = {
  topic?: string
  context?: string
  contentType?: string
  templateId?: string
  brandProfileId?: string
  seoMode?: boolean
  regionId?: string
  evidenceItemIds?: string[]
  parentRequestId?: string
  refinementNote?: string
  marketingCampaignId?: string
}

function textToAiSdkLikeStream(text: string, metadata: unknown): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`))
      // 'm:' is not part of the AI-SDK stream protocol this format
      // otherwise mimics -- the client's reader loop treats it as
      // metadata to parse, not text to display. Kept in the body (not a
      // response header) since usedContext can contain Cyrillic brand
      // fact labels, which HTTP headers can't safely carry.
      controller.enqueue(encoder.encode(`m:${JSON.stringify(metadata)}\n`))
      controller.close()
    },
  })
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as GenerateBody
    const { topic, context, templateId, brandProfileId, seoMode = false, regionId, evidenceItemIds, parentRequestId, refinementNote, marketingCampaignId } = body
    const contentType = (body.contentType ?? 'article') as ContentFormat

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    // Validate content format
    if (!isValidContentFormat(contentType)) {
      return NextResponse.json(
        { error: `Invalid content format: "${contentType}"` },
        { status: 400 }
      )
    }

    const resolvedBrandProfileId = await resolveDefaultBrandProfileId(brandProfileId)
    const result = await generateAndPersistArticle({
      topic,
      context,
      contentType,
      templateId,
      brandProfileId: resolvedBrandProfileId ?? undefined,
      seoMode,
      regionId,
      evidenceItemIds,
      parentRequestId,
      refinementNote,
      marketingCampaignId,
    })

    const metadata = { contentRequestId: result.contentRequestId, articleId: result.articleId, usedContext: result.usedContext }

    return new Response(textToAiSdkLikeStream(result.text, metadata), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Generation-Model': result.model,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}