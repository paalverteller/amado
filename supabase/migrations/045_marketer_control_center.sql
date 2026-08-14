-- Amado Sprint 11 — Marketer Control Center + explainable content analytics
-- Additive bridge from the real articles/content_requests generation pipeline
-- to campaigns, scheduling and content-pattern learning.

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT,
  primary_kpi TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'paused', 'completed', 'archived')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_brand_status
  ON marketing_campaigns (brand_id, status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_dates
  ON marketing_campaigns (starts_at, ends_at);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_marketing_campaigns" ON marketing_campaigns;
CREATE POLICY "allow_all_marketing_campaigns" ON marketing_campaigns
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS marketing_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_articles_campaign
  ON articles (marketing_campaign_id, status, created_at DESC)
  WHERE marketing_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_scheduled
  ON articles (scheduled_for)
  WHERE scheduled_for IS NOT NULL;

ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS marketing_campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_content_requests_campaign
  ON content_requests (marketing_campaign_id, created_at DESC)
  WHERE marketing_campaign_id IS NOT NULL;

-- Bridge the existing pattern table (originally content_assets-only) to the
-- real generation path, exactly like migration 043 bridged performance_snapshots.
ALTER TABLE content_pattern_usage
  ALTER COLUMN asset_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS topic_key TEXT,
  ADD COLUMN IF NOT EXISTS content_format TEXT,
  ADD COLUMN IF NOT EXISTS content_pillar_id UUID REFERENCES brand_content_pillars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS length_bucket TEXT,
  ADD COLUMN IF NOT EXISTS analysis_evidence JSONB NOT NULL DEFAULT '{}';

ALTER TABLE content_pattern_usage DROP CONSTRAINT IF EXISTS content_pattern_usage_target_check;
ALTER TABLE content_pattern_usage
  ADD CONSTRAINT content_pattern_usage_target_check
  CHECK (asset_id IS NOT NULL OR article_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_content_pattern_usage_article
  ON content_pattern_usage (article_id, platform)
  WHERE article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_pattern_usage_brand_recent
  ON content_pattern_usage (brand_id, created_at DESC);

-- Real canonical format registry maps telegram_post to the same legacy value,
-- but the original articles CHECK never allowed it. Fix the persistence path.
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_content_type_check;
ALTER TABLE articles
  ADD CONSTRAINT articles_content_type_check CHECK (
    content_type IN ('article', 'note', 'social_post', 'thread', 'carousel', 'telegram_post')
  );

COMMENT ON TABLE marketing_campaigns IS 'Campaign instances shown on the marketer home screen. campaign_profiles remains reusable policy/default configuration, not a running campaign.';
COMMENT ON COLUMN articles.scheduled_for IS 'Optional planned publication time used by Overview upcoming-content section; publishing itself remains external/manual.';
COMMENT ON COLUMN content_pattern_usage.analysis_evidence IS 'Deterministic classification evidence explaining why hook/CTA/topic/pillar/length labels were assigned.';
