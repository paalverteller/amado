import { getSupabaseAdmin } from '@/lib/supabase/client'

export interface NewArticleRecord {
  topic: string
  content_type: string
  draft_content: string
  status: 'draft'
  generation_model: string
  prompt_version: string
  source_context: string | null
  template_id: string | null
  brand_profile_id: string | null
  word_count: number
  char_count: number
  content_request_id: string | null
  locale: string
  region_id: string | null
  marketing_campaign_id: string | null
}

export interface ArticleInsertError {
  message: string
}

/**
 * Abstraction over the `articles` table. See ContentRequestRepository for
 * why this exists as an interface rather than a direct Supabase call.
 */
export interface ArticleRepository {
  create(data: NewArticleRecord): Promise<{ id: string | null; error: ArticleInsertError | null }>
}

export function createSupabaseArticleRepository(): ArticleRepository {
  return {
    async create(data) {
      const { data: row, error } = await getSupabaseAdmin().from('articles').insert(data).select('id').single()
      return { id: row?.id ?? null, error: error ? { message: error.message } : null }
    },
  }
}
