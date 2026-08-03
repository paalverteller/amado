import { buildSystemPrompt, buildUserPrompt, buildBrandVoiceLayer, buildLocalizationNotesPrompt, buildRegionContextLayer, buildEvidenceContext } from '@/lib/prompts'
import { getRecentEvidenceItems } from '@/lib/evidence'
import { generateArticleWithFallback, generateWithFallback } from '@/lib/ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { mapToLegacyContentType } from '@/lib/content-formats'
import type { ContentFormat } from '@/lib/content-formats'
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
}

export interface GenerateArticleDeps {
  contentRequests: ContentRequestRepository
  articles: ArticleRepository
}

export interface GenerateArticleResult {
  text: string
  model: string
  contentRequestId: string | null
}

function defaultDeps(): GenerateArticleDeps {
  return {
    contentRequests: createSupabaseContentRequestRepository(),
    articles: createSupabaseArticleRepository(),
  }
}

/**
 * Full generate-and-persist workflow: assembles the prompt from the
 * template, brand voice, region context and evidence layers, calls the AI
 * provider fallback chain, then persists both a content_requests record
 * and the resulting article.
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

  // Stage 3: Use evidence_items instead of rss_items
  const evidenceContext = await buildEvidenceContext(input.evidenceItemIds)
  const rssText = evidenceContext || await getRecentEvidenceItems(trimmedTopic)

  const built = await buildSystemPrompt(input.templateId)
  const brandVoice = await buildBrandVoiceLayer(input.brandProfileId)
  const regionContext = await buildRegionContextLayer(input.regionId)

  // Build structured content spec — no contradictory length rules
  const contentSpec = {
    topic: promptTopic,
    format: input.contentType,
    seoMode,
    brandProfileId: input.brandProfileId ?? null,
  }

  const systemPrompt = `${built.systemPrompt}${brandVoice ? '\n\n' + brandVoice : ''}${regionContext ? '\n\n' + regionContext : ''}

STRICT OUTPUT FORMAT:
Write only the final clean text for publication. No think tags. No Markdown.`

  const sections: string[] = []
  if (rssText) sections.push(`BRAZILIAN MARKET SIGNALS:\n${rssText}`)
  if (evidenceContext) sections.push(`EVIDENCE:\n${evidenceContext}`)

  const userPrompt = `${sections.length > 0 ? `${sections.join('\n\n---\n\n')}\n\n` : ''}${buildUserPrompt(contentSpec)}`

  const generated = await generateArticleWithFallback({
    systemPrompt,
    userPrompt,
    maxTokens: undefined, // Let the model decide based on format
  })

  const cleanText = cleanPlainTextOutput(generated.text)
  const words = cleanText.trim().split(/\s+/).filter(Boolean).length

  const requestRecord = await deps.contentRequests.record({
    status: 'processing',
    topic: trimmedTopic,
    content_format: input.contentType,
    locale: 'pt-BR',
    seo_mode: seoMode,
    context: input.context || null,
    evidence_item_ids: input.evidenceItemIds || null,
    rss_context: rssText || null,
    brand_profile_id: input.brandProfileId || null,
    region_id: input.regionId || null,
    template_id: input.templateId || null,
    generated_content: cleanText,
    generation_model: generated.model,
    prompt_version: built.version,
    word_count: words,
    char_count: cleanText.length,
    processed_at: new Date().toISOString(),
  })

  const contentRequestId = requestRecord?.id ?? null

  // Generate localization notes (non-blocking, best-effort)
  let localizationNotes = ''
  try {
    const { textStream } = await generateWithFallback({
      task: 'utility',
      systemPrompt: 'You are a cultural localization consultant. Respond in Portuguese (Brazil).',
      userPrompt: buildLocalizationNotesPrompt(trimmedTopic, input.contentType, rssText),
      maxTokens: 400,
    })
    for await (const chunk of textStream) {
      localizationNotes += chunk
    }
    localizationNotes = cleanPlainTextOutput(localizationNotes)
  } catch (e) {
    console.warn('[generate] localization notes failed:', e)
  }

  const { error: articleInsertError } = await deps.articles.create({
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
    locale: 'pt-BR',
    region_id: input.regionId || null,
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

  return { text: cleanText, model: generated.model, contentRequestId }
}
