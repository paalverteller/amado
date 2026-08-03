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
