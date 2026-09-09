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
import { buildSocialPlaybookContext } from '@/lib/social-generation-policy'

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
  /**
   * Fable review, Phase 1: set when something about persisting this
   * generation's bookkeeping degraded -- currently only "the
   * content_requests row could not be recorded, so this article has no
   * content_request_id and won't show up in version history / evidence
   * linking". The article itself (`articleId`) is still saved when this
   * is set; only the audit-trail row failed. Previously this failure was
   * completely silent (a null contentRequestId with no signal anywhere).
   * null when nothing degraded.
   */
  persistenceWarning: string | null
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
 * Fable review, Phase 1 (status machines with no owner): the article
 * insert now happens BEFORE the best-effort localization-notes call,
 * not after. The old ordering (record processing -> localization notes
 * LLM call -> article insert -> markCompleted) meant a platform kill
 * during the second LLM call left a content_requests row stuck in
 * 'processing' forever, with generated_content populated and no article
 * row ever created. Localization notes are strictly best-effort color
 * for the article's source_context field; if they fail or the function
 * is killed after the article already exists, the article is still
 * there and content_requests is already 'completed' -- nothing is
 * stranded. The notes are attached with a follow-up update after the
 * article insert instead of being included in the initial insert.
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

  // Resolve the market before automatic evidence selection so recent
  // context from one region cannot leak into another region's generation.
  //
  // Fable review, Phase 2 (docs/fable-review.md): `input.regionId ??
  // resolveBrandRegionId(...)` used to accept a caller-supplied empty
  // string as if it were a real, explicit regionId -- `??` only falls
  // through on null/undefined, not on ''. A client that sends
  // `regionId: ''` (a plausible default for an unset <select> in a form)
  // would silently skip brand-derived region resolution entirely, then
  // resolveRegionProfile('') hits its own falsy-check fallback to Brazil
  // -- the same "region given but unresolvable -> Brazil" failure mode as
  // a genuinely missing region, just reached via a different input shape.
  // Treat the API boundary as untrusted: normalize '' (and any
  // whitespace-only string) to nullish before applying the brand fallback.
  const normalizedRegionId = input.regionId?.trim() || null
  const effectiveRegionId = normalizedRegionId ?? await resolveBrandRegionId(input.brandProfileId)

  // Sprint 12 Phase 4: derive the region from the chosen brand when the
  // caller didn't pass one explicitly. A brand is scoped to one market --
  // trusting the caller to also independently pass a matching regionId
  // risks the two silently drifting apart (e.g. a future UI bug sends a
  // Spain brandProfileId with the previous session's Brazil regionId still
  // cached). input.regionId stays authoritative when a caller does pass
  // it explicitly -- this is a fallback, not an override.
  //
  // Fable review, Phase 2: moved before buildEvidenceContext (was after)
  // so its resolved locale can be passed through instead of that function
  // defaulting to a locale-less ISO date format for every generation. Both
  // calls only depend on effectiveRegionId, already resolved above, so
  // reordering has no other effect.
  const regionProfile = await resolveRegionProfile(effectiveRegionId)

  // Stage 3: Use evidence_items instead of rss_items
  const selectedEvidenceContext = await buildEvidenceContext(input.evidenceItemIds, regionProfile.locale)
  const recentEvidence = selectedEvidenceContext ? { text: '', ids: [], items: [] } : await getRecentEvidenceContext(trimmedTopic, 5, effectiveRegionId)
  const rssText = selectedEvidenceContext || recentEvidence.text
  const evidenceIdsUsed = input.evidenceItemIds?.length ? input.evidenceItemIds : recentEvidence.ids

  const built = await buildSystemPrompt(input.templateId)
  const brandSnapshot = await buildBrandSnapshot(input.brandProfileId, input.contentType)
  const regionContext = await buildRegionContextLayer(effectiveRegionId)
  const knowledge = await buildKnowledgeContext(promptTopic, input.brandProfileId)
  const competitorContext = await buildCompetitorContext(promptTopic, input.brandProfileId)
  const socialPlaybookContext = await buildSocialPlaybookContext(input.contentType, input.brandProfileId)

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

  const systemPrompt = `${built.systemPrompt}${brandSnapshot.promptText ? '\n\n' + brandSnapshot.promptText : ''}${socialPlaybookContext ? '\n\n' + socialPlaybookContext : ''}${regionContext ? '\n\n' + regionContext : ''}

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

  // Fable review, Phase 1: requestRecord is null when the insert failed
  // (ContentRequestRepository.record()'s documented contract is "returns
  // null on failure, callers decide whether that's fatal"). The old code
  // used `requestRecord?.id ?? null` and silently proceeded as if a null
  // contentRequestId were a normal, expected case -- indistinguishable
  // from "this call legitimately has no content request yet". It is not:
  // record() only returns null when the insert itself failed, which also
  // means linkEvidence, markCompleted and markFailed below all silently
  // no-op for this generation, and the article that's about to be created
  // will be orphaned (no content_request_id, no version history, no
  // evidence-usage tracking). We still persist the article -- the LLM
  // call already happened and is paid for, discarding a good result over
  // a bookkeeping-row failure would be worse -- but the gap is now loud
  // (console.error) and visible to the caller via persistenceWarning
  // instead of being indistinguishable from success.
  const contentRequestId = requestRecord?.id ?? null
  let persistenceWarning: string | null = null
  if (!contentRequestId) {
    persistenceWarning = 'content_requests row could not be recorded; this article will have no content_request_id, version history, or evidence-usage tracking.'
    console.error('[generate-article]', persistenceWarning, 'topic:', trimmedTopic)
  }
  if (contentRequestId && evidenceIdsUsed.length) {
    await deps.contentRequests.linkEvidence(contentRequestId, evidenceIdsUsed)
  }

  const { id: articleId, error: articleInsertError } = await deps.articles.create({
    topic: trimmedTopic,
    content_type: mapToLegacyContentType(input.contentType),
    draft_content: cleanText,
    status: 'draft',
    generation_model: generated.model,
    prompt_version: built.version,
    source_context: null,
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

  // Generate localization notes (non-blocking, best-effort). Moved to
  // AFTER the article is persisted (Fable review, Phase 1) -- these are
  // supplementary color for the article's source_context field, not part
  // of the core generation. If this call is slow, fails, or the function
  // is killed here, the article and content_requests row already exist
  // and are already in their terminal state; nothing is left stranded in
  // 'processing'. A failure here only means the article's source_context
  // stays null, which the UI already treats as "no notes available".
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

  if (localizationNotes && articleId && deps.articles.updateSourceContext) {
    const { error: notesUpdateError } = await deps.articles.updateSourceContext(articleId, localizationNotes)
    if (notesUpdateError) {
      console.warn('[generate] failed to attach localization notes to article', articleId, ':', notesUpdateError.message)
    }
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
    persistenceWarning,
  }
}
