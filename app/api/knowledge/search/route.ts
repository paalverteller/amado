import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseKnowledgeRepository } from '@/lib/repositories/knowledge-repository'
import { embedTexts, isEmbeddingConfigured } from '@/lib/knowledge/embeddings'
import { isFeatureEnabled } from '@/lib/amado-config'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

type SearchBody = {
  query?: string
  brandId?: string
  retrievalMode?: string
  limit?: number
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as SearchBody
    const query = body.query?.trim()
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 })

    const limit = Math.min(Math.max(body.limit ?? 8, 1), 30)
    const repo = createSupabaseKnowledgeRepository()
    const useSemantic = isFeatureEnabled('hybridSearchEnabled') && isEmbeddingConfigured()

    if (useSemantic) {
      try {
        const [embedding] = await embedTexts([query])
        const items = await repo.searchSemantic(embedding, {
          brandId: body.brandId ?? null,
          retrievalMode: body.retrievalMode ?? null,
          limit,
        })
        return NextResponse.json({ items, mode: 'semantic' })
      } catch (semanticError) {
        console.warn('[knowledge/search] semantic search failed, falling back to keyword:', getErrorMessage(semanticError))
      }
    }

    const items = await repo.searchKeyword({
      query,
      brandId: body.brandId ?? null,
      retrievalMode: body.retrievalMode ?? null,
      limit,
    })
    return NextResponse.json({ items, mode: 'keyword' })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
