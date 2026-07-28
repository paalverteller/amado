import { NextRequest, NextResponse } from 'next/server'
import { generateArticleWithFallback } from '@/lib/ai'

export const maxDuration = 45
export const dynamic = 'force-dynamic'

type CheckBody = { text?: string; brandVoice?: string; forbiddenWords?: string; examples?: string }

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

const JUDGE_SYSTEM_PROMPT = `Você é um especialista em análise de texto para marketing digital no Brasil. Avalie o texto quanto a:
1. Marcadores de IA (clichês, estrutura simétrica excessiva, generalizações vazias, tom sem emoção)
2. Consistência de voz da marca (se brand voice for fornecido)
3. Adequação ao público brasileiro (localização, gírias naturais, referências culturais)

Critérios de marcadores de IA em pt-BR:
- Clichês corporativos ("é importante destacar", "no cenário atual", "desempenha papel fundamental")
- Estrutura simétrica artificial (listas sempre com 3 itens, parágrafos do mesmo tamanho)
- Generalizações sem dados ("muitos especialistas dizem", "pesquisas mostram" sem fonte)
- Tom excessivamente neutro, sem personalidade de marca
- Construções sintáticas repetidas (mesmo início de frase)
- Conectivos artificiais em excesso: "além disso", "dessa forma", "em conclusão"
- Falta de detalhes concretos, números, nomes — frases genéricas

Critérios de consistência de voz (se aplicável):
- O tom corresponde à descrição da voz da marca?
- Há palavras proibidas sendo usadas?
- O estilo se assemelha aos exemplos fornecidos?

FORMATO DA RESPOSTA — JSON válido, sem markdown, sem preâmbulo:
{
  "score": <número 0-100, onde 0 = parece humano, 100 = claramente IA>,
  "verdictLabel": "<Parece humano / Alguns marcadores de IA / Muito parecido com IA>",
  "flags": [
    { "type": "<categoria>", "excerpt": "<citação do texto, max 15 palavras>", "suggestion": "<correção específica>" }
  ],
  "summary": "<2-3 frases de conclusão>"
}

Máximo 5 flags. Se o texto estiver bom, retorne array vazio.`

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as CheckBody
    const text = (body.text ?? '').trim()
    const brandVoice = (body.brandVoice ?? '').trim()
    const forbiddenWords = (body.forbiddenWords ?? '').trim()
    const examples = (body.examples ?? '').trim()

    if (!text) {
      return NextResponse.json({ error: 'Texto para verificação é obrigatório' }, { status: 400 })
    }
    if (text.length < 100) {
      return NextResponse.json({ error: 'Texto muito curto para análise' }, { status: 400 })
    }

    let userPrompt = `TEXTO PARA VERIFICAÇÃO:\n\n${text.slice(0, 8000)}`
    if (brandVoice) {
      userPrompt += `\n\nVOZ DA MARCA:\n${brandVoice.slice(0, 2000)}`
    }
    if (forbiddenWords) {
      userPrompt += `\n\nPALAVRAS PROIBIDAS:\n${forbiddenWords.slice(0, 500)}`
    }
    if (examples) {
      userPrompt += `\n\nEXEMPLOS DE REFERÊNCIA:\n${examples.slice(0, 2000)}`
    }

    const result = await generateArticleWithFallback({
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userPrompt,
    })

    let verdict: Verdict
    try {
      const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
      verdict = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível analisar a resposta do modelo. Tente novamente.' },
        { status: 502 },
      )
    }

    // Defensive normalization
    verdict.score = Math.max(0, Math.min(100, Math.round(verdict.score ?? 50)))
    verdict.flags = Array.isArray(verdict.flags) ? verdict.flags.slice(0, 5) : []

    return NextResponse.json(verdict)
  } catch (err) {
    console.error('[ai-check] error:', err)
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
