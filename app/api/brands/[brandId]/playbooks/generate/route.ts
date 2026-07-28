import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { buildUserPrompt } from '@/lib/prompts'
import { generateArticleWithFallback } from '@/lib/ai'
import type { ContentFormat } from '@/lib/content-formats'

/**
 * POST /api/brands/[brandId]/playbooks/generate
 * Generate platform-native content using a playbook
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const body = await request.json()
    const { playbookId, topic, pillarId, evidenceIds } = body

    if (!playbookId || !topic) {
      return NextResponse.json(
        { error: 'playbookId and topic are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Fetch playbook
    const { data: playbook, error: playbookError } = await supabase
      .from('platform_playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('brand_id', brandId)
      .single()

    if (playbookError || !playbook) {
      return NextResponse.json(
        { error: 'Playbook not found' },
        { status: 404 }
      )
    }

    // Fetch brand context
    const { data: brand } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single()

    // Fetch pillar if specified
    let pillar = null
    if (pillarId) {
      const { data: p } = await supabase
        .from('brand_content_pillars')
        .select('*')
        .eq('id', pillarId)
        .single()
      pillar = p
    }

    // Fetch evidence items
    let evidenceItems: any[] = []
    if (evidenceIds && evidenceIds.length > 0) {
      const { data: items } = await supabase
        .from('evidence_items')
        .select('*')
        .in('id', evidenceIds)
      evidenceItems = items || []
    }

    // Build platform-specific prompt
    const platformInstructions = buildPlatformInstructions(playbook)
    const prompt = buildUserPrompt({
      topic,
      format: mapPlaybookToFormat(playbook.format),
      regionContext: {
        locale: brand?.locale || 'pt-BR',
        regionName: 'Brazil',
        culturalNotes: brand?.cultural_notes,
      },
      evidenceItems: evidenceItems.map(e => ({
        title: e.title,
        source: e.source_name,
        summary: e.summary,
        url: e.source_url,
      })),
      brandVoice: {
        tone: playbook.tone,
        style: brand?.voice_description,
      },
      customInstructions: platformInstructions,
    })

    // Generate content
    const { text: content } = await generateArticleWithFallback({
      systemPrompt: 'You are a content generation agent for Brazilian digital marketing. Generate platform-native content following the playbook instructions.',
      userPrompt: prompt,
      task: 'generation',
    })

    // Record generation
    await supabase.from('content_requests').insert({
      brand_id: brandId,
      topic,
      format: mapPlaybookToFormat(playbook.format),
      platform: playbook.platform,
      pillar_id: pillarId,
      status: 'completed',
      generated_content: content,
      evidence_ids: evidenceIds,
      playbook_id: playbookId,
    })

    return NextResponse.json({
      content,
      platform: playbook.platform,
      format: playbook.format,
      metadata: {
        maxLength: playbook.max_length,
        tone: playbook.tone,
        ctaStyle: playbook.cta_style,
      },
    })
  } catch (error) {
    console.error('Playbook generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function buildPlatformInstructions(playbook: any): string {
  const parts: string[] = []
  
  parts.push(`Platform: ${playbook.platform}`)
  parts.push(`Format: ${playbook.format}`)
  parts.push(`Tone: ${playbook.tone}`)
  parts.push(`Structure: ${playbook.structure}`)
  parts.push(`CTA Style: ${playbook.cta_style}`)
  
  if (playbook.max_length) {
    parts.push(`Maximum length: ${playbook.max_length} characters`)
  }
  
  if (playbook.hashtag_strategy) {
    parts.push(`Hashtag strategy: ${playbook.hashtag_strategy}`)
  }
  
  if (playbook.emoji_policy) {
    parts.push(`Emoji policy: ${playbook.emoji_policy}`)
  }
  
  if (playbook.link_policy) {
    parts.push(`Link policy: ${playbook.link_policy}`)
  }
  
  if (playbook.visual_guidance) {
    parts.push(`Visual guidance: ${playbook.visual_guidance}`)
  }

  return parts.join('\n')
}

function mapPlaybookToFormat(format: string): ContentFormat {
  const formatMap: Record<string, ContentFormat> = {
    'carousel': 'instagram_carousel',
    'single_image': 'linkedin_post',
    'reels': 'short_video_script',
    'story': 'quick_note',
    'text_post': 'linkedin_post',
    'thread': 'x_thread',
    'article': 'article',
    'newsletter': 'email',
  }
  return formatMap[format] || 'article'
}
