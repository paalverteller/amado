export interface RssSource {
  id: string; name: string; url: string;
  source_type: string; active: boolean;
  created_at?: string; country?: string | null;
  region_id?: string | null; language_code?: string | null;
  parser_config?: Record<string, unknown> | null;
  last_fetched_at?: string | null;
  consecutive_failures?: number;
  health_status?: string;
}

export interface RssItem {
  id: string; source_id: string | null;
  title: string | null; title_ru: string | null;
  description: string | null; summary_ru: string | null;
  link: string | null; published_at: string | null;
  collected_at: string; source?: { name: string; url: string } | null;
  source_language?: string | null;
  source_title?: string | null;
  source_summary?: string | null;
}
