-- 021_fix_sources.sql
-- Audit & rebuild of market RSS sources (June 2026)
-- Removes broken/off-topic sources, upgrades In-Mind to proper RSS,
-- adds verified 2026-active European/Asian-adjacent and RU sources.
--
-- SAFE: uses ON CONFLICT / UPDATE; does NOT DELETE rss_items.

-- ── Step 1: Deactivate broken / irrelevant / duplicate sources ──────────────

UPDATE rss_sources SET active = false
WHERE url IN (
  -- Japanese-American history site, unrelated to psychology
  'https://discovernikkei.org/en/feed',
  -- DW Health RSS blocked 403
  'https://rss.dw.com/xml/rss-en-health',
  -- Psychology Today: both endpoints blocked or empty
  'https://www.psychologytoday.com/intl/feed',
  'https://www.psychologytoday.com/rss',
  -- Research in Germany: no psychology output
  'https://www.research-in-germany.org/rss/news',
  -- Tokyo Mental Health: blocked / no output
  'https://www.tokyomentalhealth.com/feed',
  -- U-Tokyo: general press releases, off-topic
  'https://www.u-tokyo.ac.jp/focus/en/press/rss.xml',
  -- Verywell Mind: both endpoints blocked or duplicate
  'https://www.verywellmind.com/feed',
  'https://www.verywellmind.com/news-latest-research-and-trending-topics',
  -- World Economic Forum: mislabeled as Japan, producing Philips ads junk
  'https://www.weforum.org/rss',
  -- Psych Central: duplicate entry
  'https://psychcentral.com/feed'
);

-- ── Step 2: Fix In-Mind Magazine to its proper RSS endpoint ─────────────────

UPDATE rss_sources
SET
  url         = 'https://in-mind.org/rss.xml',
  source_type = 'rss',
  name        = 'In-Mind Magazine'
WHERE url IN (
  'https://www.in-mind.org/blog',
  'https://www.in-mind.org/'
);

-- ── Step 3: Add verified working sources ────────────────────────────────────

INSERT INTO rss_sources (name, url, source_type, active, country) VALUES

-- 🇬🇧 UK / Europe
('Mind Hacks',
 'https://mindhacks.com/feed',
 'rss', true, 'Великобритания'),

('Psychreg',
 'https://www.psychreg.org/feed',
 'rss', true, 'Великобритания'),

('BPS Research Digest',
 'https://digest.bps.org.uk/feed/',
 'rss', true, 'Великобритания'),

-- 🌍 World / Neuroscience flagship
('The Transmitter',
 'https://www.thetransmitter.org/feed/',
 'rss', true, 'Мир'),

('ScienceDaily Mind & Brain',
 'https://www.sciencedaily.com/rss/mind_brain.xml',
 'rss', true, 'Мир'),

('Medical Xpress Psychology',
 'https://medicalxpress.com/rss-feed/psychology-news/',
 'rss', true, 'Мир'),

-- 🇺🇸 USA - evidence-based / positive psychology
('Greater Good Berkeley',
 'https://greatergood.berkeley.edu/feeds/all',
 'rss', true, 'США'),

-- 🇷🇺 Russia
('B17 Психология',
 'https://www.b17.ru/rss/',
 'rss', true, 'Россия'),

('Naked Science Психология',
 'https://naked-science.ru/article/psy',
 'html_site', true, 'Россия'),

-- 🌏 Asia-Pacific via PubMed (dedicated query slot)
('PubMed Asia Psychology',
 'pubmed:asia_psychology',
 'pubmed', true, 'Азия')

ON CONFLICT (url) DO UPDATE SET
  name        = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  active      = true,
  country     = EXCLUDED.country;

-- ── Step 4: Re-activate existing good sources that may have been deactivated ─

UPDATE rss_sources SET active = true
WHERE url IN (
  'https://neurosciencenews.com/feed/',
  'https://www.psypost.org/feed/',
  'https://blog.frontiersin.org/feed/',
  'https://www.scielo.br/j/pusp/',
  'https://www.who.int/rss-feeds/news-english.xml'
)
  AND name NOT ILIKE '%psych central%';

-- ── Diagnostic output ────────────────────────────────────────────────────────

SELECT
  country,
  name,
  source_type,
  active,
  url
FROM rss_sources
ORDER BY active DESC, country, name;
