import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { generateArticleWithFallback } from '@/lib/ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { recordAiUsage } from '@/lib/ai-usage'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = {
  sourceText?: string
  sourceLanguage?: string
  contextType?: 'ui' | 'promo' | 'help' | 'pricing' | 'legal'
  templateId?: string
  brandProfileId?: string
}

const CONTEXT_RULES: Record<NonNullable<Body['contextType']>, string> = {
  ui: 'UI copy: curto, inequívoco, funcional. Priorize ação e escaneabilidade.',
  promo: 'Landing/promo: pode ser mais quente e energético, mas nunca hype genérico.',
  help: 'Help Center: calmo, explícito, passo a passo quando necessário.',
  pricing: 'Pricing: precisão acima de persuasão. Não esconda condições ou limites.',
  legal: 'Legal/compliance: máxima ambiguidade zero. Preserve exatamente obrigações, condições e escopo.',
}

async function resolveTemplate(templateId?: string): Promise<{ prompt: string; id: string | null }> {
  const admin = getSupabaseAdmin()
  if (templateId) {
    const { data, error } = await admin
      .from('prompt_templates')
      .select('id, system_prompt')
      .eq('id', templateId)
      .eq('is_active', true)
      .maybeSingle()
    if (!error && data?.system_prompt) return { prompt: data.system_prompt, id: data.id }
  }

  const { data, error } = await admin
    .from('prompt_templates')
    .select('id, system_prompt')
    .contains('content_types', ['localization'])
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.system_prompt) {
    throw new Error('Localization prompt is not installed. Run supabase/seeds/003_final_workspaces.sql.')
  }
  return { prompt: data.system_prompt, id: data.id }
}

async function brandContext(brandProfileId?: string): Promise<string> {
  if (!brandProfileId) return ''
  const { data } = await getSupabaseAdmin()
    .from('brand_profiles')
    .select('brand_name, voice_description, forbidden_words, glossary, cta_library, legal_disclaimers')
    .eq('id', brandProfileId)
    .maybeSingle()

  if (!data) return ''
  return [
    '<brand_context>',
    `Brand: ${data.brand_name}`,
    `Voice: ${data.voice_description || ''}`,
    `Forbidden: ${data.forbidden_words || ''}`,
    `Glossary: ${data.glossary || ''}`,
    `CTA library: ${data.cta_library || ''}`,
    `Legal: ${data.legal_disclaimers || ''}`,
    '</brand_context>',
  ].join('\n')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Body
    const sourceText = body.sourceText?.trim() ?? ''
    if (sourceText.length < 2) return NextResponse.json({ error: 'Source text is required' }, { status: 400 })
    if (sourceText.length > 40_000) return NextResponse.json({ error: 'MVP limit: 40,000 characters' }, { status: 400 })

    const template = await resolveTemplate(body.templateId)
    const contextType = body.contextType ?? 'promo'
    const systemPrompt = `${template.prompt}

${CONTEXT_RULES[contextType]}

STRICT EXECUTION CONTRACT:
- Target locale is always Brazilian Portuguese (pt-BR).
- Preserve factual meaning. Never invent facts, offers, dates, legal conditions, metrics or product capabilities.
- Apply the native test before returning.
- Return ONLY the localized final copy. No explanation, no alternatives, no markdown wrapper.`

    const userPrompt = `${await brandContext(body.brandProfileId)}

SOURCE LANGUAGE: ${body.sourceLanguage || 'auto-detect'}
CONTENT CONTEXT: ${contextType}

SOURCE TEXT:
${sourceText}`

    const result = await generateArticleWithFallback({ systemPrompt, userPrompt, maxTokens: 5000 })
    await recordAiUsage('localization', result.model, result.usage)

    return NextResponse.json({
      localizedText: cleanPlainTextOutput(result.text),
      model: result.model,
      templateId: template.id,
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
