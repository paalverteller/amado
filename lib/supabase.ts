import { createClient as _supabaseCreateClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null
let _admin:  SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY')
    _client = _supabaseCreateClient(url, key)
  }
  return _client
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
    
    const key = roleKey ?? anonKey
    if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or ANON_KEY')

    _admin = roleKey
      ? _supabaseCreateClient(url, roleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : _supabaseCreateClient(url, key)
  }
  return _admin
}

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

export interface BrandProfile { 
  id: string; created_at: string; updated_at: string; 
  brand_name: string; voice_description: string; 
  forbidden_words: string; example_posts: string; 
  target_audience: string; competitors: string; 
  is_active: boolean; region_id: string | null;
  positioning: string; value_propositions: string;
  strategic_themes: string; product_facts: string;
  proof_points: string; cta_library: string;
  legal_disclaimers: string; glossary: string;
  sensitive_topics: string; default_platform_rules: string;
  is_default: boolean;
}

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

export interface PromptTemplate { 
  id: string; created_at: string; name: string; 
  tone_description: string; system_prompt: string; 
  content_types: string[]; is_default: boolean; 
  is_active: boolean; usage_count: number; version: string; 
}

export interface Region {
  id: string; code: string; name: string;
  default_language_code: string; locale_code: string;
  currency_code: string; timezone: string;
  active: boolean;
}

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
