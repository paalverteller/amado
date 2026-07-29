export interface ContentRequest {
  id: string; status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number; topic: string; content_format: string; locale: string;
  seo_mode: boolean; context: string | null; evidence_item_ids: string[] | null;
  rss_context: string | null; brand_profile_id: string | null;
  region_id: string | null; template_id: string | null;
  article_id: string | null; generated_content: string | null;
  generation_model: string | null; prompt_version: string | null;
  word_count: number | null; char_count: number | null;
  error_message: string | null; retry_count: number; max_retries: number;
  scheduled_at: string | null; processed_at: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}
