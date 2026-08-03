import { getSupabaseAdmin } from '@/lib/supabase/client'
import type { KnowledgeAsset, KnowledgeAssetSummary, KnowledgeSearchResult } from '@/lib/domain/knowledge'

export interface NewKnowledgeAsset {
  brand_id: string | null
  title: string
  content_type: string
  raw_text: string
  collection: string | null
  retrieval_mode: string
  source_note: string | null
}

export interface NewKnowledgeChunk {
  chunk_index: number
  content: string
  char_count: number
  embedding: number[] | null
}

export interface KnowledgeListFilters {
  brandId?: string
  collection?: string
  retrievalMode?: string
  activeOnly?: boolean
}

export interface KnowledgeSearchParams {
  query: string
  brandId?: string | null
  retrievalMode?: string | null
  limit: number
}

/**
 * Abstraction over knowledge_assets/knowledge_chunks. See
 * ContentRequestRepository (lib/repositories/content-request-repository.ts)
 * for why this exists as an interface rather than direct Supabase calls
 * scattered through routes/services.
 */
export interface KnowledgeRepository {
  list(filters: KnowledgeListFilters): Promise<KnowledgeAssetSummary[]>
  get(id: string): Promise<KnowledgeAsset | null>
  create(data: NewKnowledgeAsset): Promise<KnowledgeAsset>
  update(id: string, patch: Record<string, unknown>): Promise<KnowledgeAsset | null>
  remove(id: string): Promise<void>
  markProcessing(id: string): Promise<void>
  markReady(id: string, language: string, chunkCount: number): Promise<void>
  markError(id: string, message: string): Promise<void>
  replaceChunks(assetId: string, chunks: NewKnowledgeChunk[]): Promise<void>
  searchSemantic(embedding: number[], params: Omit<KnowledgeSearchParams, 'query'>): Promise<KnowledgeSearchResult[]>
  searchKeyword(params: KnowledgeSearchParams): Promise<KnowledgeSearchResult[]>
}

const ASSET_LIST_COLUMNS =
  'id, brand_id, title, content_type, collection, retrieval_mode, language, metadata_json, processing_status, processing_error, active, chunk_count, source_note, created_at, updated_at'

export function createSupabaseKnowledgeRepository(): KnowledgeRepository {
  return {
    async list(filters) {
      let query = getSupabaseAdmin()
        .from('knowledge_assets')
        .select(ASSET_LIST_COLUMNS)
        .order('created_at', { ascending: false })

      if (filters.brandId) query = query.eq('brand_id', filters.brandId)
      if (filters.collection) query = query.eq('collection', filters.collection)
      if (filters.retrievalMode) query = query.eq('retrieval_mode', filters.retrievalMode)
      if (filters.activeOnly) query = query.eq('active', true)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as KnowledgeAssetSummary[]
    },

    async get(id) {
      const { data, error } = await getSupabaseAdmin()
        .from('knowledge_assets')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as KnowledgeAsset) ?? null
    },

    async create(data) {
      const { data: row, error } = await getSupabaseAdmin()
        .from('knowledge_assets')
        .insert(data)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return row as KnowledgeAsset
    },

    async update(id, patch) {
      const { data, error } = await getSupabaseAdmin()
        .from('knowledge_assets')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as KnowledgeAsset) ?? null
    },

    async remove(id) {
      const { error } = await getSupabaseAdmin().from('knowledge_assets').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },

    async markProcessing(id) {
      const { error } = await getSupabaseAdmin()
        .from('knowledge_assets')
        .update({ processing_status: 'processing', processing_error: null, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },

    async markReady(id, language, chunkCount) {
      const { error } = await getSupabaseAdmin()
        .from('knowledge_assets')
        .update({
          processing_status: 'ready',
          language,
          chunk_count: chunkCount,
          processing_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },

    async markError(id, message) {
      const { error } = await getSupabaseAdmin()
        .from('knowledge_assets')
        .update({ processing_status: 'error', processing_error: message.slice(0, 2000), updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },

    async replaceChunks(assetId, chunks) {
      const admin = getSupabaseAdmin()

      const { error: deleteError } = await admin.from('knowledge_chunks').delete().eq('asset_id', assetId)
      if (deleteError) throw new Error(deleteError.message)

      if (chunks.length === 0) return

      const rows = chunks.map((c) => ({
        asset_id: assetId,
        chunk_index: c.chunk_index,
        content: c.content,
        char_count: c.char_count,
        embedding: c.embedding,
      }))

      const { error: insertError } = await admin.from('knowledge_chunks').insert(rows)
      if (insertError) throw new Error(insertError.message)
    },

    async searchSemantic(embedding, params) {
      const { data, error } = await getSupabaseAdmin().rpc('match_knowledge_chunks', {
        query_embedding: embedding,
        match_brand_id: params.brandId ?? null,
        match_retrieval_mode: params.retrievalMode ?? null,
        match_count: params.limit,
      })
      if (error) throw new Error(error.message)

      type Row = { chunk_id: string; asset_id: string; asset_title: string; content: string; similarity: number }
      return ((data ?? []) as Row[]).map((r) => ({
        chunk_id: r.chunk_id,
        asset_id: r.asset_id,
        asset_title: r.asset_title,
        content: r.content,
        similarity: r.similarity,
      }))
    },

    // Two-step application-level join (rather than a single Supabase query
    // filtering on an embedded resource's columns) — simpler to reason
    // about and verify than relying on the `!inner` embedded-filter syntax
    // for a query this shape.
    async searchKeyword(params) {
      const admin = getSupabaseAdmin()

      let assetQuery = admin
        .from('knowledge_assets')
        .select('id, title')
        .eq('active', true)
        .eq('processing_status', 'ready')
      if (params.brandId) assetQuery = assetQuery.eq('brand_id', params.brandId)
      if (params.retrievalMode) assetQuery = assetQuery.eq('retrieval_mode', params.retrievalMode)

      const { data: assets, error: assetError } = await assetQuery
      if (assetError) throw new Error(assetError.message)
      if (!assets || assets.length === 0) return []

      type AssetRow = { id: string; title: string }
      const titleById = new Map((assets as AssetRow[]).map((a) => [a.id, a.title]))
      const assetIds = (assets as AssetRow[]).map((a) => a.id)

      const { data: chunks, error: chunkError } = await admin
        .from('knowledge_chunks')
        .select('id, asset_id, content')
        .in('asset_id', assetIds)
        .ilike('content', `%${params.query}%`)
        .limit(params.limit)
      if (chunkError) throw new Error(chunkError.message)

      type ChunkRow = { id: string; asset_id: string; content: string }
      return ((chunks ?? []) as ChunkRow[]).map((c) => ({
        chunk_id: c.id,
        asset_id: c.asset_id,
        asset_title: titleById.get(c.asset_id) ?? '',
        content: c.content,
        similarity: null,
      }))
    },
  }
}
