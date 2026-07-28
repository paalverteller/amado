import { NextRequest, NextResponse } from 'next/server'
import { generateArticleWithFallback } from '@/lib/ai'
import { cleanPlainTextOutput } from '@/lib/text-cleanup'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

type RewriteBody = {
  sourceText?: string
  intensity?: 'light' | 'medium' | 'deep'
}

const INTENSITY_INSTRUCTIONS: Record<string, string> = {
  light: `Grau leve de reformulação: altere a ordem das palavras em 30-40% das frases,
substitua sinônimos óbvios, mantenha a estrutura dos parágrafos.`,
  medium: `Grau médio de reformulação: reconstrua completamente 60-70% das frases,
altere a estrutura dos parágrafos onde apropriado, substitua terminologia por sinônimos sem perder o sentido,
altere exemplos e metáforas para equivalentes.`,
  deep: `Grau profundo de reformulação: reescreva o texto COMPLETAMENTE com suas próprias palavras,
preservando apenas os fatos-chave, ideias e lógica da exposição. Altere:
- Estrutura das frases e parágrafos
- Estilo de exposição (mantendo o tom profissional)
- Exemplos para outros similares em sentido, mas diferentes em forma
- Ordem da argumentação, se isso não prejudicar a lógica
IMPORTANTE: o texto final deve passar em verificadores de plágio
com originalidade de no mínimo 85%, mas preservando 100% de precisão factual
e a ideia-chave do original.`,
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

    if (!sourceText) {
      return NextResponse.json({ error: 'Texto para reformulação é obrigatório' }, { status: 400 })
    }
    if (sourceText.length < 200) {
      return NextResponse.json({ error: 'Texto muito curto (mínimo 200 caracteres)' }, { status: 400 })
    }
    if (sourceText.length > 20000) {
      return NextResponse.json({ error: 'Texto muito longo (máximo 20000 caracteres)' }, { status: 400 })
    }

    const systemPrompt = [
      'Você é um editor profissional e redator.',
      'Sua tarefa é reescrever o texto fornecido de forma que ele:',
      '1. Preserve completamente a precisão factual e a ideia-chave do original.',
      '2. Soe natural em português do Brasil, sem traços de tradução automática.',
      '3. NÃO contenha clichês do tipo "Neste artigo" / "É importante notar" / "Vale ressaltar".',
      '4. Passe em verificadores de plágio com originalidade de no mínimo 85%.',
      '',
      INTENSITY_INSTRUCTIONS[intensity] ?? INTENSITY_INSTRUCTIONS.deep,
      '',
      'FORMATO ESTRITO DE SAÍDA:',
      'Retorne APENAS o texto reescrito. Sem preâmbulos, sem "Aqui está o texto reescrito:",',
      'sem marcação markdown, sem comentários sobre o processo de reformulação.',
    ].join('\n')

    const userPrompt = `TEXTO ORIGINAL PARA REFORMULAÇÃO:\n\n${sourceText}`

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
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
