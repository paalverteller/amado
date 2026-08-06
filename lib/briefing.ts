import { getSupabaseAdmin } from '@/lib/supabase/client'
import { generateArticleWithFallback } from '@/lib/ai'
import { getErrorMessage } from '@/lib/api/error-message'

// ─── Config ──────────────────────────────────────────────────────────────────

const CANDIDATE_WINDOW_HOURS = 48
const MAX_CANDIDATES = 40
const MAX_BRIEFING_ITEMS = 8
// Full text is useful signal but expensive in prompt tokens across 40
// candidates -- truncate per-candidate rather than drop it entirely.
const MAX_CANDIDATE_CHARS = 500

// ─── Types ───────────────────────────────────────────────────────────────────

interface CandidateRow {
  id: string
  source_title: string | null
  source_summary: string | null
  full_text: string | null
  hydration_status: string | null
  published_at: string | null
  created_at: string
  source_authority: number | null
  topics: string[] | null
}

interface RankedItem {
  evidenceItemId: string
  rank: number
  whyItMatters: string
}

export interface BriefingRunResult {
  runId: string
  status: 'ready' | 'empty' | 'failed'
  itemsCount: number
  error?: string
}

// ─── Stage 1: heuristic candidate selection (no AI call) ─────────────────────

async function selectCandidates(): Promise<CandidateRow[]> {
  const since = new Date(Date.now() - CANDIDATE_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await getSupabaseAdmin()
    .from('evidence_items')
    .select('id, source_title, source_summary, full_text, hydration_status, published_at, created_at, source_authority, topics')
    .gte('created_at', since)
    .order('source_authority', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(MAX_CANDIDATES)

  if (error) throw new Error(`Candidate select failed: ${error.message}`)
  return (data ?? []) as CandidateRow[]
}

// ─── Stage 2: one AI call — rank the shortlist + write why-it-matters ─────────

function buildCandidateBlock(candidates: CandidateRow[]): string {
  return candidates
    .map((c, i) => {
      const body = (c.full_text || c.source_summary || '').slice(0, MAX_CANDIDATE_CHARS)
      return `[${i}] (id: ${c.id})\nTítulo: ${c.source_title ?? 'Sem título'}\nConteúdo: ${body}`
    })
    .join('\n\n')
}

function parseRankedItems(raw: string, candidates: CandidateRow[]): RankedItem[] {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Briefing output was not valid JSON: ${getErrorMessage(err)}. Raw (first 200 chars): ${raw.slice(0, 200)}`)
  }

  if (!Array.isArray(parsed)) throw new Error('Briefing output was not a JSON array')

  const byIndex = candidates
  const items: RankedItem[] = []

  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    const idx = typeof e.index === 'number' ? e.index : Number(e.index)
    const whyItMatters = typeof e.whyItMatters === 'string' ? e.whyItMatters.trim() : ''
    if (!Number.isInteger(idx) || idx < 0 || idx >= byIndex.length) continue
    if (!whyItMatters) continue
    items.push({
      evidenceItemId: byIndex[idx].id,
      rank: items.length + 1,
      whyItMatters: whyItMatters.slice(0, 500),
    })
    if (items.length >= MAX_BRIEFING_ITEMS) break
  }

  return items
}

async function rankAndExplain(candidates: CandidateRow[]): Promise<{ items: RankedItem[]; model: string }> {
  const systemPrompt = [
    'Você é um analista de inteligência de mercado para uma equipe de marketing B2B brasileira.',
    `Abaixo estão até ${MAX_CANDIDATES} itens recentes coletados de fontes de mercado.`,
    `Selecione os ${MAX_BRIEFING_ITEMS} itens MAIS RELEVANTES e importantes para essa equipe agir hoje.`,
    'Para cada item selecionado, escreva uma frase curta e direta (até 200 caracteres) explicando',
    'por que ele importa especificamente para uma equipe de marketing no Brasil -- não um resumo do',
    'conteúdo, mas a implicação prática (oportunidade, risco, mudança de comportamento do público, etc).',
    '',
    'Responda APENAS com um array JSON, nada além disso, neste formato exato:',
    '[{"index": 0, "whyItMatters": "..."}, {"index": 5, "whyItMatters": "..."}]',
    '"index" deve ser o número entre colchetes do item na lista abaixo, em ordem de importância',
    '(mais importante primeiro). Não invente itens fora da lista.',
  ].join('\n')

  const userPrompt = buildCandidateBlock(candidates)

  const result = await generateArticleWithFallback({ systemPrompt, userPrompt, maxTokens: 2000 })
  const items = parseRankedItems(result.text, candidates)
  return { items, model: result.model }
}

// ─── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Runs the daily briefing agent for `runDate` (defaults to today, UTC).
 * Idempotent: if a run already exists for that date with status 'ready' or
 * 'empty', returns it unchanged rather than generating again. A 'failed' or
 * 'generating' (stuck/crashed) row for the date is retried.
 */
export async function runBriefing(runDate?: string): Promise<BriefingRunResult> {
  const date = runDate ?? new Date().toISOString().slice(0, 10)
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from('briefing_runs')
    .select('id, status, items_count')
    .eq('run_date', date)
    .maybeSingle()

  if (existing && (existing.status === 'ready' || existing.status === 'empty')) {
    return { runId: existing.id, status: existing.status, itemsCount: existing.items_count }
  }

  let runId: string
  if (existing) {
    // Retrying a 'failed' (or stuck 'generating') row. Claim it atomically:
    // only proceed if THIS call is the one that flips status to
    // 'generating'. If another invocation (concurrent cron fire, manual
    // retry) already claimed it between our SELECT and here, back off
    // instead of both writers racing to insert/delete the same
    // briefing_items rows.
    const { data: claimed, error: claimError } = await admin
      .from('briefing_runs')
      .update({ status: 'generating', error_message: null })
      .eq('id', existing.id)
      .neq('status', 'generating')
      .select('id')
      .maybeSingle()

    if (claimError) throw new Error(`Failed to claim briefing run: ${claimError.message}`)
    if (!claimed) {
      return { runId: existing.id, status: 'failed', itemsCount: 0, error: 'Another run is already in progress for this date' }
    }
    runId = claimed.id
  } else {
    const { data: inserted, error: insertError } = await admin
      .from('briefing_runs')
      .insert({ run_date: date, status: 'generating' })
      .select('id')
      .single()

    if (insertError) {
      // Unique constraint on run_date: someone else inserted between our
      // SELECT and this INSERT. Treat as "already being handled" rather
      // than a hard failure.
      if (insertError.code === '23505') {
        return { runId: '', status: 'failed', itemsCount: 0, error: 'Briefing run for this date was just created by another invocation' }
      }
      throw new Error(`Failed to create briefing_runs row: ${insertError.message}`)
    }
    runId = inserted!.id
  }

  try {
    const candidates = await selectCandidates()

    if (candidates.length === 0) {
      await admin.from('briefing_runs').update({
        status: 'empty', items_count: 0, completed_at: new Date().toISOString(),
      }).eq('id', runId)
      return { runId, status: 'empty', itemsCount: 0 }
    }

    const { items, model } = await rankAndExplain(candidates)

    if (items.length === 0) {
      await admin.from('briefing_runs').update({
        status: 'empty', items_count: 0, model_used: model, completed_at: new Date().toISOString(),
      }).eq('id', runId)
      return { runId, status: 'empty', itemsCount: 0 }
    }

    // Clear any partial rows from a previous failed/retried attempt for this run.
    await admin.from('briefing_items').delete().eq('run_id', runId)

    const { error: insertError } = await admin.from('briefing_items').insert(
      items.map(item => ({
        run_id: runId,
        evidence_item_id: item.evidenceItemId,
        rank: item.rank,
        why_it_matters: item.whyItMatters,
      })),
    )
    if (insertError) throw new Error(`Failed to save briefing items: ${insertError.message}`)

    await admin.from('briefing_runs').update({
      status: 'ready', items_count: items.length, model_used: model, completed_at: new Date().toISOString(),
    }).eq('id', runId)

    return { runId, status: 'ready', itemsCount: items.length }
  } catch (err) {
    const message = getErrorMessage(err)
    await admin.from('briefing_runs').update({
      status: 'failed', error_message: message, completed_at: new Date().toISOString(),
    }).eq('id', runId)
    return { runId, status: 'failed', itemsCount: 0, error: message }
  }
}
