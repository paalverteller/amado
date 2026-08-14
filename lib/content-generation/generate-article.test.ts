import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArticleRepository } from '@/lib/repositories/article-repository'
import type { ContentRequestRepository, NewContentRequestRecord } from '@/lib/repositories/content-request-repository'

const generatedPrompts: Array<{ systemPrompt: string; userPrompt: string }> = []

vi.mock('@/lib/prompts', () => ({
  buildSystemPrompt: vi.fn(async () => ({ systemPrompt: 'SYSTEM', version: 'test-v1' })),
  buildUserPrompt: vi.fn(() => '<task>FINAL TASK</task>'),
  buildLocalizationNotesPrompt: vi.fn(() => 'LOCALIZE'),
  buildRegionContextLayer: vi.fn(async () => '<region>Brazil</region>'),
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
    let recorded: NewContentRequestRecord | null = null
    let linkedEvidence: string[] = []
    let articlePayload: Parameters<ArticleRepository['create']>[0] | null = null

    const contentRequests: ContentRequestRepository = {
      record: async (data) => { recorded = data; return { id: 'request-1' } },
      markCompleted: async () => undefined,
      markFailed: async () => undefined,
      getById: async () => null,
      getThread: async () => [],
      linkEvidence: async (_requestId, ids) => { linkedEvidence = ids },
    }
    const articles: ArticleRepository = {
      create: async (data) => { articlePayload = data; return { id: 'article-1', error: null } },
    }

    const result = await generateAndPersistArticle({
      topic: 'Automação de CRM', context: 'Sinal recente do mercado brasileiro', contentType: 'linkedin_post',
      brandProfileId: 'brand-1', evidenceItemIds: ['market-evidence-1'], marketingCampaignId: 'campaign-1',
    }, { contentRequests, articles })

    expect(generatedPrompts[0].systemPrompt).toContain('<brand>Bitrix24</brand>')
    expect(generatedPrompts[0].userPrompt).toContain('<evidence_context>market evidence</evidence_context>')
    expect(generatedPrompts[0].userPrompt).toContain('<competitor_context>fresh competitor signal</competitor_context>')
    expect(generatedPrompts[0].userPrompt).toContain('<knowledge_context>competitor review + brand research</knowledge_context>')
    expect(recorded?.knowledge_chunk_ids).toEqual(['chunk-1'])
    expect(recorded?.evidence_item_ids).toEqual(['market-evidence-1'])
    expect(linkedEvidence).toEqual(['market-evidence-1'])
    expect(articlePayload?.content_type).toBe('social_post')
    expect(articlePayload?.marketing_campaign_id).toBe('campaign-1')
    expect(result.articleId).toBe('article-1')
    expect(result.usedContext.competitorSignals[0].competitor).toBe('Competitor A')
  })
})
