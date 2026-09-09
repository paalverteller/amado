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
  /**
   * Fable review, Phase 1: added so generate-article.ts can persist the
   * article BEFORE the best-effort localization-notes LLM call instead
   * of after, and attach notes as a follow-up update once they're ready
   * (or skip the update entirely if they fail). Optional so existing
   * fakes in generate-article.test.ts that don't need to assert on this
   * behavior keep compiling unchanged; generateAndPersistArticle only
   * calls it when both localizationNotes and articleId are present.
   */
  updateSourceContext?(articleId: string, sourceContext: string): Promise<{ error: ArticleInsertError | null }>
}

export function createSupabaseArticleRepository(): ArticleRepository {
  return {
    async create(data) {
      const { data: row, error } = await getSupabaseAdmin().from('articles').insert(data).select('id').single()
      return { id: row?.id ?? null, error: error ? { message: error.message } : null }
    },
    async updateSourceContext(articleId, sourceContext) {
      const { error } = await getSupabaseAdmin().from('articles').update({ source_context: sourceContext }).eq('id', articleId)
      return { error: error ? { message: error.message } : null }
    },
  }
}
