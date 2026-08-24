import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { generateArticleWithFallback } from '@/lib/ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { recordAiUsage } from '@/lib/ai-usage'
import { getErrorMessage } from '@/lib/api/error-message'
import { resolveRegionProfile } from '@/lib/prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = {
  sourceText?: string
  sourceLanguage?: string
  contextType?: 'ui' | 'promo' | 'help' | 'pricing' | 'legal'
  templateId?: string
  brandProfileId?: string
  regionId?: string
}

const CONTEXT_RULES: Record<NonNullable<Body['contextType']>, string> = {
  ui: 'UI copy: concise, unambiguous and functional. Prioritize action and scanability.',
  promo: 'Landing/promo: energetic when appropriate, but never generic hype.',
  help: 'Help content: calm, explicit and step-by-step when useful.',
  pricing: 'Pricing: precision over persuasion. Never hide conditions or limits.',
  legal: 'Legal/compliance: remove ambiguity. Preserve obligations, conditions and scope exactly.',
}

const LOCALE_RULES: Record<string, string> = {
  'pt-BR': `Write native Brazilian Portuguese.
Use modern, direct Brazilian wording and natural sentence structure.
Use “você”, never “tu”, unless source material is a literal quotation.
Avoid literal English syntax, generic SaaS clichés and unnecessary Anglicisms.
Use terminology that is natural in Brazilian digital products.
The final text must read as if written originally by an excellent Brazilian professional.`,

  'es-ES': `Escribe en español natural de España.
Usa vocabulario, sintaxis y convenciones propias de España, no español latinoamericano.
Prioriza formulaciones claras, directas y profesionales.
Usa “tú” por defecto en comunicación moderna, salvo que la marca exija “usted”.
Evita calcos del inglés, anglicismos innecesarios y clichés de software.
El resultado debe parecer escrito originalmente por un profesional español.`,

  'de-DE': `Schreibe natürliches Standarddeutsch für Deutschland.
Formuliere klar, präzise und professionell, ohne unnötige Werbeübertreibung.
Verwende im B2B-Kontext standardmäßig “Sie”, sofern die Markenstimme nicht ausdrücklich “du” vorgibt.
Vermeide wörtliche englische Satzstrukturen und unnötige Anglizismen.
Nutze Begriffe, die in deutschen digitalen Produkten tatsächlich üblich sind.
Der Text muss wirken, als wäre er ursprünglich von einem deutschen Profi geschrieben worden.`,

  'en-US': `Write natural US English.
Use concise, direct, professional American wording and US spelling.
Avoid translated European syntax, unnecessary jargon and generic SaaS hype.
Prefer terminology familiar in US digital products.
The final text must read as if written originally by an excellent US professional.`,
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
    if (sourceText.length < 2) return NextResponse.json({ error: 'Исходный текст обязателен' }, { status: 400 })
    if (sourceText.length > 40_000) return NextResponse.json({ error: 'Лимит: 40 000 знаков' }, { status: 400 })

    const template = await resolveTemplate(body.templateId)
    const contextType = body.contextType ?? 'promo'
    const regionProfile = await resolveRegionProfile(body.regionId)
    const localeRules = LOCALE_RULES[regionProfile.locale] ?? `Write native ${regionProfile.languageName}.`
    const systemPrompt = `${template.prompt}

IMPORTANT: Any target-market or target-language instruction in the stored template is subordinate to the execution contract below.

TARGET MARKET: ${regionProfile.name}
TARGET LOCALE: ${regionProfile.locale}
TARGET LANGUAGE: ${regionProfile.languageName}

${localeRules}

${CONTEXT_RULES[contextType]}

STRICT EXECUTION CONTRACT:
- The target locale is ${regionProfile.locale}.
- Preserve factual meaning. Never invent facts, offers, dates, legal conditions, metrics or product capabilities.
- Adapt terminology, syntax, register, punctuation, dates and idiom to the target market.
- Apply a native-speaker test before returning.
- Return ONLY the localized final copy. No explanation, no alternatives, no markdown wrapper.`

    const userPrompt = `${await brandContext(body.brandProfileId)}

SOURCE LANGUAGE: ${body.sourceLanguage || 'auto-detect'}
CONTENT CONTEXT: ${contextType}
TARGET MARKET: ${regionProfile.name}
TARGET LOCALE: ${regionProfile.locale}

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
