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
}

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
  }
}
