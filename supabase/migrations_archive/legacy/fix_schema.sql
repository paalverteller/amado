-- 1. Fix RSS Unique Constraint
ALTER TABLE rss_sources DROP CONSTRAINT IF EXISTS rss_sources_url_unique;
ALTER TABLE rss_sources ADD CONSTRAINT rss_sources_url_unique UNIQUE (url);

-- 2. Ensure articles has consistent draft/final structure
ALTER TABLE articles ADD COLUMN IF NOT EXISTS draft_content TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS final_content TEXT;

-- 3. Fix prompt_templates constraints
ALTER TABLE prompt_templates DROP CONSTRAINT IF EXISTS prompt_templates_name_unique;
ALTER TABLE prompt_templates ADD CONSTRAINT prompt_templates_name_unique UNIQUE (name);
