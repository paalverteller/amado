/**
 * OpenAI embeddings via a direct REST call — deliberately not going
 * through the ai-sdk's embed()/embedMany() helpers. This mirrors the
 * existing generateDeepSeekText() pattern in lib/ai-utils.ts (raw fetch,
 * same timeout/error-shape conventions) and sidesteps any dependency on
 * exactly which embedding-method name the installed ai-sdk version
 * exposes — embeddings are a simple enough single-purpose call that the
 * sdk's abstraction doesn't buy much here.
 */

import { withTimeout, getErrorMessage } from '@/lib/ai-utils'

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 64
const EMBEDDING_TIMEOUT_MS = 30_000

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

interface OpenAiEmbeddingItem {
  embedding: number[]
  index: number
}

interface OpenAiEmbeddingResponse {
  data?: OpenAiEmbeddingItem[]
}

/**
 * Embeds a batch of texts, returning one embedding per input in the same
 * order regardless of what order the API returns them in. Throws if the
 * API key is missing or a request fails — callers decide how to degrade
 * (see processKnowledgeAsset, which stores chunks without embeddings
 * rather than failing the whole asset when this isn't configured or
 * errors out).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  if (texts.length === 0) return []

  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await withTimeout(
      fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
      }),
      EMBEDDING_TIMEOUT_MS,
      'openai-embeddings',
    )

    const raw = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI embeddings ${response.status}: ${raw.slice(0, 500)}`)
    }

    let parsed: OpenAiEmbeddingResponse
    try {
      parsed = JSON.parse(raw) as OpenAiEmbeddingResponse
    } catch (e) {
      throw new Error(`OpenAI embeddings: could not parse response — ${getErrorMessage(e)}`)
    }

    const sorted = (parsed.data ?? []).slice().sort((a, b) => a.index - b.index)
    for (const item of sorted) results.push(item.embedding)
  }

  return results
}
