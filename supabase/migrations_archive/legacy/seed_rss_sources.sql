-- Structural seeding setup for core production analytical channels
CREATE TABLE IF NOT EXISTS rss_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    source_type TEXT DEFAULT 'market',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

INSERT INTO rss_sources (name, url, active, source_type) VALUES
('Psychology Today', 'https://www.psychologytoday.com/us/front/feed', true, 'market'),
('Greater Good', 'https://greatergood.berkeley.edu/rss', true, 'market'),
('APA', 'https://www.apa.org/news/press/releases/index.rss', true, 'market'),
('Science Daily', 'https://www.sciencedaily.com/rss/mind_brain/psychology.xml', true, 'market'),
('B17', 'https://www.b17.ru/rss.php', true, 'market'),
('Психологос', 'https://www.psychologos.ru/articles.rss', true, 'market'),
('Nature Human Behaviour', 'https://www.nature.com/nathumbehav.rss', true, 'market'),
('Frontiers', 'https://www.frontiersin.org/articles/rss', true, 'market')
ON CONFLICT (url) DO UPDATE SET active = EXCLUDED.active;
