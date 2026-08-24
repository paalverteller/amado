import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { generateArticleWithFallback } from '@/lib/ai'
import { recordAiUsage } from '@/lib/ai-usage'
import { createSupabaseKnowledgeRepository } from '@/lib/repositories/knowledge-repository'
import { processKnowledgeAsset } from '@/lib/knowledge/process-asset'
import { getErrorMessage } from '@/lib/api/error-message'
import { resolveRegionProfile } from '@/lib/prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = { regionId?: string }

type EvidenceRow = {
  id: string
  source_title: string | null
  source_summary: string | null
  full_text: string | null
  canonical_url: string | null
  published_at: string | null
  discovered_at: string
  source: { name?: string | null; source_category?: string | null; country?: string | null; region_id?: string | null } | null
}

function evidenceBlock(rows: EvidenceRow[]): string {
  return rows.map((row, index) => {
    const date = row.published_at ?? row.discovered_at
    const excerpt = (row.full_text || row.source_summary || '').replace(/\s+/g, ' ').slice(0, 1200)
    return [
      `[S${index + 1}]`,
      `Date: ${date}`,
      `Source: ${row.source?.name ?? 'Unknown'}`,
      `Category: ${row.source?.source_category ?? 'general'}`,
      `Title: ${row.source_title ?? 'Untitled'}`,
      `URL: ${row.canonical_url ?? 'URL unavailable'}`,
      `Evidence: ${excerpt}`,
    ].join('\n')
  }).join('\n\n')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({})) as Body
    const admin = getSupabaseAdmin()
    const regionProfile = await resolveRegionProfile(body.regionId)
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: template, error: templateError }, { data: evidence, error: evidenceError }, { data: defaultBrand }] = await Promise.all([
      admin.from('prompt_templates')
        .select('id, system_prompt')
        .contains('content_types', ['market_analysis'])
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from('evidence_items')
        .select('id, source_title, source_summary, full_text, canonical_url, published_at, discovered_at, source:rss_sources(name, source_category, country, region_id)')
        .gte('discovered_at', since)
        .order('discovered_at', { ascending: false })
        .limit(250),
      (() => {
        let query = admin.from('brand_profiles').select('id').eq('is_active', true)
        if (body.regionId) query = query.eq('region_id', body.regionId)
        else query = query.eq('is_default', true)
        return query.order('is_default', { ascending: false }).limit(1).maybeSingle()
      })(),
    ])

    if (templateError || !template?.system_prompt) {
      return NextResponse.json({ error: 'Market Analysis prompt is not installed. Run seed 003.' }, { status: 409 })
    }
    if (evidenceError) throw evidenceError

    const allRows = (evidence ?? []) as unknown as EvidenceRow[]
    const rows = body.regionId
      ? allRows.filter((row) => !row.source?.region_id || row.source.region_id === body.regionId)
      : allRows
    if (rows.length < 5) {
      return NextResponse.json({
        error: `Недостаточно свежих источников за 60 дней (${rows.length}). Сначала обновите источники в разделе Рынок.`,
      }, { status: 409 })
    }

    const systemPrompt = `${template.system_prompt}

EXECUTION CONSTRAINTS FOR AMADO:
- You do NOT have live web browsing in this call. The evidence pack below is the only factual source of truth.
- Use only evidence dated within the supplied 60-day window.
- Never invent laws, dates, program names, platform features, statistics, quotes, keyword volumes or URLs.
- Every factual claim must cite one or more supplied source IDs like [S4].
- When a requested data point is absent, explicitly say that recent reliable evidence is insufficient.
- Keyword interest/volume may be qualitative only and must be labelled as an analytical classification, not measured Google Trends data, unless evidence explicitly contains such data.
- Output in ${regionProfile.languageName} for ${regionProfile.name}.
- Any Brazil-specific language in the stored template is overridden by the selected target market above.`

    const result = await generateArticleWithFallback({
      systemPrompt,
      userPrompt: `EVIDENCE PACK — ${regionProfile.name.toUpperCase()} — LAST 60 DAYS ONLY\n\n${evidenceBlock(rows)}`,
      maxTokens: 8000,
    })
    await recordAiUsage('market_deep_analysis', result.model, result.usage)

    let knowledgeAssetId: string | null = null
    try {
      const repo = createSupabaseKnowledgeRepository()
      const asset = await repo.create({
        brand_id: defaultBrand?.id ?? null,
        title: `Deep Market Analysis — ${regionProfile.name} — ${new Date().toISOString().slice(0, 10)}`,
        content_type: 'report',
        raw_text: result.text,
        collection: 'market-analysis',
        retrieval_mode: 'evidence',
        source_note: `AI report grounded in ${rows.length} evidence item(s), strict 60-day window`,
      })
      await processKnowledgeAsset(asset.id)
      knowledgeAssetId = asset.id
    } catch (knowledgeError) {
      console.warn('[market/deep-analysis] report generated but Knowledge save/index failed:', getErrorMessage(knowledgeError))
    }

    return NextResponse.json({
      report: result.text,
      model: result.model,
      evidenceCount: rows.length,
      windowStart: since,
      knowledgeAssetId,
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
