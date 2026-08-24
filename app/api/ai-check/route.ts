import { NextRequest, NextResponse } from 'next/server'
import { generateArticleWithFallback } from '@/lib/ai'
import { resolveRegionProfile } from '@/lib/prompts'

export const maxDuration = 45
export const dynamic = 'force-dynamic'

type CheckBody = {
  text?: string
  brandVoice?: string
  forbiddenWords?: string
  examples?: string
  regionId?: string
}

type Flag = {
  type: string
  excerpt: string
  suggestion: string
}

type Verdict = {
  score: number
  verdictLabel: string
  flags: Flag[]
  summary: string
}

function buildJudgePrompt(locale: string, languageName: string, marketName: string): string {
  return `You are a senior marketing-copy editor.

Evaluate the supplied text for:
1. AI-writing markers: clichés, excessive symmetry, empty generalizations, repetitive syntax, artificial transitions and generic filler.
2. Brand-voice consistency when brand context is supplied.
3. Native-market fit for ${marketName}: ${languageName} (${locale}).

MARKET / LANGUAGE RULES:
- Judge the text as native copy for ${marketName}, not as a translation.
- Flag literal translations, unnatural syntax, wrong regional vocabulary, inappropriate register and punctuation conventions from another locale.
- Do not penalize natural local terminology merely because it originated in English.
- Do not invent brand rules that were not supplied.
- All diagnostic labels, explanations and suggestions returned to the Amado interface must be in Russian.

RESPONSE FORMAT — valid JSON only:
{
  "score": <number 0-100, where 0 = strongly human/native and 100 = clearly AI-like>,
  "verdictLabel": "<Естественный текст / Есть признаки ИИ / Сильно похож на ИИ>",
  "flags": [
    {
      "type": "<категория на русском>",
      "excerpt": "<точная цитата из проверяемого текста, максимум 15 слов>",
      "suggestion": "<конкретное исправление на русском>"
    }
  ],
  "summary": "<2-3 коротких предложения на русском>"
}

Maximum 5 flags. If there are no meaningful issues, return an empty flags array.`
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as CheckBody
    const regionProfile = await resolveRegionProfile(body.regionId)

    const text = (body.text ?? '').trim()
    const brandVoice = (body.brandVoice ?? '').trim()
    const forbiddenWords = (body.forbiddenWords ?? '').trim()
    const examples = (body.examples ?? '').trim()

    if (!text) {
      return NextResponse.json({ error: 'Текст для проверки обязателен' }, { status: 400 })
    }
    if (text.length < 100) {
      return NextResponse.json({ error: 'Текст слишком короткий для анализа' }, { status: 400 })
    }

    let userPrompt = `TEXT TO CHECK:\n\n${text.slice(0, 8000)}`
    if (brandVoice) {
      userPrompt += `\n\nBRAND VOICE:\n${brandVoice.slice(0, 2000)}`
    }
    if (forbiddenWords) {
      userPrompt += `\n\nFORBIDDEN WORDS / PHRASES:\n${forbiddenWords.slice(0, 500)}`
    }
    if (examples) {
      userPrompt += `\n\nREFERENCE EXAMPLES:\n${examples.slice(0, 2000)}`
    }

    const result = await generateArticleWithFallback({
      systemPrompt: buildJudgePrompt(
        regionProfile.locale,
        regionProfile.languageName,
        regionProfile.name,
      ),
      userPrompt,
    })

    let verdict: Verdict
    try {
      const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
      verdict = JSON.parse(cleaned) as Verdict
    } catch {
      return NextResponse.json(
        { error: 'Не удалось разобрать ответ модели. Попробуйте ещё раз.' },
        { status: 502 },
      )
    }

    verdict.score = Math.max(0, Math.min(100, Math.round(verdict.score ?? 50)))
    verdict.verdictLabel = typeof verdict.verdictLabel === 'string'
      ? verdict.verdictLabel
      : 'Есть признаки ИИ'
    verdict.flags = Array.isArray(verdict.flags) ? verdict.flags.slice(0, 5) : []
    verdict.summary = typeof verdict.summary === 'string' ? verdict.summary : ''

    return NextResponse.json(verdict)
  } catch (err) {
    console.error('[ai-check] error:', err)
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
