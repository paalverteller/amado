import { buildSystemPrompt, buildUserPrompt, buildLocalizationNotesPrompt, buildRegionContextLayer, resolveRegionProfile, buildEvidenceContext, buildKnowledgeContext, buildCompetitorContext } from '@/lib/prompts'
import { buildBrandSnapshot, resolveBrandRegionId } from '@/lib/brand-snapshot'
import { getRecentEvidenceContext } from '@/lib/evidence'
import { generateArticleWithFallback, generateWithFallback } from '@/lib/ai'
import { recordAiUsage } from '@/lib/ai-usage'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { mapToLegacyContentType } from '@/lib/content-formats'
import type { ContentFormat } from '@/lib/content-formats'
import crypto from 'crypto'
import {
  createSupabaseContentRequestRepository,
  type ContentRequestRepository,
} from '@/lib/repositories/content-request-repository'
import {
  createSupabaseArticleRepository,
  type ArticleRepository,
} from '@/lib/repositories/article-repository'

export interface GenerateArticleInput {
  topic: string
  context?: string
  contentType: ContentFormat
  templateId?: string
  brandProfileId?: string
  seoMode?: boolean
  regionId?: string
  evidenceItemIds?: string[]
  /** Refine a previous generation instead of starting a fresh topic. */
  parentRequestId?: string
  refinementNote?: string
  marketingCampaignId?: string
}

export interface GenerateArticleDeps {
  contentRequests: ContentRequestRepository
  articles: ArticleRepository
}

export interface GenerateArticleResult {
  text: string
  model: string
  contentRequestId: string | null
  articleId: string | null
  /** What actually went into the prompt -- for the "visible context" UI. */
  usedContext: {
    brandFacts: { category: string; label: string }[]
    knowledgeChunks: { chunkId: string; assetId: string; assetTitle: string; snippet: string }[]
    competitorSignals: { evidenceId: string; competitor: string; title: string; publishedAt: string | null }[]
  }
}

function defaultDeps(): GenerateArticleDeps {
  return {
    contentRequests: createSupabaseContentRequestRepository(),
    articles: createSupabaseArticleRepository(),
  }
}

/**
 * Full generate-and-persist workflow: assembles the prompt from the
 * template, brand snapshot (Sprint 4 Brand OS tables), region context,
 * evidence, and retrieved knowledge (Sprint 3 library + Sprint 7
 * competitor reviews, same search), calls the AI provider fallback
 * chain, then persists both a content_requests record and the
 * resulting article.
 *
 * If persisting the article fails, the content request is marked
 * 'failed' and the error is re-thrown — callers must not treat a
 * resolved promise as "the article was saved" without checking for this.
 *
 * `deps` defaults to the real Supabase-backed repositories; pass fakes
 * here to unit-test this function without a database.
 */
export async function generateAndPersistArticle(
  input: GenerateArticleInput,
  deps: GenerateArticleDeps = defaultDeps(),
): Promise<GenerateArticleResult> {
  const trimmedTopic = input.topic.trim()
  const promptTopic = (input.context && input.context.trim()) ? input.context.trim() : trimmedTopic
  const seoMode = input.seoMode ?? false

  // Refinement: pull the parent version's content + thread so this
  // generation is recorded as part of the same version chain, not a
  // fresh unrelated topic.
  let parent: Awaited<ReturnType<ContentRequestRepository['getById']>> = null
  if (input.parentRequestId) {
    parent = await deps.contentRequests.getById(input.parentRequestId)
  }
  const threadId = parent?.thread_id ?? crypto.randomUUID()

  // Stage 3: Use evidence_items instead of rss_items
  const selectedEvidenceContext = await buildEvidenceContext(input.evidenceItemIds)
  const recentEvidence = selectedEvidenceContext ? { text: '', ids: [], items: [] } : await getRecentEvidenceContext(trimmedTopic)
  const rssText = selectedEvidenceContext || recentEvidence.text
  const evidenceIdsUsed = input.evidenceItemIds?.length ? input.evidenceItemIds : recentEvidence.ids

  const built = await buildSystemPrompt(input.templateId)
  const brandSnapshot = await buildBrandSnapshot(input.brandProfileId, input.contentType)
  // Sprint 12 Phase 4: derive the region from the chosen brand when the
  // caller didn't pass one explicitly. A brand is scoped to one market --
  // trusting the caller to also independently pass a matching regionId
  // risks the two silently drifting apart (e.g. a future UI bug sends a
  // Spain brandProfileId with the previous session's Brazil regionId still
  // cached). input.regionId stays authoritative when a caller does pass
  // it explicitly -- this is a fallback, not an override.
  const effectiveRegionId = input.regionId ?? await resolveBrandRegionId(input.brandProfileId)
  const regionContext = await buildRegionContextLayer(effectiveRegionId)
  const regionProfile = await resolveRegionProfile(effectiveRegionId)
  const knowledge = await buildKnowledgeContext(promptTopic, input.brandProfileId)
  const competitorContext = await buildCompetitorContext(promptTopic, input.brandProfileId)

  // Build structured content spec — no contradictory length rules
  const contentSpec = {
    topic: promptTopic,
    format: input.contentType,
    seoMode,
    brandProfileId: input.brandProfileId ?? null,
    regionContext: {
      locale: regionProfile.locale,
      regionName: regionProfile.name,
      languageName: regionProfile.languageName,
    },
  }

  const systemPrompt = `${built.systemPrompt}${brandSnapshot.promptText ? '\n\n' + brandSnapshot.promptText : ''}${regionContext ? '\n\n' + regionContext : ''}

TARGET MARKET OVERRIDE:
- Target market: ${regionProfile.name}
- Target locale: ${regionProfile.locale}
- Output language: ${regionProfile.languageName}
- These target-market instructions override any Brazil/Portuguese market assumptions in the stored base template when the target market is not Brazil.

STRICT OUTPUT FORMAT:
Write only the final clean text for publication. No think tags. No Markdown.`

  const sections: string[] = []
  if (rssText) sections.push(`${regionProfile.name.toUpperCase()} MARKET SIGNALS:\n${rssText}`)
  if (selectedEvidenceContext) sections.push(`EVIDENCE:\n${selectedEvidenceContext}`)
  if (competitorContext.promptText) sections.push(competitorContext.promptText)
  if (knowledge.promptText) sections.push(knowledge.promptText)
  if (parent?.generated_content && input.refinementNote) {
    sections.push(
      `PREVIOUS DRAFT (revise this, don't start over from nothing):\n${parent.generated_content}\n\n` +
      `REQUESTED CHANGE: ${input.refinementNote}`,
    )
  }

  const userPrompt = `${sections.length > 0 ? `${sections.join('\n\n---\n\n')}\n\n` : ''}${buildUserPrompt(contentSpec)}`

  const generated = await generateArticleWithFallback({
    systemPrompt,
    userPrompt,
    maxTokens: undefined, // Let the model decide based on format
  })
  await recordAiUsage(input.parentRequestId ? 'generate_refine' : 'generate', generated.model, generated.usage)

  const cleanText = cleanPlainTextOutput(generated.text)
  const words = cleanText.trim().split(/\s+/).filter(Boolean).length

  const requestRecord = await deps.contentRequests.record({
    status: 'processing',
    topic: trimmedTopic,
    content_format: input.contentType,
    locale: regionProfile.locale,
    seo_mode: seoMode,
    context: input.context || null,
    evidence_item_ids: evidenceIdsUsed.length ? evidenceIdsUsed : null,
    rss_context: rssText || null,
    brand_profile_id: input.brandProfileId || null,
    region_id: effectiveRegionId || null,
    template_id: input.templateId || null,
    generated_content: cleanText,
    generation_model: generated.model,
    prompt_version: built.version,
    word_count: words,
    char_count: cleanText.length,
    processed_at: new Date().toISOString(),
    thread_id: threadId,
    parent_request_id: input.parentRequestId ?? null,
    refinement_note: input.refinementNote ?? null,
    knowledge_chunk_ids: knowledge.chunks.length ? knowledge.chunks.map((c) => c.chunkId) : null,
    brand_snapshot_summary: brandSnapshot.facts.length ? brandSnapshot.facts : null,
    marketing_campaign_id: input.marketingCampaignId ?? null,
  })

  const contentRequestId = requestRecord?.id ?? null
  if (contentRequestId && evidenceIdsUsed.length) {
    await deps.contentRequests.linkEvidence(contentRequestId, evidenceIdsUsed)
  }

  // Generate localization notes (non-blocking, best-effort)
  let localizationNotes = ''
  try {
    const { textStream } = await generateWithFallback({
      task: 'utility',
      systemPrompt: `You are a cultural localization consultant. Respond in ${regionProfile.languageName}.`,
      userPrompt: buildLocalizationNotesPrompt(trimmedTopic, input.contentType, rssText, regionProfile),
      maxTokens: 400,
    })
    for await (const chunk of textStream) {
      localizationNotes += chunk
    }
    localizationNotes = cleanPlainTextOutput(localizationNotes)
  } catch (e) {
    console.warn('[generate] localization notes failed:', e)
  }

  const { id: articleId, error: articleInsertError } = await deps.articles.create({
    topic: trimmedTopic,
    content_type: mapToLegacyContentType(input.contentType),
    draft_content: cleanText,
    status: 'draft',
    generation_model: generated.model,
    prompt_version: built.version,
    source_context: localizationNotes || null,
    template_id: input.templateId ?? null,
    brand_profile_id: input.brandProfileId ?? null,
    word_count: words,
    char_count: cleanText.length,
    content_request_id: contentRequestId,
    locale: regionProfile.locale,
    region_id: effectiveRegionId || null,
    marketing_campaign_id: input.marketingCampaignId ?? null,
  })

  if (articleInsertError) {
    // Persisting the generated article failed — don't silently report
    // success. Mark the content request as failed and surface the error.
    if (contentRequestId) {
      await deps.contentRequests.markFailed(contentRequestId, articleInsertError.message)
    }
    throw new Error(`Failed to persist article: ${articleInsertError.message}`)
  }

  if (contentRequestId) {
    await deps.contentRequests.markCompleted(contentRequestId)
  }

  return {
    text: cleanText,
    model: generated.model,
    contentRequestId,
    articleId,
    usedContext: {
      brandFacts: brandSnapshot.facts,
      knowledgeChunks: knowledge.chunks.map((c) => ({ chunkId: c.chunkId, assetId: c.assetId, assetTitle: c.assetTitle, snippet: c.snippet })),
      competitorSignals: competitorContext.signals,
    },
  }
}