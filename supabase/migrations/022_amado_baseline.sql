-- Amado Stage 0 — Baseline Migration
-- 
-- Principles:
--   - Additive only (no destructive changes)
--   - Idempotent (IF NOT EXISTS / IF NOT EXISTS)
--   - No deletion of production data
--   - Fixes from §2: content-type drift, source-type bug, cron auth support
--
-- Run after: 022_pivot_phase1_cleanup_and_seed.sql

-- ─── 1. Normalize source_type in rss_sources ────────────────────────────────

-- Add source_type if missing (should exist, but be safe)
ALTER TABLE rss_sources 
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'rss';

-- Normalize inconsistent source types
UPDATE rss_sources 
  SET source_type = 'html_index' 
  WHERE source_type IN ('html', 'html_site');

UPDATE rss_sources 
  SET source_type = 'rss' 
  WHERE source_type IS NULL OR source_type = '';

-- Add region and language support for sources
ALTER TABLE rss_sources
  ADD COLUMN IF NOT EXISTS region_id TEXT,
  ADD COLUMN IF NOT EXISTS language_code TEXT,
  ADD COLUMN IF NOT EXISTS parser_config JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown';

-- Index for health queries
CREATE INDEX IF NOT EXISTS idx_rss_sources_health ON rss_sources (health_status, active);
CREATE INDEX IF NOT EXISTS idx_rss_sources_region ON rss_sources (region_id, active);

-- ─── 2. Add evidence fields to rss_items ────────────────────────────────────

-- Source language (independent of localization)
ALTER TABLE rss_items
  ADD COLUMN IF NOT EXISTS source_language TEXT,
  ADD COLUMN IF NOT EXISTS source_title TEXT,
  ADD COLUMN IF NOT EXISTS source_summary TEXT,
  ADD COLUMN IF NOT EXISTS content_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS entities TEXT[],
  ADD COLUMN IF NOT EXISTS topics TEXT[],
  ADD COLUMN IF NOT EXISTS region_ids TEXT[],
  ADD COLUMN IF NOT EXISTS source_authority NUMERIC DEFAULT 1.0;

-- Backfill: copy existing title/description to source_ fields
UPDATE rss_items 
  SET source_title = title,
      source_summary = description,
      source_language = 'en'
  WHERE source_title IS NULL AND title IS NOT NULL;

-- Index for deduplication and filtering
CREATE INDEX IF NOT EXISTS idx_rss_items_fingerprint ON rss_items (content_fingerprint) 
  WHERE content_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rss_items_canonical ON rss_items (canonical_url) 
  WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rss_items_language ON rss_items (source_language);

-- ─── 3. Add cron_state table for auth and throttling ────────────────────────

CREATE TABLE IF NOT EXISTS cron_state (
  key TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. Add generation_runs for observability ───────────────────────────────

CREATE TABLE IF NOT EXISTS generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  task TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT,
  input_hash TEXT,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_runs_article ON generation_runs (article_id);
CREATE INDEX IF NOT EXISTS idx_generation_runs_created ON generation_runs (created_at DESC);

-- ─── 5. Add content_formats registry table ──────────────────────────────────
-- Application-layer validation, but table enables future platform rules

CREATE TABLE IF NOT EXISTS content_formats (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  label_pt_br TEXT,
  max_chars INTEGER,
  max_words INTEGER,
  platform TEXT,
  category TEXT,
  supports_seo BOOLEAN DEFAULT false,
  supports_carousel BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Seed canonical formats (§2.1)
INSERT INTO content_formats (id, label, label_pt_br, max_chars, platform, category, supports_seo, supports_carousel, sort_order)
VALUES
  ('article', 'Article', 'Artigo', NULL, NULL, 'long', true, false, 1),
  ('linkedin_post', 'LinkedIn Post', 'Post LinkedIn', 3000, 'linkedin', 'short', false, true, 2),
  ('instagram_caption', 'Instagram Caption', 'Legenda Instagram', 2200, 'instagram', 'short', false, false, 3),
  ('instagram_carousel', 'Instagram Carousel', 'Carrossel Instagram', NULL, 'instagram', 'segmented', false, true, 4),
  ('x_thread', 'X / Threads', 'Thread X', 280, 'x', 'segmented', false, false, 5),
  ('facebook_post', 'Facebook Post', 'Post Facebook', 63206, 'facebook', 'short', false, false, 6),
  ('telegram_post', 'Telegram Post', 'Post Telegram', 4096, 'telegram', 'short', false, false, 7),
  ('short_video_script', 'Short Video Script', 'Roteiro Vídeo Curto', NULL, NULL, 'video', false, false, 8),
  ('email', 'Email', 'Email', NULL, NULL, 'long', true, false, 9),
  ('quick_note', 'Quick Note', 'Nota Rápida', 1200, NULL, 'short', false, false, 10),
  ('rewrite', 'Rewrite', 'Reescrita', NULL, NULL, 'other', false, false, 11)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  label_pt_br = EXCLUDED.label_pt_br,
  max_chars = EXCLUDED.max_chars,
  platform = EXCLUDED.platform,
  category = EXCLUDED.category,
  supports_seo = EXCLUDED.supports_seo,
  supports_carousel = EXCLUDED.supports_carousel,
  sort_order = EXCLUDED.sort_order;

-- ─── 6. Add feature flag tracking (optional, for audit) ─────────────────────

CREATE TABLE IF NOT EXISTS feature_flag_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT NOT NULL,
  flag_value BOOLEAN NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 7. Comments for documentation ──────────────────────────────────────────

COMMENT ON TABLE rss_sources IS 'Source registry with typed connector configuration';
COMMENT ON COLUMN rss_sources.source_type IS 'Connector type: rss, atom, html_index, api, manual';
COMMENT ON COLUMN rss_sources.parser_config IS 'JSON configuration for the connector parser';
COMMENT ON COLUMN rss_sources.health_status IS 'healthy | degraded | unhealthy | unknown';

COMMENT ON TABLE rss_items IS 'Normalized evidence items (source content independent of localization)';
COMMENT ON COLUMN rss_items.source_title IS 'Original title from source (source of truth)';
COMMENT ON COLUMN rss_items.source_summary IS 'Original summary from source (source of truth)';
COMMENT ON COLUMN rss_items.source_language IS 'Detected or declared language of source content';
COMMENT ON COLUMN rss_items.content_fingerprint IS 'Hash for deduplication';
COMMENT ON COLUMN rss_items.canonical_url IS 'Normalized URL for deduplication';

COMMENT ON TABLE content_formats IS 'Canonical content format registry (§2.1)';
COMMENT ON TABLE generation_runs IS 'AI generation observability log';
