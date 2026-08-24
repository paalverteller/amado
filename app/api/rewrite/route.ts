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

const INTENSITY_INSTRUCTIONS: Record<string, Record<string, string>> = {
  light: {
    'pt-BR': 'Reformulação leve: altere a ordem das palavras em cerca de 30–40% das frases, use sinônimos naturais e preserve a estrutura dos parágrafos.',
    'es-ES': 'Reescritura ligera: cambia el orden de las palabras en aproximadamente el 30–40% de las frases, usa sinónimos naturales y conserva la estructura de los párrafos.',
    'de-DE': 'Leichte Überarbeitung: Ändere die Wortstellung in etwa 30–40 % der Sätze, verwende natürliche Synonyme und behalte die Absatzstruktur bei.',
    'en-US': 'Light rewrite: change wording and sentence order in roughly 30–40% of sentences, use natural synonyms, and preserve paragraph structure.',
  },
  medium: {
    'pt-BR': 'Reformulação média: reconstrua cerca de 60–70% das frases, ajuste a estrutura dos parágrafos quando fizer sentido e preserve integralmente o significado.',
    'es-ES': 'Reescritura media: reconstruye aproximadamente el 60–70% de las frases, ajusta la estructura de los párrafos cuando tenga sentido y conserva íntegramente el significado.',
    'de-DE': 'Mittlere Überarbeitung: Formuliere etwa 60–70 % der Sätze neu, passe die Absatzstruktur bei Bedarf an und bewahre die Bedeutung vollständig.',
    'en-US': 'Medium rewrite: reconstruct roughly 60–70% of sentences, adjust paragraph structure where useful, and fully preserve the meaning.',
  },
  deep: {
    'pt-BR': 'Reformulação profunda: reescreva completamente com palavras próprias, preservando fatos, ideia central e lógica. Mude estrutura, formulações e exemplos quando possível sem inventar nada.',
    'es-ES': 'Reescritura profunda: reescribe por completo con tus propias palabras, conservando hechos, idea central y lógica. Cambia estructura, formulaciones y ejemplos cuando sea posible sin inventar nada.',
    'de-DE': 'Tiefe Überarbeitung: Schreibe den Text vollständig in eigenen Worten neu und erhalte Fakten, Kernaussage und Logik. Ändere Struktur, Formulierungen und Beispiele, ohne etwas zu erfinden.',
    'en-US': 'Deep rewrite: rewrite the text completely in your own words while preserving facts, core idea, and logic. Change structure, phrasing, and examples where possible without inventing anything.',
  },
}
function estimateUniqueness(original: string, rewritten: string): number {
  // Heurística simples baseada na interseção de shingles de 4 palavras.
  // Não substitui um serviço real de anti-plágio, mas dá uma orientação.
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

  const origShingles = shingles(original)
  const newShingles   = shingles(rewritten)
  if (origShingles.size === 0) return 100

  let overlap = 0
  for (const s of newShingles) {
    if (origShingles.has(s)) overlap++
  }

  const overlapRatio = overlap / Math.max(newShingles.size, 1)
  const uniqueness = Math.max(0, Math.round((1 - overlapRatio) * 100))
  return uniqueness
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as RewriteBody
    const sourceText = (body.sourceText ?? '').trim()
    const intensity  = body.intensity ?? 'deep'
    const regionProfile = await resolveRegionProfile(body.regionId)

    if (!sourceText) {
      return NextResponse.json({ error: 'Исходный текст обязателен' }, { status: 400 })
    }
    if (sourceText.length < 200) {
      return NextResponse.json({ error: 'Текст слишком короткий: минимум 200 знаков' }, { status: 400 })
    }
    if (sourceText.length > 20000) {
      return NextResponse.json({ error: 'Текст слишком длинный: максимум 20 000 знаков' }, { status: 400 })
    }

    const intensityInstruction = INTENSITY_INSTRUCTIONS[intensity]?.[regionProfile.locale]
      ?? INTENSITY_INSTRUCTIONS.deep[regionProfile.locale]
      ?? INTENSITY_INSTRUCTIONS.deep['en-US']

    const systemPrompt = [
      'You are a professional editor and copywriter.',
      `Target market: ${regionProfile.name}.`,
      `Target locale: ${regionProfile.locale}.`,
      `Output language: ${regionProfile.languageName}.`,
      'Rewrite the provided text so that it fully preserves factual accuracy, meaning and intent.',
      'The result must sound native in the target locale and must not look like a literal translation.',
      'Do not invent facts, claims, examples, numbers or product capabilities.',
      'Avoid generic AI/corporate filler.',
      intensityInstruction,
      'Return ONLY the rewritten text. No preamble, no markdown, no process notes.',
    ].join('\n')

    const userPrompt = `SOURCE TEXT TO REWRITE:\n\n${sourceText}`

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
