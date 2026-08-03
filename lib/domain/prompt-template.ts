export interface PromptTemplate {
  id: string; created_at: string; name: string;
  tone_description: string; system_prompt: string;
  content_types: string[]; is_default: boolean;
  is_active: boolean; usage_count: number; version: string;
}
