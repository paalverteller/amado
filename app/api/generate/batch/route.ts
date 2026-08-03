import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { buildSystemPrompt, buildUserPrompt, buildBrandVoiceLayer, buildRegionContextLayer, buildEvidenceContext } from '@/lib/prompts'
import { generateArticleWithFallback } from '@/lib/ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { isValidContentFormat, mapToLegacyContentType } from '@/lib/content-formats'
import { GENERATION_CONFIG } from '@/lib/amado-config'
import type { ContentFormat } from '@/lib/content-formats'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

type BatchTopic = { title: string; context: string; contentType?: string }
type BatchBody = { topics?: BatchTopic[]; templateId?: string; brandProfileId?: string; regionId?: string; evidenceItemIds?: string[] }
type BatchResult = { topic: string; status: 'ok' | 'error'; articleId?: string; error?: string }

const MAX_BATCH_SIZE = GENERATION_CONFIG.maxBatchSize

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as BatchBody
    const topics = body.topics ?? []

    if (topics.length === 0) {
      return NextResponse.json({ error: 'Topic list is empty' }, { status: 400 })
    }
    if (topics.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} topics per batch` },
        { status: 400 },
      )
    }

    const built = await buildSystemPrompt(body.templateId)
    const brandVoice = await buildBrandVoiceLayer(body.brandProfileId)
    const regionContext = await buildRegionContextLayer(body.regionId)
    const evidenceContext = await buildEvidenceContext(body.evidenceItemIds)

    const results: BatchResult[] = []

    for (const item of topics) {
      const displayTitle = (item.title ?? '').trim()
      const promptContext = (item.context ?? item.title ?? '').trim()

      if (!displayTitle || !promptContext) {
        results.push({ topic: displayTitle || '(no topic)', status: 'error', error: 'Empty topic' })
        continue
      }

      try {
        const contentType = (item.contentType ?? 'article') as ContentFormat
        
        // Validate format
        if (!isValidContentFormat(contentType)) {
          results.push({ topic: displayTitle, status: 'error', error: `Invalid format: ${contentType}` })
          continue
        }

        const userPrompt = buildUserPrompt({ topic: promptContext, format: contentType })
        const systemPrompt = `${built.systemPrompt}${brandVoice ? '\n\n' + brandVoice : ''}${regionContext ? '\n\n' + regionContext : ''}

STRICT OUTPUT FORMAT:
Write only the final clean text for publication. No think tags. No Markdown.`

        const sections: string[] = []
        if (evidenceContext) sections.push(`EVIDENCE:\n${evidenceContext}`)
        const fullUserPrompt = sections.length > 0 
          ? `${sections.join('\n\n---\n\n')}\n\n${userPrompt}`
          : userPrompt

        const generated = await generateArticleWithFallback({
          systemPrompt,
          userPrompt: fullUserPrompt,
        })

        const cleanText = cleanPlainTextOutput(generated.text)

        const { data: inserted, error: insertError } = await getSupabaseAdmin()
          .from('articles')
          .insert({
            topic: displayTitle,
            content_type: mapToLegacyContentType(contentType),
            draft_content: cleanText,
            status: 'draft',
            brand_profile_id: body.brandProfileId || null,
            region_id: body.regionId || null,
            locale: 'pt-BR',
          })
          .select('id')
          .single()

        if (insertError) throw new Error(insertError.message)

        results.push({ topic: displayTitle, status: 'ok', articleId: inserted?.id })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        results.push({ topic: displayTitle, status: 'error', error: message })
      }
    }

    const okCount = results.filter(r => r.status === 'ok').length
    return NextResponse.json({ results, total: topics.length, succeeded: okCount })
  } catch (err) {
    console.error('[generate/batch] error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
