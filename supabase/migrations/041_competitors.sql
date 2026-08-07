-- Amado Sprint 7 — competitor intelligence (Phase 6)
--
-- Per the roadmap's own note ("reuses `sources` table per plan §10.2"):
-- competitor content sources are NOT a parallel ingestion system. They are
-- ordinary rss_sources rows (RSS/newsletter/changelog/manual all already
-- supported since Sprint 5), just tagged back to a competitor via the new
-- competitor_id column. This means competitor sources get the full existing
-- pipeline for free: health tracking, hydration, the manual-paste path for
-- newsletters, everything built in Sprint 5.
--
-- competitors itself is new: the entity being tracked (name, website, why
-- we care), scoped to a brand_profiles row since different brands compete
-- in different spaces.
--
-- AI-written reviews are NOT a new content store either -- Sprint 3's
-- knowledge_assets already anticipated this exact use case
-- (content_type CHECK already includes 'competitor_note', migration 038).
-- Reusing it means reviews get chunking + embedding + search for free via
-- the existing lib/knowledge/process-asset.ts pipeline, and are available
-- as grounding context wherever knowledge_assets already gets used.

CREATE TABLE IF NOT EXISTS competitors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  website          TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  last_reviewed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_brand ON competitors (brand_id, status);

ALTER TABLE rss_sources
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rss_sources_competitor ON rss_sources (competitor_id) WHERE competitor_id IS NOT NULL;

ALTER TABLE knowledge_assets
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_assets_competitor ON knowledge_assets (competitor_id) WHERE competitor_id IS NOT NULL;

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_competitors" ON competitors;
CREATE POLICY "allow_all_competitors" ON competitors FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE competitors IS 'Tracked competitor entities, scoped per brand. Content sources are ordinary rss_sources rows linked via competitor_id -- see migration comment.';
COMMENT ON COLUMN rss_sources.competitor_id IS 'Set when this source (RSS/newsletter/changelog/manual) tracks a competitor rather than general market content. Pair with source_category = ''competitor''.';
COMMENT ON COLUMN knowledge_assets.competitor_id IS 'Set for AI-written competitor reviews (content_type = ''competitor_note''), linking the review back to the competitor it covers.';
