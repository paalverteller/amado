import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/client'
import { buildUserPrompt } from '@/lib/prompts'
import { generateArticleWithFallback } from '@/lib/ai'
import type { ContentFormat } from '@/lib/content-formats'

/** Row shape actually read from `evidence_items` in this route. */
interface EvidenceItemRow {
  title: string | null
  source_name: string | null
  summary: string | null
  source_url: string | null
}

/**
 * Row shape actually read from `platform_playbooks` in this route.
 * NOTE: this does not match `lib/brand-os/types.ts`'s `PlatformPlaybook`
 * (that one is camelCase and describes a different, newer schema) — the
 * fields below reflect what's actually queried/used here.
 */
interface PlaybookRow {
  platform: string
  format: string
  tone: string | null
  structure: string | null
  cta_style: string | null
  max_length: number | null
  hashtag_strategy: string | null
  emoji_policy: string | null
  link_policy: string | null
  visual_guidance: string | null
}

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
    // Bug fix: queried a `brands` table that doesn't exist in this schema
    // (same bug as app/api/brands/[brandId]/overview/route.ts) —
    // brand_profiles is correct. This was previously always undefined,
    // silently dropping brand voice/tone from playbook generation.
    // Note: `cultural_notes` still isn't a real column on brand_profiles —
    // brand?.cultural_notes below stays undefined; flagging rather than
    // inventing a column that was never actually added anywhere.
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('id', brandId)
      .single()

    // Fetch pillar if specified
    // NOTE: fetched but not currently passed into buildUserPrompt() below —
    // looks like pillar context was meant to inform the prompt but was
    // never wired in. Flagging rather than guessing at the intended usage.
    if (pillarId) {
      await supabase
        .from('brand_content_pillars')
        .select('*')
        .eq('id', pillarId)
        .single()
    }

    // Fetch evidence items
    let evidenceItems: EvidenceItemRow[] = []
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
        title: e.title ?? undefined,
        source: e.source_name ?? undefined,
        summary: e.summary ?? undefined,
        url: e.source_url ?? undefined,
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

function buildPlatformInstructions(playbook: PlaybookRow): string {
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
