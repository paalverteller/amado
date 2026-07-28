-- Stabilize RSS source inserts from /api/rss.
-- Older migrations created source_type as NOT NULL, while the current API inserts only name/url.
ALTER TABLE rss_sources
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'rss';

UPDATE rss_sources
SET source_type = 'rss'
WHERE source_type IS NULL;

ALTER TABLE rss_sources
  ALTER COLUMN source_type SET DEFAULT 'rss',
  ALTER COLUMN source_type SET NOT NULL;
