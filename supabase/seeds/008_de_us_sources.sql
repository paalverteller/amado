-- Amado — Validated Germany (DE) + United States (US) Sources
--
-- 11 sources verified live on 2026-08-25 (fetched actual RSS/Atom XML,
-- confirmed publication dates within the last 1-4 days at verification time).
-- DE and US regions existed with zero rss_sources prior to this seed
-- (see supabase/seeds/007_germany_us_locales.sql).
--
-- Categories used match the existing convention from 001_brazil_sources.sql /
-- 005_spain_region.sql: marketing, business, technology, business_technology.
--
-- Run: psql -d your_db -f supabase/seeds/008_de_us_sources.sql
-- Or paste directly into the Supabase SQL Editor.

BEGIN;

-- ─── Germany (DE) ────────────────────────────────────────────────────────────

WITH de AS (
  SELECT id FROM regions WHERE code = 'DE' LIMIT 1
)
INSERT INTO rss_sources (
  id, name, url, source_type, country, region_id,
  language_code, active, source_category, authority_weight,
  health_status, last_success_at
) VALUES
  -- Technology / digital economy
  (gen_random_uuid(), 't3n', 'https://t3n.de/rss.xml', 'rss', 'Deutschland', (SELECT id FROM de), 'de-DE', true, 'technology', 1.1, 'healthy', now()),

  -- Marketing & advertising
  (gen_random_uuid(), 'HORIZONT Marketing', 'https://www.horizont.net/news/feed/marketing/', 'rss', 'Deutschland', (SELECT id FROM de), 'de-DE', true, 'marketing', 1.2, 'healthy', now()),
  (gen_random_uuid(), 'OnlineMarketing.de', 'https://onlinemarketing.de/feed', 'rss', 'Deutschland', (SELECT id FROM de), 'de-DE', true, 'marketing', 1.1, 'healthy', now()),

  -- Startups / business technology
  (gen_random_uuid(), 'Gründerszene (Business Insider DE)', 'https://www.businessinsider.de/gruenderszene/feed/', 'rss', 'Deutschland', (SELECT id FROM de), 'de-DE', true, 'business_technology', 1.2, 'healthy', now()),

  -- Business / economy
  (gen_random_uuid(), 'Handelsblatt Unternehmen', 'https://feeds.cms.handelsblatt.com/unternehmen', 'rss', 'Deutschland', (SELECT id FROM de), 'de-DE', true, 'business', 1.4, 'healthy', now()),
  (gen_random_uuid(), 'Handelsblatt Technologie', 'https://feeds.cms.handelsblatt.com/technologie', 'rss', 'Deutschland', (SELECT id FROM de), 'de-DE', true, 'technology', 1.3, 'healthy', now())

ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  region_id = EXCLUDED.region_id,
  active = EXCLUDED.active,
  source_category = EXCLUDED.source_category,
  authority_weight = EXCLUDED.authority_weight,
  health_status = EXCLUDED.health_status,
  last_success_at = EXCLUDED.last_success_at,
  updated_at = now();

-- ─── United States (US) ──────────────────────────────────────────────────────

WITH us AS (
  SELECT id FROM regions WHERE code = 'US' LIMIT 1
)
INSERT INTO rss_sources (
  id, name, url, source_type, country, region_id,
  language_code, active, source_category, authority_weight,
  health_status, last_success_at
) VALUES
  -- Technology / startups
  (gen_random_uuid(), 'TechCrunch', 'https://techcrunch.com/feed/', 'rss', 'United States', (SELECT id FROM us), 'en-US', true, 'technology', 1.4, 'healthy', now()),
  (gen_random_uuid(), 'VentureBeat', 'https://venturebeat.com/feed/', 'rss', 'United States', (SELECT id FROM us), 'en-US', true, 'technology', 1.2, 'healthy', now()),

  -- Marketing / martech
  (gen_random_uuid(), 'MarTech', 'https://martech.org/feed/', 'rss', 'United States', (SELECT id FROM us), 'en-US', true, 'marketing', 1.2, 'healthy', now()),

  -- SaaS / B2B business
  (gen_random_uuid(), 'SaaStr', 'https://www.saastr.com/feed/', 'rss', 'United States', (SELECT id FROM us), 'en-US', true, 'business_technology', 1.1, 'healthy', now()),

  -- Advertising / brand marketing
  (gen_random_uuid(), 'Adweek', 'https://www.adweek.com/feed/', 'rss', 'United States', (SELECT id FROM us), 'en-US', true, 'marketing', 1.2, 'healthy', now())

ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  region_id = EXCLUDED.region_id,
  active = EXCLUDED.active,
  source_category = EXCLUDED.source_category,
  authority_weight = EXCLUDED.authority_weight,
  health_status = EXCLUDED.health_status,
  last_success_at = EXCLUDED.last_success_at,
  updated_at = now();

-- ─── Source health baseline event (records the verification pass itself) ────
-- Note: rss_sources.items_count already defaults to 0 for new rows, so no
-- separate UPDATE is needed there. health_status/last_success_at are set
-- directly on INSERT above.

INSERT INTO source_health_events (source_id, event_type, items_yielded, created_at)
SELECT s.id, 'success', 0, now()
FROM rss_sources s
JOIN regions r ON r.id = s.region_id
WHERE r.code IN ('DE', 'US')
  AND s.url IN (
    'https://t3n.de/rss.xml',
    'https://www.horizont.net/news/feed/marketing/',
    'https://onlinemarketing.de/feed',
    'https://www.businessinsider.de/gruenderszene/feed/',
    'https://feeds.cms.handelsblatt.com/unternehmen',
    'https://feeds.cms.handelsblatt.com/technologie',
    'https://techcrunch.com/feed/',
    'https://venturebeat.com/feed/',
    'https://martech.org/feed/',
    'https://www.saastr.com/feed/',
    'https://www.adweek.com/feed/'
  );

COMMIT;

-- ─── Verification ────────────────────────────────────────────────────────────

SELECT
  r.code AS region,
  s.name,
  s.url,
  s.source_category,
  s.authority_weight,
  s.active
FROM rss_sources s
JOIN regions r ON r.id = s.region_id
WHERE r.code IN ('DE', 'US')
ORDER BY r.code, s.source_category, s.name;
