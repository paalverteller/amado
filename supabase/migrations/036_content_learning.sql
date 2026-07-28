-- Amado Sprint 2 — Content Learning and Pattern Management
-- 
-- §8.7: performance_snapshots, content_pattern_usage, preference_profiles
-- §14-15: Pattern rotation and performance learning

-- ─── 1. Performance snapshots ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  horizon TEXT NOT NULL CHECK (horizon IN ('3h', '24h', '72h', '7d', 'manual')),
  
  -- Reach and engagement
  reach INTEGER,
  impressions INTEGER,
  followers INTEGER,
  non_follower_reach INTEGER,
  
  -- Engagement metrics
  saves INTEGER,
  shares INTEGER,
  replies INTEGER,
  comments INTEGER,
  likes INTEGER,
  
  -- Deep metrics
  watch_time_seconds INTEGER,
  retention_rate NUMERIC,
  rewatches INTEGER,
  profile_visits INTEGER,
  dms INTEGER,
  whatsapp_starts INTEGER,
  link_clicks INTEGER,
  
  -- Qualitative
  qualitative_notes TEXT,
  
  -- Source
  source TEXT CHECK (source IN ('manual', 'api', 'csv_import')),
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_asset ON performance_snapshots (asset_id, horizon);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_platform ON performance_snapshots (platform, recorded_at DESC);

-- ─── 2. Content pattern usage ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_pattern_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  
  -- Pattern metadata
  hook_type TEXT,
  opening_syntax TEXT,
  content_formula TEXT,
  structure_pattern TEXT,
  ending_type TEXT,
  cta_type TEXT,
  product_mention_position TEXT,
  named_character_used BOOLEAN,
  brazilian_detail_used TEXT,
  banner_type TEXT,
  visual_direction_type TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pattern_usage_brand ON content_pattern_usage (brand_id, platform);
CREATE INDEX IF NOT EXISTS idx_pattern_usage_hook ON content_pattern_usage (brand_id, platform, hook_type);

-- ─── 3. Preference profiles (derived, reversible) ───────────────────────────

CREATE TABLE IF NOT EXISTS preference_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('hook', 'structure', 'ending', 'cta', 'visual', 'tone')),
  pattern_key TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, profile_type, pattern_key, pattern_value)
);

CREATE INDEX IF NOT EXISTS idx_preference_profiles_brand ON preference_profiles (brand_id, profile_type);
CREATE INDEX IF NOT EXISTS idx_preference_profiles_confidence ON preference_profiles (brand_id, confidence DESC);

-- ─── 4. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE performance_snapshots IS 'Platform-specific performance data at defined time horizons';
COMMENT ON TABLE content_pattern_usage IS 'Pattern metadata for fatigue detection and rotation';
COMMENT ON TABLE preference_profiles IS 'Derived preferences from performance data — never overrides hard rules';
