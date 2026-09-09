-- Amado market intelligence sprint — shared competitor sources.
-- A source URL is globally unique in rss_sources, while the same company can
-- be tracked as a competitor in multiple market-specific Brand OS profiles.
-- This join table makes the relationship many-to-many without rewriting the
-- legacy rss_sources.competitor_id column.

CREATE TABLE IF NOT EXISTS competitor_source_links (
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (competitor_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_competitor_source_links_source_id
  ON competitor_source_links (source_id);

ALTER TABLE competitor_source_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_competitor_source_links" ON competitor_source_links;
CREATE POLICY "allow_all_competitor_source_links"
  ON competitor_source_links FOR ALL USING (true) WITH CHECK (true);

-- Backfill every legacy one-to-one link so existing competitor sources keep
-- working immediately after code switches to the shared-link model.
INSERT INTO competitor_source_links (competitor_id, source_id)
SELECT competitor_id, id
FROM rss_sources
WHERE competitor_id IS NOT NULL
ON CONFLICT (competitor_id, source_id) DO NOTHING;
