export interface Article {
  id: string; created_at: string; topic: string; content_type: string | null;
  draft_content: string | null; final_content: string | null;
  status: 'draft' | 'reviewed' | 'published'; rating: number | null;
  comment: string | null; generation_model: string | null;
  prompt_version: string | null; book_source: string | null;
  source_context: string | null; word_count: number | null;
  char_count: number | null; template_id: string | null;
  region_id: string | null; locale: string | null;
  content_request_id: string | null;
}
