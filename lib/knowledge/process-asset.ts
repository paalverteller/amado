import { isFeatureEnabled } from '@/lib/amado-config'
import { chunkText, detectLanguage } from './chunking'
import { embedTexts, isEmbeddingConfigured } from './embeddings'
import {
  createSupabaseKnowledgeRepository,
  type KnowledgeRepository,
  type NewKnowledgeChunk,
} from '@/lib/repositories/knowledge-repository'
import { getErrorMessage } from '@/lib/api/error-message'

/**
 * MVP limit for synchronous processing (no background job queue exists
 * yet in this codebase — see docs/AMADO_ROADMAP.md Phase 9). ~300k chars
 * covers a long report or a mid-length book; anything bigger should be
 * split into multiple assets for now.
 */
export const MAX_ASSET_CHARS = 300_000

export interface ProcessAssetDeps {
  repo: KnowledgeRepository
}

function defaultDeps(): ProcessAssetDeps {
  return { repo: createSupabaseKnowledgeRepository() }
}

/**
 * Runs the full plan §7.4 pipeline for one asset: normalize -> chunk ->
 * embed (if configured) -> persist -> mark ready.
 *
 * Embeddings are best-effort: if AMADO_HYBRID_SEARCH_ENABLED is off or
 * OPENAI_API_KEY isn't set, chunks are stored without vectors and the
 * asset still becomes searchable via the keyword fallback — see
 * KnowledgeRepository.searchKeyword. A hard embedding *failure* (key
 * present but the API call errors) also degrades to keyword-only rather
 * than failing the whole asset, since a working keyword search beats no
 * search at all.
 */
export async function processKnowledgeAsset(assetId: string, deps: ProcessAssetDeps = defaultDeps()): Promise<void> {
  const { repo } = deps
  const asset = await repo.get(assetId)
  if (!asset) throw new Error(`Knowledge asset ${assetId} not found`)

  if (asset.raw_text.length > MAX_ASSET_CHARS) {
    const message = `Text is ${asset.raw_text.length} characters, over the ${MAX_ASSET_CHARS} MVP limit for synchronous processing. Split it into smaller assets.`
    await repo.markError(assetId, message)
    throw new Error(message)
  }

  await repo.markProcessing(assetId)

  try {
    const chunks = chunkText(asset.raw_text)
    if (chunks.length === 0) {
      await repo.markError(assetId, 'No extractable text after normalization')
      return
    }

    const language = detectLanguage(asset.raw_text)
    const shouldEmbed = isFeatureEnabled('hybridSearchEnabled') && isEmbeddingConfigured()

    let embeddings: Array<number[] | null> = chunks.map(() => null)
    if (shouldEmbed) {
      try {
        embeddings = await embedTexts(chunks.map((c) => c.content))
      } catch (embedError) {
        // Degrade to keyword-only rather than failing the asset — see
        // the doc comment above.
        console.warn(
          `[knowledge] embeddings failed for asset ${assetId}, falling back to keyword-only:`,
          getErrorMessage(embedError),
        )
      }
    }

    const rows: NewKnowledgeChunk[] = chunks.map((chunk, index) => ({
      chunk_index: index,
      content: chunk.content,
      char_count: chunk.charCount,
      embedding: embeddings[index] ?? null,
    }))

    await repo.replaceChunks(assetId, rows)
    await repo.markReady(assetId, language, rows.length)
  } catch (error) {
    await repo.markError(assetId, getErrorMessage(error))
    throw error
  }
}
