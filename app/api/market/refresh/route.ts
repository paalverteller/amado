/**
 * app/api/market/refresh/route.ts
 *
 * Stage 0 fixes:
 *   - Source connector type always passed explicitly (§2.2)
 *   - Shared cron auth helper (§2.3)
 *   - Translation pipeline preserved for Stage 1-2 migration
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchAndSaveRss } from '@/lib/rss'
import { requireCronAuth } from '@/lib/cron-auth'
import { buildSourceConnector } from '@/lib/ingestion/types'
import { generateWithFallback } from '@/lib/ai'
import { isFeatureEnabled } from '@/lib/amado-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_TRANSLATIONS = 60
const CONCURRENCY = 4
const DEADLINE_MS = 50_000

type SourceRow = { id: string; name: string | null; url: string; source_type?: string | null; type?: string | null; country?: string | null; region_id?: string | null; language_code?: string | null; parser_config?: Record<string, unknown> | null }
type CandidateRow = { id: string; title: string | null; description: string | null }
type TResult = { title_ru: string; summary_ru: string }

function nws(v: string | null | undefined): string {
  return (v ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

function trunc(v: string, max: number): string {
  const s = nws(v)
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

function stripThinkBlocks(raw: string): string {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  s = s.replace(/<think>[\s\S]*/i, '')
  return s.trim()
}

function hasCyrillic(text: string): boolean {
  // Stage 2: No longer validating Cyrillic. Source content is displayed directly.
  return false
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text)
}

function parseBlock(raw: string): TResult | null {
  const text = nws(stripThinkBlocks(raw)).replace(/\*+/g, '')
  if (!text) return null

  const titleM = text.match(/(?:Título|Title)\s*:\s*(.*?)(?=\s+(?:Resumo|Snippet|Descrição|Description)\s*:|$)/i)
  const snippetM = text.match(/(?:Resumo|Snippet|Descrição|Description)\s*:\s*(.+)$/i)

  let title = nws(titleM?.[1])
  let summary = nws(snippetM?.[1])

  if (!title || !summary) {
    const parts = text.split(/\n+/).map((p) => nws(p.replace(/^[-•\d.)\s]+/, ''))).filter(Boolean)
    title = title || parts[0] || ''
    summary = summary || parts.slice(1).join(' ') || parts[0] || ''
  }

  title = trunc(title, 220)
  summary = trunc(summary, 600)

  if (hasChinese(`${title} ${summary}`)) return null
  if (summary === title || summary.startsWith(title.slice(0, 40))) return null
  return { title_ru: title, summary_ru: summary }
}

async function translateOne(item: CandidateRow): Promise<(TResult & { id: string }) | null> {
  const srcTitle = trunc(item.title ?? 'Untitled', 220)
  const srcDesc = trunc(item.description ?? srcTitle, 300)

  if (hasCyrillic(`${srcTitle} ${srcDesc}`)) {
    return { id: item.id, title_ru: trunc(srcTitle, 220), summary_ru: trunc(srcDesc, 500) }
  }

  try {
    const { textStream } = await generateWithFallback({
      task: 'translation',
      systemPrompt: [
        'You are a marketing journalist writing for a Brazilian audience.',
        'Translate the article title and preview into natural, engaging Brazilian Portuguese.',
        'RULES:',
        '- Título: sharp, curious headline (≤ 120 chars). No "Neste artigo".',
        '- Resumo: the most interesting finding or insight, written directly.',
        '  • Write as if telling a friend what the article is about.',
        '  • NO "Neste artigo investiga-se", NO "O autor analisa", NO academic 3rd-person.',
        '  • Start with the finding/fact, not "This article...".',
        '  • ≤ 420 characters.',
        '- ABSOLUTELY NO Chinese, Japanese, or any non-Latin characters.',
        '- NO chain-of-thought, NO <think> tags, NO meta-commentary.',
        '- Reply ONLY in this exact format, nothing else:',
        'Título: [Portuguese headline]',
        'Resumo: [Engaging description of the key finding]',
      ].join('\n'),
      userPrompt: `Title: ${srcTitle}\nPreview: ${srcDesc}`,
      maxTokens: 400,
    })

    let raw = ''
    for await (const chunk of textStream) raw += chunk

    const parsed = parseBlock(raw)
    if (!parsed) {
      console.warn(`[refresh] non-Portuguese output for "${srcTitle.slice(0, 50)}" — raw="${raw.slice(0, 100)}"`)
      return null
    }
    return { id: item.id, ...parsed }
  } catch (err) {
    console.error(`[refresh] translation error item ${item.id}:`, (err as Error).message)
    return null
  }
}

async function translateBatch(
  candidates: CandidateRow[],
  concurrency: number,
  maxTotal: number,
  deadlineMs: number,
): Promise<number> {
  let translated = 0
  let idx = 0

  async function worker(): Promise<void> {
    while (idx < candidates.length && translated < maxTotal) {
      if (Date.now() > deadlineMs) break
      const item = candidates[idx++]
      const result = await translateOne(item)
      if (!result) continue
      const { error } = await getSupabaseAdmin()
        .from('rss_items')
        .update({ title_ru: result.title_ru, summary_ru: result.summary_ru })
        .eq('id', result.id)
      if (!error) translated++
      else console.error(`[refresh] DB update failed ${result.id}:`, error.message)
    }
  }

  await Promise.allSettled(Array.from({ length: concurrency }, worker))
  return translated
}

export async function POST(): Promise<NextResponse> {
  const startMs = Date.now()
  const deadlineMs = startMs + DEADLINE_MS

  try {
    const { data: sources, error: srcErr } = await getSupabaseAdmin()
      .from('rss_sources')
      .select('id, name, url, source_type, type, country, region_id, language_code, parser_config')
      .eq('active', true)
      .order('name', { ascending: true })

    if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })
    if (!sources?.length) return NextResponse.json({ success: true, sourcesProcessed: 0, itemsSaved: 0, translated: 0 })

    const { error: pruneErr } = await getSupabaseAdmin().rpc('prune_market_rss_items_keep_latest_50')
    if (pruneErr) console.warn('[refresh] prune failed:', pruneErr.message)

    // Fetch all sources concurrently with explicit connector type
    const fetchResults = await Promise.allSettled(
      (sources as SourceRow[]).map(async (src) => {
        const connector = buildSourceConnector(src)
        const n = await fetchAndSaveRss(src.id, src.url, connector.connectorType)
        await getSupabaseAdmin()
          .from('rss_sources')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', src.id)
        return { name: src.name ?? src.url, saved: n }
      }),
    )

    const itemsSaved = fetchResults.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value.saved : 0), 0)
    const fetchSummary = fetchResults.map((r) => r.status === 'fulfilled' ? r.value : { name: 'unknown', saved: 0 })

    // Translation pipeline — skip if Russian gate is disabled
    let translated = 0
    if (isFeatureEnabled('russianTranslationGate')) {
      const { data: candidates } = await getSupabaseAdmin()
        .from('rss_items')
        .select('id, title, description')
        .or('summary_ru.is.null,title_ru.is.null')
        .order('collected_at', { ascending: false })
        .limit(MAX_TRANSLATIONS * 2)

      translated = await translateBatch(
        (candidates ?? []) as CandidateRow[],
        CONCURRENCY,
        MAX_TRANSLATIONS,
        deadlineMs,
      )
    }

    return NextResponse.json({
      success: true,
      sourcesProcessed: sources.length,
      itemsSaved,
      translated,
      durationMs: Date.now() - startMs,
      fetchSummary,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireCronAuth(req)
  if (denied) return denied
  return POST()
}
