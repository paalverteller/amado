import { getSupabaseAdmin } from '@/lib/supabase/client'

export interface NewContentRequestRecord {
  status: 'processing'
  topic: string
  content_format: string
  locale: string
  seo_mode: boolean
  context: string | null
  evidence_item_ids: string[] | null
  rss_context: string | null
  brand_profile_id: string | null
  region_id: string | null
  template_id: string | null
  generated_content: string
  generation_model: string
  prompt_version: string
  word_count: number
  char_count: number
  processed_at: string
  thread_id: string
  parent_request_id: string | null
  refinement_note: string | null
  knowledge_chunk_ids: string[] | null
  brand_snapshot_summary: unknown
  marketing_campaign_id: string | null
}

export interface ContentRequestRecord {
  id: string
  thread_id: string | null
  parent_request_id: string | null
  topic: string
  content_format: string
  generated_content: string | null
  refinement_note: string | null
  brand_snapshot_summary: unknown
  knowledge_chunk_ids: string[] | null
  evidence_item_ids: string[] | null
  created_at: string
}

/**
 * Abstraction over the `content_requests` table. High-level generation
 * logic depends on this interface, not on Supabase directly — makes the
 * generation workflow testable with a fake repository and keeps the
 * database client out of business-logic modules.
 */
export interface ContentRequestRepository {
  /** Record a (just-completed) generation attempt. Returns null if the
   * insert fails — callers decide whether that's fatal. */
  record(data: NewContentRequestRecord): Promise<{ id: string } | null>
  markCompleted(id: string): Promise<void>
  markFailed(id: string, message: string): Promise<void>
  getById(id: string): Promise<ContentRequestRecord | null>
  /** All versions in a thread, oldest first — for the version-history UI. */
  getThread(threadId: string): Promise<ContentRequestRecord[]>
  linkEvidence(contentRequestId: string, evidenceItemIds: string[]): Promise<void>
}

const RECORD_COLUMNS =
  'id, thread_id, parent_request_id, topic, content_format, generated_content, refinement_note, brand_snapshot_summary, knowledge_chunk_ids, evidence_item_ids, created_at'

export function createSupabaseContentRequestRepository(): ContentRequestRepository {
  return {
    async record(data) {
      const { data: row, error } = await getSupabaseAdmin()
        .from('content_requests')
        .insert(data)
        .select('id')
        .single()
      if (error || !row) {
        console.error('[content-request-repository] record failed:', error?.message)
        return null
      }
      return row
    },
    async markCompleted(id) {
      const { error } = await getSupabaseAdmin()
        .from('content_requests')
        .update({ status: 'completed' })
        .eq('id', id)
      if (error) console.error('[content-request-repository] markCompleted failed:', error.message)
    },
    async markFailed(id, message) {
      const { error } = await getSupabaseAdmin()
        .from('content_requests')
        .update({ status: 'failed', error_message: message })
        .eq('id', id)
      if (error) console.error('[content-request-repository] markFailed failed:', error.message)
    },
    async getById(id) {
      const { data, error } = await getSupabaseAdmin()
        .from('content_requests')
        .select(RECORD_COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (error) {
        console.error('[content-request-repository] getById failed:', error.message)
        return null
      }
      return (data as ContentRequestRecord) ?? null
    },
    async getThread(threadId) {
      const { data, error } = await getSupabaseAdmin()
        .from('content_requests')
        .select(RECORD_COLUMNS)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      if (error) {
        console.error('[content-request-repository] getThread failed:', error.message)
        return []
      }
      return (data as ContentRequestRecord[]) ?? []
    },
    async linkEvidence(contentRequestId, evidenceItemIds) {
      if (evidenceItemIds.length === 0) return
      const admin = getSupabaseAdmin()
      const rows = Array.from(new Set(evidenceItemIds)).map((evidenceItemId) => ({
        content_request_id: contentRequestId,
        evidence_item_id: evidenceItemId,
        relevance_score: 1,
        used_in_generation: true,
      }))
      const { error } = await admin.from('content_request_evidence').upsert(rows, { onConflict: 'content_request_id,evidence_item_id' })
      if (error) console.error('[content-request-repository] linkEvidence failed:', error.message)
      await admin.from('evidence_items').update({ last_used_at: new Date().toISOString() }).in('id', evidenceItemIds)
    },
  }
}