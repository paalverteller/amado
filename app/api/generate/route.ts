import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { buildSystemPrompt, buildUserPrompt, buildBrandVoiceLayer, buildLocalizationNotesPrompt, buildRegionContextLayer, buildEvidenceContext } from '@/lib/prompts'
import { getRecentEvidenceItems } from '@/lib/evidence'
import { generateArticleWithFallback, generateWithFallback } from '@/lib/ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { isValidContentFormat, mapToLegacyContentType } from '@/lib/content-formats'
import type { ContentFormat } from '@/lib/content-formats'
import { getErrorMessage } from '@/lib/api/error-message'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

type GenerateBody = {
  topic?: string
  context?: string
  contentType?: string
  templateId?: string
  brandProfileId?: string
  seoMode?: boolean
  regionId?: string
  evidenceItemIds?: string[]
}

function textToAiSdkLikeStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`))
      controller.close()
    },
  })
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as GenerateBody
    const { topic, context, templateId, brandProfileId, seoMode = false, regionId, evidenceItemIds } = body
    const contentType = (body.contentType ?? 'article') as ContentFormat

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    // Validate content format
    if (!isValidContentFormat(contentType)) {
      return NextResponse.json(
        { error: `Invalid content format: "${contentType}"` },
        { status: 400 }
      )
    }

    const trimmedTopic = topic.trim()
    const promptTopic = (context && context.trim()) ? context.trim() : trimmedTopic

    // Stage 3: Use evidence_items instead of rss_items
    const evidenceContext = await buildEvidenceContext(evidenceItemIds)
    const rssText = evidenceContext || await getRecentEvidenceItems(trimmedTopic)

    const built = await buildSystemPrompt(templateId)
    const brandVoice = await buildBrandVoiceLayer(brandProfileId)
    const regionContext = await buildRegionContextLayer(regionId)

    // Build structured content spec — no contradictory length rules
    const contentSpec = {
      topic: promptTopic,
      format: contentType,
      seoMode,
      brandProfileId: brandProfileId ?? null,
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

    // Create content request record
    const { data: requestRecord } = await getSupabaseAdmin()
      .from('content_requests')
      .insert({
        status: 'processing',
        topic: trimmedTopic,
        content_format: contentType,
        locale: 'pt-BR',
        seo_mode: seoMode,
        context: context || null,
        evidence_item_ids: evidenceItemIds || null,
        rss_context: rssText || null,
        brand_profile_id: brandProfileId || null,
        region_id: regionId || null,
        template_id: templateId || null,
        generated_content: cleanText,
        generation_model: generated.model,
        prompt_version: built.version,
        word_count: words,
        char_count: cleanText.length,
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    const contentRequestId = requestRecord?.id

    // Generate localization notes (non-blocking)
    let localizationNotes = ''
    try {
      const { textStream } = await generateWithFallback({
        task: 'utility',
        systemPrompt: 'You are a cultural localization consultant. Respond in Portuguese (Brazil).',
        userPrompt: buildLocalizationNotesPrompt(trimmedTopic, contentType, rssText),
        maxTokens: 400,
      })
      for await (const chunk of textStream) {
        localizationNotes += chunk
      }
      localizationNotes = cleanPlainTextOutput(localizationNotes)
    } catch (e) {
      console.warn('[generate] localization notes failed:', e)
    }

    const { error: articleInsertError } = await getSupabaseAdmin().from('articles').insert({
      topic: trimmedTopic,
      content_type: mapToLegacyContentType(contentType),
      draft_content: cleanText,
      status: 'draft',
      generation_model: generated.model,
      prompt_version: built.version,
      source_context: localizationNotes || null,
      template_id: templateId ?? null,
      brand_profile_id: brandProfileId ?? null,
      word_count: words,
      char_count: cleanText.length,
      content_request_id: contentRequestId || null,
      locale: 'pt-BR',
      region_id: regionId || null,
    })

    if (articleInsertError) {
      // Persisting the generated article failed — don't silently report
      // success. Mark the content request as failed and surface the error.
      if (contentRequestId) {
        await getSupabaseAdmin()
          .from('content_requests')
          .update({ status: 'failed', error_message: articleInsertError.message })
          .eq('id', contentRequestId)
      }
      throw new Error(`Failed to persist article: ${articleInsertError.message}`)
    }

    // Update content request to completed
    if (contentRequestId) {
      await getSupabaseAdmin()
        .from('content_requests')
        .update({ status: 'completed' })
        .eq('id', contentRequestId)
    }

    return new Response(textToAiSdkLikeStream(cleanText), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Generation-Model': generated.model,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
