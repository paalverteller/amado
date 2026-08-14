import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { generateAndPersistArticle } from '@/lib/content-generation/generate-article'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = {
  topic?: string
  context?: string
  brandProfileId?: string
}

function keywordScore(topic: string, row: { source_title?: string | null; source_summary?: string | null }): number {
  const words = topic.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4)
  const haystack = `${row.source_title ?? ''} ${row.source_summary ?? ''}`.toLowerCase()
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Body
    const topic = body.topic?.trim() ?? ''
    if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })

    const admin = getSupabaseAdmin()
    const [{ data: template }, { data: defaultBrand }] = await Promise.all([
      admin.from('prompt_templates')
        .select('id')
        .contains('content_types', ['seo_article'])
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from('brand_profiles')
        .select('id')
        .eq('is_default', true)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
    ])

    if (!template?.id) {
      return NextResponse.json({ error: 'SEO profile is not installed. Run seed 003.' }, { status: 409 })
    }

    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const { data: evidence } = await admin
      .from('evidence_items')
      .select('id, source_title, source_summary, discovered_at')
      .gte('discovered_at', since)
      .order('discovered_at', { ascending: false })
      .limit(40)

    const evidenceIds = (evidence ?? [])
      .map((row) => ({ row, score: keywordScore(topic, row) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ row }) => row.id)

    const result = await generateAndPersistArticle({
      topic,
      context: body.context?.trim() || topic,
      contentType: 'article',
      templateId: template.id,
      brandProfileId: body.brandProfileId || defaultBrand?.id || undefined,
      seoMode: true,
      evidenceItemIds: evidenceIds,
    })

    return NextResponse.json({
      text: result.text,
      model: result.model,
      contentRequestId: result.contentRequestId,
      evidenceItems: evidenceIds.length,
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
