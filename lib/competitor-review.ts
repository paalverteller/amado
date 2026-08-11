import { getSupabaseAdmin } from '@/lib/supabase/client'
import { generateArticleWithFallback } from '@/lib/ai'
import { processKnowledgeAsset } from '@/lib/knowledge/process-asset'
import { createSupabaseKnowledgeRepository } from '@/lib/repositories/knowledge-repository'
import { getErrorMessage } from '@/lib/api/error-message'
import { recordAiUsage } from '@/lib/ai-usage'

// Competitor reviews look further back than the daily briefing (48h) --
// competitor positioning/messaging shifts show up over weeks, not hours.
const REVIEW_WINDOW_DAYS = 30
const MAX_EVIDENCE_ITEMS = 30
const MAX_ITEM_CHARS = 600

export interface CompetitorReviewResult {
  status: 'ready' | 'no_content' | 'failed'
  knowledgeAssetId?: string
  itemsReviewed?: number
  error?: string
}

interface CompetitorRow {
  id: string
  brand_id: string | null
  name: string
  website: string | null
  notes: string | null
}

interface EvidenceRow {
  source_title: string | null
  source_summary: string | null
  full_text: string | null
  published_at: string | null
}

async function gatherEvidence(competitorId: string): Promise<EvidenceRow[]> {
  const admin = getSupabaseAdmin()

  const { data: sources, error: sourcesError } = await admin
    .from('rss_sources')
    .select('id')
    .eq('competitor_id', competitorId)

  if (sourcesError) throw new Error(`Failed to load competitor sources: ${sourcesError.message}`)
  if (!sources?.length) return []

  const sourceIds = sources.map((s) => s.id)
  const since = new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: evidence, error: evidenceError } = await admin
    .from('evidence_items')
    .select('source_title, source_summary, full_text, published_at')
    .in('source_id', sourceIds)
    .gte('created_at', since)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(MAX_EVIDENCE_ITEMS)

  if (evidenceError) throw new Error(`Failed to load competitor evidence: ${evidenceError.message}`)
  return evidence ?? []
}

function buildEvidenceBlock(items: EvidenceRow[]): string {
  return items
    .map((item, i) => {
      const body = (item.full_text || item.source_summary || '').slice(0, MAX_ITEM_CHARS)
      const date = item.published_at ? new Date(item.published_at).toISOString().slice(0, 10) : '?'
      return `[${i + 1}] (${date}) ${item.source_title ?? 'Sem título'}\n${body}`
    })
    .join('\n\n')
}

async function writeReview(competitor: CompetitorRow, evidence: EvidenceRow[]): Promise<{ text: string; model: string }> {
  // Same convention as lib/briefing.ts: source material is pt-BR (what the
  // competitor's own channels actually say), the review itself is Russian
  // (internal analysis for the team, not generated marketing content).
  const systemPrompt = [
    `Ты аналитик конкурентной разведки. Ниже — материалы, собранные за последние ${REVIEW_WINDOW_DAYS} дней`,
    `из источников конкурента «${competitor.name}»${competitor.website ? ` (${competitor.website})` : ''} (на португальском).`,
    competitor.notes ? `Контекст от команды: ${competitor.notes}` : '',
    '',
    'Напиши структурированный обзор на РУССКОМ языке для команды маркетинга, отвечающий на:',
    '1. Позиционирование и сообщения — что конкурент подчёркивает в этот период?',
    '2. Заметные изменения — что нового или иначе по сравнению с обычным?',
    '3. Что это значит для нас — конкретный практический вывод, а не общие слова.',
    '',
    'Пиши прозой, без markdown-заголовков, 3-5 абзацев. Если материалов мало для выводов —',
    'честно скажи об этом, не придумывай.',
  ].filter(Boolean).join('\n')

  const userPrompt = buildEvidenceBlock(evidence)

  const result = await generateArticleWithFallback({ systemPrompt, userPrompt, maxTokens: 1500 })
  await recordAiUsage('competitor_review', result.model, result.usage)
  return { text: result.text, model: result.model }
}

/**
 * Generates (or regenerates) an AI review for one competitor from its
 * recently-collected evidence, and saves it as a knowledge_assets row
 * (content_type='competitor_note') so it's chunked, embedded, and
 * searchable via the existing Sprint 3 pipeline. Does not touch
 * competitors.last_reviewed_at itself -- the caller (route) does that
 * after confirming success, since this function doesn't otherwise know
 * the calling context.
 */
export async function generateCompetitorReview(competitorId: string): Promise<CompetitorReviewResult> {
  const admin = getSupabaseAdmin()

  const { data: competitor, error: competitorError } = await admin
    .from('competitors')
    .select('id, brand_id, name, website, notes')
    .eq('id', competitorId)
    .single()

  if (competitorError || !competitor) {
    return { status: 'failed', error: competitorError?.message ?? 'Competitor not found' }
  }

  try {
    const evidence = await gatherEvidence(competitorId)
    if (evidence.length === 0) {
      return { status: 'no_content' }
    }

    const { text, model } = await writeReview(competitor as CompetitorRow, evidence)

    const repo = createSupabaseKnowledgeRepository()
    const asset = await repo.create({
      brand_id: competitor.brand_id,
      title: `Обзор конкурента: ${competitor.name} — ${new Date().toISOString().slice(0, 10)}`,
      content_type: 'competitor_note',
      raw_text: text,
      collection: 'competitors',
      retrieval_mode: 'evidence',
      source_note: `AI review (${model}), ${evidence.length} источник(ов) за ${REVIEW_WINDOW_DAYS} дней`,
    })

    // Set competitor_id via a follow-up update -- NewKnowledgeAsset (the
    // repository's create() input type) predates Sprint 7 and doesn't
    // carry this field; extending that shared interface for one caller
    // isn't worth it when a plain update accomplishes the same thing.
    await admin.from('knowledge_assets').update({ competitor_id: competitorId }).eq('id', asset.id)

    await processKnowledgeAsset(asset.id)

    return { status: 'ready', knowledgeAssetId: asset.id, itemsReviewed: evidence.length }
  } catch (err) {
    return { status: 'failed', error: getErrorMessage(err) }
  }
}
