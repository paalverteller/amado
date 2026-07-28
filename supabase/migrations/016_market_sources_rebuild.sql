-- 016_market_sources_rebuild.sql
-- Verified 10-source psychology set. Safe to re-run.

UPDATE rss_sources SET active = false;

INSERT INTO rss_sources (name, url, source_type, active, country) VALUES
  ('PsyPost',                    'https://www.psypost.org/feed/',                              'rss',  true, 'США'),
  ('Psychology Today',           'https://www.psychologytoday.com/us/latest/',                 'html', true, 'США'),
  ('Psych Central',              'https://psychcentral.com/feed/',                             'rss',  true, 'США'),
  ('BPS Research Digest',        'https://digest.bps.org.uk/feed/',                            'rss',  true, 'Великобритания'),
  ('APA News',                   'https://www.apa.org/news/press/releases/',                   'html', true, 'США'),
  ('APS Observer',               'https://www.psychologicalscience.org/observer/feed/',        'rss',  true, 'США'),
  ('ScienceDaily Psychology',    'https://www.sciencedaily.com/rss/mind_brain/psychology.xml', 'rss',  true, 'Мир'),
  ('Neuroscience News',          'https://neurosciencenews.com/feed/',                         'rss',  true, 'США'),
  ('Medical Xpress Psychology',  'https://medicalxpress.com/rss-feed/psychology-news/',        'rss',  true, 'Мир'),
  ('The Conversation Psychology','https://theconversation.com/us/psychology/feed',             'rss',  true, 'Мир')
ON CONFLICT (url) DO UPDATE SET
  name        = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  active      = EXCLUDED.active,
  country     = EXCLUDED.country;

-- Clear stale items (next refresh will repopulate)
DELETE FROM rss_items;

SELECT name, url, source_type, active, country
FROM rss_sources ORDER BY active DESC, country, name;
