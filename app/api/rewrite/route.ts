import { NextRequest, NextResponse } from 'next/server'
import { generateArticleWithFallback } from '@/lib/ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'
import { apiError } from '@/lib/api/errors'
import { resolveRegionProfile } from '@/lib/prompts'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

type RewriteBody = {
  sourceText?: string
  intensity?: 'light' | 'medium' | 'deep'
  regionId?: string
}

const INTENSITY_INSTRUCTIONS: Record<string, string> = {
  light: `Light rewrite: preserve paragraph structure and meaning, but change wording and sentence construction where useful.`,
  medium: `Medium rewrite: substantially reconstruct wording and sentence structure while preserving facts, meaning and professional tone.`,
  deep: `Deep rewrite: rewrite the text completely in your own words while preserving factual accuracy, key ideas and logical relationships. You may change paragraph structure and argument order when this improves clarity.`,
}

function estimateUniqueness(original: string, rewritten: string): number {
  const shingles = (text: string): Set<string> => {
    const words = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean)

    const out = new Set<string>()
    for (let i = 0; i <= words.length - 4; i++) {
      out.add(words.slice(i, i + 4).join(' '))
    }
    return out
  }

  const originalSet = shingles(original)
  const rewrittenSet = shingles(rewritten)

  if (originalSet.size === 0) return 100

  let intersection = 0
  for (const shingle of originalSet) {
    if (rewrittenSet.has(shingle)) intersection += 1
  }

  const overlap = intersection / originalSet.size
  return Math.max(0, Math.min(100, Math.round((1 - overlap) * 100)))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as RewriteBody
    const regionProfile = await resolveRegionProfile(body.regionId)
    const sourceText = body.sourceText?.trim() ?? ''
    const intensity = body.intensity ?? 'deep'

    if (!sourceText) {
      return NextResponse.json({ error: 'Исходный текст обязателен' }, { status: 400 })
    }
    if (sourceText.length < 200) {
      return NextResponse.json({ error: 'Текст слишком короткий: минимум 200 знаков' }, { status: 400 })
    }
    if (sourceText.length > 20_000) {
      return NextResponse.json({ error: 'Текст слишком длинный: максимум 20 000 знаков' }, { status: 400 })
    }

    const systemPrompt = [
      'You are a professional editor and copywriter.',
      `Rewrite in ${regionProfile.languageName} (${regionProfile.locale}) for ${regionProfile.name}.`,
      'Preserve all factual claims, names, numbers, dates, conditions and the key meaning of the original.',
      'Use natural native-market syntax, vocabulary, punctuation and register.',
      'Do not translate sentence structures literally.',
      'Avoid generic AI phrasing, corporate filler, unnecessary jargon and invented facts.',
      INTENSITY_INSTRUCTIONS[intensity] ?? INTENSITY_INSTRUCTIONS.deep,
      '',
      'STRICT OUTPUT FORMAT:',
      'Return ONLY the rewritten final text.',
      'No preamble, no markdown wrapper, no alternatives and no commentary about the rewrite process.',
    ].join('\n')

    const userPrompt = `ORIGINAL TEXT:\n\n${sourceText}`

    const result = await generateArticleWithFallback({
      systemPrompt,
      userPrompt,
    })

    const rewritten = cleanPlainTextOutput(result.text)
    const uniqueness = estimateUniqueness(sourceText, rewritten)

    return NextResponse.json({
      rewritten,
      uniqueness,
      originalLength: sourceText.length,
      rewrittenLength: rewritten.length,
      model: result.model ?? null,
    })
  } catch (err) {
    console.error('[rewrite] error:', err)
    return apiError(err)
  }
}
