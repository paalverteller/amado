ALTER TABLE rss_sources DROP CONSTRAINT IF EXISTS rss_sources_url_unique;
ALTER TABLE rss_sources ADD CONSTRAINT rss_sources_url_unique UNIQUE (url);

INSERT INTO rss_sources (name, url, active)
VALUES
('Psychology Today','https://www.psychologytoday.com/intl/feed', true),
('Greater Good','https://greatergood.berkeley.edu/feeds/all', true),
('APA','https://www.apa.org/news/rss', true),
('Science Daily','https://www.sciencedaily.com/rss/mind_brain.xml', true),
('B17','https://www.b17.ru/rss/', true),
('Психологос','https://www.psychologos.ru/rss', true),
('Nature','https://www.nature.com/nathumbehav.rss', true),
('Frontiers','https://www.frontiersin.org/journals/psychology/rss', true)
ON CONFLICT (url) DO NOTHING;
