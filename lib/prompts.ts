/**
 * Amado — Prompt Composer
 * 
 * Stage 0 changes:
 *   - Canonical content format registry (§2.1)
 *   - No contradictory length rules (§2.4)
 *   - No Russian-only fields (§2.5)
 *   - No psychology-specific content (§1.3)
 *   - No author-gender logic (§1.3)
 *   - Structured prompt from single content spec object
 */

import { getSupabaseAdmin } from '@/lib/supabase/client'
import { isShortFormat, isSegmentedFormat, getFormatMeta, type ContentFormat } from './content-formats'
import { DEFAULT_LOCALE } from './locale'

export const CURRENT_PROMPT_VERSION = 'v1.0_amado_stage0'

// Re-export format helpers for backward compatibility
export { isShortFormat, isSegmentedFormat }

const PROMPT_FALLBACK = `<role>Especialista sênior de marketing digital com 10+ anos no mercado brasileiro.</role>
<voice>Direto, estratégico, com autoridade mas sem arrogância. Usa exemplos concretos do mercado brasileiro.</voice>
<forbidden>linguagem corporativa genérica ("sinergia", "paradigma"); tradução literal do inglês; clichês de marketing sem contexto; ausência de CTA</forbidden>
<format>Texto puro. Parágrafos curtos (3-4 frases). Subtítulos em nova linha, sem markdown. CTA claro no final.</format>
<language>${DEFAULT_LOCALE}</language>`

export async function buildSystemPrompt(
  templateId?: string | null,
): Promise<{ systemPrompt: string; version: string }> {
  let base = ''
  let version = 'fallback'

  if (templateId) {
    const { data, error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .select('system_prompt, version')
      .eq('id', templateId)
      .maybeSingle()

    if (!error && data?.system_prompt) {
      getSupabaseAdmin()
        .rpc('increment_template_usage', { p_template_id: templateId })
        .then(({ error: e }) => {
          if (e) console.warn('[prompts] usage increment failed:', e.message)
        })
      base = data.system_prompt
      version = data.version ?? CURRENT_PROMPT_VERSION
    }
  }

  if (!base) {
    const { data: def, error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .select('system_prompt, version')
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!error && def?.system_prompt) {
      base = def.system_prompt
      version = def.version ?? CURRENT_PROMPT_VERSION
    }
  }

  if (!base) {
    base = PROMPT_FALLBACK
    version = 'fallback'
  }

  return { systemPrompt: base, version }
}

// ─── Format-Specific Prompt Builders ────────────────────────────────────────

interface ContentSpec {
  topic: string
  format: ContentFormat
  locale?: string
  seoMode?: boolean
  brandProfileId?: string | null
  wordCount?: number | null
  charCount?: number | null
  regionContext?: { locale?: string; regionName?: string; culturalNotes?: string | null }
  evidenceItems?: { title?: string; source?: string; summary?: string; url?: string }[]
  brandVoice?: { tone?: string; style?: string }
  customInstructions?: string
}

function resolveLengthConstraints(spec: ContentSpec): { minChars: number; maxChars: number; minWords: number | null; maxWords: number | null } {
  const meta = getFormatMeta(spec.format)
  
  // Base constraints from format metadata
  let maxChars = meta?.maxChars ?? 2500
  const minChars = 200
  let minWords: number | null = null
  let maxWords: number | null = null
  
  // Override with explicit spec
  if (spec.charCount) maxChars = spec.charCount
  if (spec.wordCount) {
    maxWords = spec.wordCount
    minWords = Math.floor(spec.wordCount * 0.8)
  }
  
  // SEO mode: longer content, but never contradict base format
  if (spec.seoMode && meta?.supportsSeo) {
    minWords = minWords ?? 800
    maxWords = maxWords ?? 1500
    // For SEO, we use word count, not char count
    maxChars = 15000 // generous upper bound
  }
  
  return { minChars, maxChars, minWords, maxWords }
}

function buildFormatInstruction(spec: ContentSpec): string {
  const { maxChars, minWords, maxWords } = resolveLengthConstraints(spec)
  const meta = getFormatMeta(spec.format)
  
  const parts: string[] = []
  
  // Length instruction
  if (minWords && maxWords) {
    parts.push(`Length: ${minWords}–${maxWords} words`)
  } else if (maxChars) {
    parts.push(`Length: approximately ${Math.round(maxChars * 0.8)}–${maxChars} characters`)
  }
  
  // Format-specific rules
  switch (spec.format) {
    case 'article':
      parts.push('Structure: hook in first paragraph, 3-4 body paragraphs, CTA at end')
      parts.push('No generic introductions — start with the insight')
      break
    case 'linkedin_post':
      parts.push('Hook in first 125 characters')
      parts.push('Professional but conversational tone')
      parts.push('Clear CTA: comment, share, or visit')
      break
    case 'instagram_caption':
      parts.push('Conversational, emoji-appropriate')
      parts.push('Hashtags at end when relevant')
      parts.push('CTA: save, share, or comment')
      break
    case 'instagram_carousel':
      parts.push('Slide 1: hook title (max 8 words, no period)')
      parts.push('Slides 2-N: one idea per slide, title (6 words) + body (25 words)')
      parts.push('Last slide: conclusion or question + CTA')
      break
    case 'x_thread':
      parts.push('Post 1: hook without "thread about..."')
      parts.push('Each post ≤ 280 characters')
      parts.push('Last post: conclusion or reflection')
      break
    case 'telegram_post':
      parts.push('Direct, no fluff')
      parts.push('Links inline when relevant')
      break
    case 'short_video_script':
      parts.push('Visual hook → spoken hook → 3 beats → close → caption')
      break
    case 'email':
      parts.push('Subject line suggestion in first line')
      parts.push('Personalized opening')
      parts.push('Single clear CTA')
      break
    case 'quick_note':
      parts.push('Direct to the point')
      parts.push('Preserve original idea and tone')
      break
    case 'rewrite':
      parts.push('Preserve facts, change structure and wording')
      break
  }
  
  // SEO mode additions (only if format supports it)
  if (spec.seoMode && meta?.supportsSeo) {
    parts.push('SEO: organic keyword placement, descriptive H2s every 300-400 words')
    parts.push('Answer-first structure for featured snippets')
    parts.push('Cite sources, use concrete examples')
  }
  
  return parts.join('\n')
}

export async function buildRegionContextLayer(regionId?: string | null): Promise<string> {
  if (!regionId) return ''

  const { data: region, error: regionError } = await getSupabaseAdmin()
    .from('regions')
    .select('code, name, default_language_code, locale_code, currency_code, timezone')
    .eq('id', regionId)
    .eq('active', true)
    .maybeSingle()

  if (regionError || !region) return ''

  const parts: string[] = []
  parts.push(`<region>${region.name} (${region.code})</region>`)
  parts.push(`<locale>${region.locale_code}</locale>`)
  parts.push(`<currency>${region.currency_code}</currency>`)
  parts.push(`<timezone>${region.timezone}</timezone>`)

  const culturalNotes: Record<string, string> = {
    'BR': 'Brazilian market: use "você" (not "tu"), mention PIX for payments, WhatsApp as primary channel, Brazilian holidays (Carnaval, Black Friday BR in November, Dia das Mães in May), local examples (São Paulo, Rio, Mercado Livre). Avoid literal translations from English.',
    'US': 'US market: direct tone, credit card payments, email/SMS channels, US holidays (Thanksgiving, Black Friday, Memorial Day).',
    'GB': 'UK market: polite but direct, GBP currency, British spelling (colour, organise), UK holidays (Boxing Day, Bank Holidays).',
  }

  const note = culturalNotes[region.code]
  if (note) {
    parts.push(`<cultural_context>${note}</cultural_context>`)
  }

  return parts.join('\n')
}

export async function buildEvidenceContext(evidenceItemIds?: string[] | null): Promise<string> {
  if (!evidenceItemIds || evidenceItemIds.length === 0) return ''

  const { data: items, error } = await getSupabaseAdmin()
    .from('evidence_items')
    .select('source_title, source_summary, source_language, published_at')
    .in('id', evidenceItemIds)
    .order('discovered_at', { ascending: false })
    .limit(10)

  if (error || !items || items.length === 0) return ''

  const parts: string[] = []
  parts.push('<evidence_context>')
  parts.push('Source material for this content:')
  
  for (const item of items) {
    const date = item.published_at 
      ? new Date(item.published_at).toLocaleDateString('pt-BR')
      : 'recent'
    parts.push(`- [${date}] ${item.source_title}`)
    if (item.source_summary) {
      parts.push(`  ${item.source_summary.slice(0, 150)}`)
    }
  }
  
  parts.push('</evidence_context>')
  return parts.join('\n')
}

export function buildUserPrompt(spec: ContentSpec): string {
  // NOTE: `locale` is accepted here but every template below hardcodes
  // Portuguese (Brazil) directly — multi-locale support isn't actually
  // wired into these prompts yet. Flagging rather than silently guessing.
  const { topic, format } = spec
  
  if (format === 'quick_note') {
    return `<task>Raw user text:
"${topic}"</task>
<role>You are a ghostwriter who transforms rough notes into professional content for the Brazilian market.</role>
<format>${buildFormatInstruction(spec)}</format>
<rules>
- Preserve the original idea, tone, and intent — do not substitute your own idea.
- Develop the idea into cohesive text: add structure, examples, explain context, but do not invent facts.
- Write like a real person: natural sentences, varied rhythm (short and long mixed), light irony when appropriate.
- Zero AI-tells: no "no mundo moderno", "é importante notar", "vamos analisar", symmetric 3-item lists.
- No bureaucracy or academic introductions — straight to the point, like telling a friend.
- CTA at the end: what should the reader do next.
</rules>
<output_contract>Only the final text in Portuguese (Brazil). No markdown, no preambles, no "Artigo:" title.</output_contract>`
  }
  
  if (format === 'x_thread') {
    return `<task>Topic: "${topic}"</task>
<format>${buildFormatInstruction(spec)}</format>
<rules>
- Post 1: hook that makes the reader continue — no "thread about..." introductions.
- Each following post: one complete idea that develops the previous.
- Each post ≤ 280 characters.
- Last post: conclusion or invitation to reflect, not direct propaganda.
- Subtle CTA: "share", "what do you think?" when appropriate.
</rules>
<output_contract>Return ONLY a valid JSON array of strings, no markdown, no preambles:
["post 1 text", "post 2 text", ...]</output_contract>`
  }
  
  if (format === 'instagram_carousel') {
    return `<task>Topic: "${topic}"</task>
<format>${buildFormatInstruction(spec)}</format>
<rules>
- Slide 1: hook title, max 8 words, no period.
- Slides 2-N: one idea per slide, title (max 6 words) + explanation (max 25 words).
- Last slide: conclusion or question for the audience.
- CTA on last slide: "save", "share", "comment" when appropriate.
</rules>
<output_contract>Return ONLY a valid JSON array of objects, no markdown, no preambles:
[{ "title": "...", "body": "..." }, ...]
For first and last slide, "body" may be empty string.</output_contract>`
  }
  
  const formatInstruction = buildFormatInstruction(spec)
  
  const parts: string[] = []
  parts.push(`<task>Topic: "${topic}"</task>`)
  
  if (spec.regionContext) {
    parts.push(`<region>${spec.regionContext.regionName || 'Brazil'} (${spec.regionContext.locale || 'pt-BR'})</region>`)
    if (spec.regionContext.culturalNotes) {
      parts.push(`<cultural_notes>${spec.regionContext.culturalNotes}</cultural_notes>`)
    }
  }
  
  if (spec.brandVoice) {
    if (spec.brandVoice.tone) parts.push(`<tone>${spec.brandVoice.tone}</tone>`)
    if (spec.brandVoice.style) parts.push(`<brand_style>${spec.brandVoice.style}</brand_style>`)
  }
  
  if (spec.evidenceItems && spec.evidenceItems.length > 0) {
    parts.push('<evidence>')
    for (const item of spec.evidenceItems) {
      parts.push(`- ${item.title || 'Source'}: ${item.summary || ''}`)
    }
    parts.push('</evidence>')
  }
  
  if (spec.customInstructions) {
    parts.push(`<custom_instructions>${spec.customInstructions}</custom_instructions>`)
  }
  
  parts.push(`<format>${formatInstruction}</format>`)
  parts.push(`<rules>
- Title: catchy, precise, no clickbait — first line.
- Zero literal translations: adapt concepts to Brazilian context (e.g., "parcelamento" instead of "installments", "WhatsApp" as main channel).
- Paragraphs: 3-4 sentences, direct, answer the essence in first lines.
- Mandatory CTA at the end: what the reader should do (visit, buy, share, comment).
- Seasonality: when relevant, mention Brazilian dates (Carnaval, Black Friday BR, Dia das Mães).
</rules>
<output_contract>Only the final text in Portuguese (Brazil). No markdown, no preambles.</output_contract>`)
  
  return parts.join('\n')
}

export function buildLocalizationNotesPrompt(topic: string, contentType: string, rssContext: string): string {
  return `<task>Generate LOCALIZATION NOTES for head office explaining why this content was adapted this way for Brazil.</task>
<context>
Topic: "${topic}"
Format: ${contentType}
Brazilian market signals:
${rssContext || 'No specific signals available.'}
</context>
<rules>
- Explain 2-3 cultural adaptation decisions (why something was said a certain way).
- Mention Brazilian cultural references used and why they work.
- Point out pitfalls avoided (what does NOT work in Brazil).
- Format: short bullet points, in Portuguese (Brazil).
- Maximum 400 characters.
</rules>
<output_contract>Only the localization notes. No introductions, no markdown.</output_contract>`
}

export async function buildBrandVoiceLayer(brandProfileId?: string | null): Promise<string> {
  if (!brandProfileId) return ''

  const { data, error } = await getSupabaseAdmin()
    .from('brand_profiles')
    .select('brand_name, voice_description, forbidden_words, example_posts, target_audience, competitors')
    .eq('id', brandProfileId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return ''

  const parts: string[] = []
  parts.push(`<brand>${data.brand_name}</brand>`)
  
  if (data.voice_description) {
    parts.push(`<brand_voice>${data.voice_description}</brand_voice>`)
  }
  
  if (data.forbidden_words) {
    parts.push(`<brand_forbidden>Forbidden words and expressions for this brand: ${data.forbidden_words}</brand_forbidden>`)
  }
  
  if (data.example_posts) {
    parts.push(`<brand_examples>Examples of how this brand writes:\n${data.example_posts}</brand_examples>`)
  }
  
  if (data.target_audience) {
    parts.push(`<brand_audience>Target audience: ${data.target_audience}</brand_audience>`)
  }
  
  if (data.competitors) {
    parts.push(`<brand_competitors>Competitors for positioning reference: ${data.competitors}</brand_competitors>`)
  }

  return parts.join('\n')
}
