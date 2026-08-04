-- Ensure unique constraint on url exists
ALTER TABLE IF EXISTS rss_sources DROP CONSTRAINT IF EXISTS rss_sources_url_unique;
ALTER TABLE IF EXISTS rss_sources ADD CONSTRAINT rss_sources_url_unique UNIQUE (url);

-- Create table if it entirely doesn't exist for fresh setups
CREATE TABLE IF NOT EXISTS rss_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    source_type TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO rss_sources (name, url, source_type, active)
VALUES
('Psychology Today', 'https://www.psychologytoday.com/intl/feed', 'rss', true),
('Greater Good Magazine', 'https://greatergood.berkeley.edu/feeds/all', 'rss', true),
('APA News', 'https://www.apa.org/news/press/releases/apa-rss.xml', 'rss', true),
('Science Daily Mind', 'https://www.sciencedaily.com/rss/mind_brain.xml', 'rss', true),
('Harvard Health - Mental Health', 'https://www.health.harvard.edu/topics/mental-health.xml', 'rss', true),
('B17 Психология', 'https://www.b17.ru/rss/', 'rss', true),
('Психологос', 'https://www.psychologos.ru/rss', 'rss', true),
('ПсиХтр', 'https://psy.su/rss/', 'rss', true),
('Nature Human Behaviour', 'https://www.nature.com/nathumbehav.rss', 'rss', true),
('Frontiers in Psychology', 'https://www.frontiersin.org/journals/psychology/rss', 'rss', true)
ON CONFLICT (url) DO NOTHING;
