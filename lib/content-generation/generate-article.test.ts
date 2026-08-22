import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArticleRepository } from '@/lib/repositories/article-repository'
import type { ContentRequestRepository, NewContentRequestRecord } from '@/lib/repositories/content-request-repository'

const generatedPrompts: Array<{ systemPrompt: string; userPrompt: string }> = []

vi.mock('@/lib/prompts', () => ({
  buildSystemPrompt: vi.fn(async () => ({ systemPrompt: 'SYSTEM', version: 'test-v1' })),
  buildUserPrompt: vi.fn(() => '<task>FINAL TASK</task>'),
  buildLocalizationNotesPrompt: vi.fn(() => 'LOCALIZE'),
  buildRegionContextLayer: vi.fn(async () => '<region>Brazil</region>'),
  resolveRegionProfile: vi.fn(async () => ({ code: 'BR', name: 'Brazil', locale: 'pt-BR', languageName: 'Portuguese (Brazil)' })),
  buildEvidenceContext: vi.fn(async (ids?: string[]) => ids?.length ? '<evidence_context>market evidence</evidence_context>' : ''),
  buildKnowledgeContext: vi.fn(async () => ({
    promptText: '<knowledge_context>competitor review + brand research</knowledge_context>',
    chunks: [{ chunkId: 'chunk-1', assetId: 'asset-1', assetTitle: 'Competitor review', snippet: 'review snippet', similarity: 0.9 }],
  })),
  buildCompetitorContext: vi.fn(async () => ({
    promptText: '<competitor_context>fresh competitor signal</competitor_context>',
    signals: [{ evidenceId: 'comp-evidence-1', competitor: 'Competitor A', title: 'New launch', publishedAt: null }],
  })),
}))

vi.mock('@/lib/brand-snapshot', () => ({
  buildBrandSnapshot: vi.fn(async () => ({ promptText: '<brand>Bitrix24</brand>', facts: [{ category: 'voice', label: 'Direto' }] })),
  resolveBrandRegionId: vi.fn(async () => null),
}))
vi.mock('@/lib/evidence', () => ({ getRecentEvidenceContext: vi.fn(async () => ({ text: '', ids: [], items: [] })) }))
vi.mock('@/lib/ai-usage', () => ({ recordAiUsage: vi.fn(async () => undefined) }))
vi.mock('@/lib/ai', () => ({
  generateArticleWithFallback: vi.fn(async (args: { systemPrompt: string; userPrompt: string }) => {
    generatedPrompts.push(args)
    return { text: 'Conteúdo final para o LinkedIn.', model: 'test-model', usage: null }
  }),
  generateWithFallback: vi.fn(async () => ({
    textStream: (async function* () { yield 'Notas de localização' })(),
  })),
}))

import { generateAndPersistArticle } from './generate-article'

describe('canonical content generation chain', () => {
  beforeEach(() => { generatedPrompts.length = 0 })

  it('carries market evidence + competitor signals + knowledge + Brand OS into a social generation and persists exact lineage', async () => {
    const recorded: NewContentRequestRecord[] = []
    let linkedEvidence: string[] = []
    const articlePayloads: Array<Parameters<ArticleRepository['create']>[0]> = []

    const contentRequests: ContentRequestRepository = {
      record: async (data) => { recorded.push(data); return { id: 'request-1' } },
      markCompleted: async () => undefined,
      markFailed: async () => undefined,
      getById: async () => null,
      getThread: async () => [],
      linkEvidence: async (_requestId, ids) => { linkedEvidence = ids },
    }
    const articles: ArticleRepository = {
      create: async (data) => { articlePayloads.push(data); return { id: 'article-1', error: null } },
    }

    const result = await generateAndPersistArticle({
      topic: 'Automação de CRM', context: 'Sinal recente do mercado brasileiro', contentType: 'linkedin_post',
      brandProfileId: 'brand-1', evidenceItemIds: ['market-evidence-1'], marketingCampaignId: 'campaign-1',
    }, { contentRequests, articles })

    expect(generatedPrompts[0].systemPrompt).toContain('<brand>Bitrix24</brand>')
    expect(generatedPrompts[0].userPrompt).toContain('<evidence_context>market evidence</evidence_context>')
    expect(generatedPrompts[0].userPrompt).toContain('<competitor_context>fresh competitor signal</competitor_context>')
    expect(generatedPrompts[0].userPrompt).toContain('<knowledge_context>competitor review + brand research</knowledge_context>')
    expect(recorded[0]?.knowledge_chunk_ids).toEqual(['chunk-1'])
    expect(recorded[0]?.evidence_item_ids).toEqual(['market-evidence-1'])
    expect(recorded[0]?.locale).toBe('pt-BR')
    expect(linkedEvidence).toEqual(['market-evidence-1'])
    expect(articlePayloads[0]?.content_type).toBe('social_post')
    expect(articlePayloads[0]?.marketing_campaign_id).toBe('campaign-1')
    expect(result.articleId).toBe('article-1')
    expect(result.usedContext.competitorSignals[0].competitor).toBe('Competitor A')
  })

  it('threads a resolved non-Brazil region profile into the persisted locale', async () => {
    const { resolveRegionProfile } = await import('@/lib/prompts')
    vi.mocked(resolveRegionProfile).mockResolvedValueOnce({
      code: 'ES', name: 'España', locale: 'es-ES', languageName: 'Spanish (Spain)',
    })

    const recorded: NewContentRequestRecord[] = []
    const contentRequests: ContentRequestRepository = {
      record: async (data) => { recorded.push(data); return { id: 'request-2' } },
      markCompleted: async () => undefined,
      markFailed: async () => undefined,
      getById: async () => null,
      getThread: async () => [],
      linkEvidence: async () => undefined,
    }
    const articlePayloads: Array<Parameters<ArticleRepository['create']>[0]> = []
    const articles: ArticleRepository = {
      create: async (data) => { articlePayloads.push(data); return { id: 'article-2', error: null } },
    }

    await generateAndPersistArticle({
      topic: 'Lanzamiento de producto', contentType: 'article', regionId: 'region-es', brandProfileId: 'brand-1',
    }, { contentRequests, articles })

    expect(resolveRegionProfile).toHaveBeenCalledWith('region-es')
    expect(recorded[0]?.locale).toBe('es-ES')
    expect(articlePayloads[0]?.locale).toBe('es-ES')
  })

  it('derives the region from the brand when no explicit regionId is passed (Phase 4)', async () => {
    const { resolveRegionProfile } = await import('@/lib/prompts')
    const { resolveBrandRegionId } = await import('@/lib/brand-snapshot')
    vi.mocked(resolveBrandRegionId).mockResolvedValueOnce('region-es-from-brand')
    vi.mocked(resolveRegionProfile).mockImplementation(async (regionId) =>
      regionId === 'region-es-from-brand'
        ? { code: 'ES', name: 'España', locale: 'es-ES', languageName: 'Spanish (Spain)' }
        : { code: 'BR', name: 'Brazil', locale: 'pt-BR', languageName: 'Portuguese (Brazil)' }
    )

    const recorded: NewContentRequestRecord[] = []
    const contentRequests: ContentRequestRepository = {
      record: async (data) => { recorded.push(data); return { id: 'request-3' } },
      markCompleted: async () => undefined,
      markFailed: async () => undefined,
      getById: async () => null,
      getThread: async () => [],
      linkEvidence: async () => undefined,
    }
    const articlePayloads: Array<Parameters<ArticleRepository['create']>[0]> = []
    const articles: ArticleRepository = {
      create: async (data) => { articlePayloads.push(data); return { id: 'article-3', error: null } },
    }

    // No regionId in the call -- only brandProfileId. This is the shape
    // every real request sends today (see app/generate/page.tsx): the
    // region must come from the brand, not a second field the caller
    // never populates.
    await generateAndPersistArticle({
      topic: 'Lanzamiento de producto', contentType: 'article', brandProfileId: 'brand-es-1',
    }, { contentRequests, articles })

    expect(resolveBrandRegionId).toHaveBeenCalledWith('brand-es-1')
    expect(resolveRegionProfile).toHaveBeenCalledWith('region-es-from-brand')
    expect(recorded[0]?.region_id).toBe('region-es-from-brand')
    expect(recorded[0]?.locale).toBe('es-ES')
    expect(articlePayloads[0]?.region_id).toBe('region-es-from-brand')
    expect(articlePayloads[0]?.locale).toBe('es-ES')
  })

  it('an explicit regionId always wins over the brand-derived one', async () => {
    const { resolveBrandRegionId } = await import('@/lib/brand-snapshot')
    const spy = vi.mocked(resolveBrandRegionId)
    spy.mockClear() // earlier tests in this file already called this mock

    const contentRequests: ContentRequestRepository = {
      record: async () => ({ id: 'request-4' }),
      markCompleted: async () => undefined,
      markFailed: async () => undefined,
      getById: async () => null,
      getThread: async () => [],
      linkEvidence: async () => undefined,
    }
    const articles: ArticleRepository = {
      create: async () => ({ id: 'article-4', error: null }),
    }

    await generateAndPersistArticle({
      topic: 'tema', contentType: 'article', regionId: 'region-explicit', brandProfileId: 'brand-1',
    }, { contentRequests, articles })

    // resolveBrandRegionId must not even be called when regionId is
    // already explicit -- no reason to spend a DB round-trip resolving a
    // value that will be discarded.
    expect(spy).not.toHaveBeenCalled()
  })
})