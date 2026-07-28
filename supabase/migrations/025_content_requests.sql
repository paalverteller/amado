-- Amado Stage 3 — Content Generation Pipeline
-- 
-- §10.1: Content request queue
-- §10.2: Brand voice + region context integration
-- §10.3: Evidence-driven generation

-- ─── 1. Content requests (generation queue) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS content_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request metadata
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Content specification
  topic TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'article',
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  seo_mode BOOLEAN DEFAULT false,
  
  -- Context
  context TEXT,
  evidence_item_ids UUID[],
  rss_context TEXT,
  
  -- Brand & region
  brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  template_id UUID REFERENCES prompt_templates(id) ON DELETE SET NULL,
  
  -- Generation result
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  generated_content TEXT,
  generation_model TEXT,
  prompt_version TEXT,
  word_count INTEGER,
  char_count INTEGER,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_requests_status 
  ON content_requests (status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_content_requests_scheduled 
  ON content_requests (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_requests_brand 
  ON content_requests (brand_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_content_requests_region 
  ON content_requests (region_id, status);

-- ─── 2. Content request evidence junction ───────────────────────────────────

CREATE TABLE IF NOT EXISTS content_request_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_request_id UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
  evidence_item_id UUID NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relevance_score NUMERIC DEFAULT 1.0,
  used_in_generation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_request_id, evidence_item_id)
);

CREATE INDEX IF NOT EXISTS idx_content_request_evidence_request 
  ON content_request_evidence (content_request_id);
CREATE INDEX IF NOT EXISTS idx_content_request_evidence_item 
  ON content_request_evidence (evidence_item_id);

-- ─── 3. Update articles with content_request link ───────────────────────────

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS content_request_id UUID REFERENCES content_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL;

-- ─── 4. Update evidence_items with generation tracking ──────────────────────

ALTER TABLE evidence_items
  ADD COLUMN IF NOT EXISTS times_used_in_generation INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- ─── 5. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE content_requests IS 'Queue of content generation jobs with brand voice and region context';
COMMENT ON COLUMN content_requests.status IS 'pending | processing | completed | failed | cancelled';
COMMENT ON COLUMN content_requests.evidence_item_ids IS 'Array of evidence items used as context';
COMMENT ON COLUMN content_requests.priority IS '1 = highest, 10 = lowest';
COMMENT ON TABLE content_request_evidence IS 'Junction table linking content requests to evidence items with relevance scores';
