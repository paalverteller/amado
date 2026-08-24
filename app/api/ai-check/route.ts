import { NextRequest, NextResponse } from 'next/server'
import { generateArticleWithFallback } from '@/lib/ai'
import { resolveRegionProfile } from '@/lib/prompts'

export const maxDuration = 45
export const dynamic = 'force-dynamic'

type CheckBody = { text?: string; brandVoice?: string; forbiddenWords?: string; examples?: string; regionId?: string }

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

function buildJudgeSystemPrompt(languageName: string, marketName: string): string {
  return `You are a senior marketing copy editor. Evaluate the supplied text as copy written for ${marketName} in ${languageName}.

Evaluate:
1. AI-writing markers: clichés, repetitive syntax, artificial symmetry, vague generalizations and emotionally flat prose.
2. Brand-voice consistency when brand guidance is supplied.
3. Native-market fit: idiom, register, terminology and cultural naturalness for ${marketName}.
4. Factual discipline: flag unsupported claims or invented specificity when visible in the text.

Do not penalize a text merely for being concise or professional. Judge whether it sounds naturally written by a strong local professional.

Return valid JSON only, with no markdown or preamble:
{
  "score": <0-100, where 0 = convincingly human and 100 = clearly AI-like>,
  "verdictLabel": "<Похоже на человека / Есть признаки ИИ / Сильно похоже на ИИ>",
  "flags": [
    { "type": "<категория по-русски>", "excerpt": "<цитата, максимум 15 слов>", "suggestion": "<конкретное исправление по-русски>" }
  ],
  "summary": "<краткий вывод на русском, 2–3 предложения>"
}

Maximum 5 flags. If the text is strong, return an empty flags array.`
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as CheckBody
    const text = (body.text ?? '').trim()
    const brandVoice = (body.brandVoice ?? '').trim()
    const forbiddenWords = (body.forbiddenWords ?? '').trim()
    const examples = (body.examples ?? '').trim()
    const regionProfile = await resolveRegionProfile(body.regionId)

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
      userPrompt += `\n\nFORBIDDEN WORDS:\n${forbiddenWords.slice(0, 500)}`
    }
    if (examples) {
      userPrompt += `\n\nREFERENCE EXAMPLES:\n${examples.slice(0, 2000)}`
    }

    const result = await generateArticleWithFallback({
      systemPrompt: buildJudgeSystemPrompt(regionProfile.languageName, regionProfile.name),
      userPrompt,
    })

    let verdict: Verdict
    try {
      const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
      verdict = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Не удалось разобрать ответ модели. Попробуйте ещё раз.' },
        { status: 502 },
      )
    }

    // Defensive normalization
    verdict.score = Math.max(0, Math.min(100, Math.round(verdict.score ?? 50)))
    verdict.flags = Array.isArray(verdict.flags) ? verdict.flags.slice(0, 5) : []

    return NextResponse.json(verdict)
  } catch (err) {
    console.error('[ai-check] error:', err)
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
