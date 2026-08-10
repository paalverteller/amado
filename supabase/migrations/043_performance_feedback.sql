-- Amado Sprint 9 — manual performance & feedback (Phase 8)
--
-- performance_snapshots already existed (migration 036) with a genuinely
-- well-designed metrics shape (per-platform fields: reach, saves, shares,
-- watch_time_seconds, retention_rate, etc.) and a 'manual' source option
-- -- exactly what this sprint needs. But asset_id pointed only at
-- content_assets (migration 034's content_packages system), which nothing
-- in the actual generation pipeline (articles / content_requests, used by
-- every sprint since Sprint 1) ever creates rows in. Bridging that gap
-- here rather than building a parallel metrics table.
--
-- Also found while reading app/api/brands/[brandId]/learning/route.ts:
-- that route's INSERT/SELECT statements use column names from neither
-- this migration's actual schema for performance_snapshots (metrics,
-- period_start, period_end, brand_id, format, content_pillar_id -- none
-- of which exist) nor for content_pattern_usage (pattern_key, usage_count,
-- avg_performance -- also don't exist) nor preference_profiles
-- (preference_type, preference_key, weight, performance_score -- real
-- columns are profile_type/pattern_key/pattern_value/confidence). That
-- route would 500 on every real call. Rewritten in this sprint's
-- accompanying script -- see apply script docstring -- not altering
-- these tables' shape to match the broken route; the route was wrong.

ALTER TABLE performance_snapshots
  ALTER COLUMN asset_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_hypothesis TEXT,
  ADD COLUMN IF NOT EXISTS ai_hypothesis_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_hypothesis_generated_at TIMESTAMPTZ;

ALTER TABLE performance_snapshots DROP CONSTRAINT IF EXISTS performance_snapshots_target_check;
ALTER TABLE performance_snapshots
  ADD CONSTRAINT performance_snapshots_target_check CHECK (asset_id IS NOT NULL OR article_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_article ON performance_snapshots (article_id) WHERE article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_brand ON performance_snapshots (brand_id) WHERE brand_id IS NOT NULL;

ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_performance_snapshots" ON performance_snapshots;
CREATE POLICY "allow_all_performance_snapshots" ON performance_snapshots FOR ALL USING (true) WITH CHECK (true);

COMMENT ON COLUMN performance_snapshots.article_id IS 'Links to articles (the actual generation pipeline) -- asset_id (content_packages system) is the older, separate path. Exactly one should be set, not both.';
COMMENT ON COLUMN performance_snapshots.ai_hypothesis IS 'AI-generated explanation of why this content may have performed as it did. Always a guess, never a measured fact -- surfaced in the UI as "Предположение AI", never as a stated cause. Generated on demand, not automatically.';
