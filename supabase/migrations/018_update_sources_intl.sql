-- 018_update_sources_intl.sql
-- Remove BPS Research Digest; add Germany, Japan, Brazil sources.

-- Remove BPS
UPDATE rss_sources SET active = false
WHERE url = 'https://digest.bps.org.uk/feed/';

-- Germany: Max Planck Neuroscience — aggregates all MPI institutes
INSERT INTO rss_sources (name, url, source_type, active, country)
VALUES (
  'Max Planck Neuroscience',
  'https://maxplanckneuroscience.org/feed/',
  'rss', true, 'Германия'
)
ON CONFLICT (url) DO UPDATE SET
  name        = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  active      = EXCLUDED.active,
  country     = EXCLUDED.country;

-- Japan: RIKEN Center for Brain Science — HTML scrape (no public RSS)
INSERT INTO rss_sources (name, url, source_type, active, country)
VALUES (
  'RIKEN Brain Science',
  'https://cbs.riken.jp/en/news/',
  'html', true, 'Япония'
)
ON CONFLICT (url) DO UPDATE SET
  name        = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  active      = EXCLUDED.active,
  country     = EXCLUDED.country;

-- Brazil: EurekAlert! Neuroscience — AAAS, geo-unrestricted
-- Covers USP, UFRJ, Fiocruz and all Latin American research output
INSERT INTO rss_sources (name, url, source_type, active, country)
VALUES (
  'EurekAlert! Neuroscience',
  'https://www.eurekalert.org/rss/news_by_subject/neu.xml',
  'rss', true, 'Бразилия / Мир'
)
ON CONFLICT (url) DO UPDATE SET
  name        = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  active      = EXCLUDED.active,
  country     = EXCLUDED.country;

-- Verify current active sources
SELECT name, url, source_type, active, country
FROM rss_sources
ORDER BY active DESC, country, name;
