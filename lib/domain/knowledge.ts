export type KnowledgeContentType =
  | 'book'
  | 'report'
  | 'note'
  | 'transcript'
  | 'guideline'
  | 'competitor_note'
  | 'other'

export type KnowledgeRetrievalMode = 'idea' | 'evidence' | 'brand'

export type KnowledgeProcessingStatus = 'pending' | 'processing' | 'ready' | 'error'

export interface KnowledgeAsset {
  id: string
  brand_id: string | null
  title: string
  content_type: KnowledgeContentType
  raw_text: string
  collection: string | null
  retrieval_mode: KnowledgeRetrievalMode
  language: string | null
  metadata_json: Record<string, unknown>
  processing_status: KnowledgeProcessingStatus
  processing_error: string | null
  active: boolean
  chunk_count: number
  source_note: string | null
  created_at: string
  updated_at: string
}

/** List views omit raw_text — it can be book-length and isn't needed for a table row. */
export type KnowledgeAssetSummary = Omit<KnowledgeAsset, 'raw_text'>

export interface KnowledgeChunk {
  id: string
  asset_id: string
  chunk_index: number
  content: string
  char_count: number | null
  metadata_json: Record<string, unknown>
  created_at: string
}

export interface KnowledgeSearchResult {
  chunk_id: string
  asset_id: string
  asset_title: string
  content: string
  /** null when the result came from the keyword fallback, not semantic search. */
  similarity: number | null
}
