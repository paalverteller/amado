-- Полная очистка старых, сломанных или зависших источников
DELETE FROM rss_items;
DELETE FROM rss_sources;

-- Вставка 5 гарантированно рабочих и богатых на контент источников
INSERT INTO rss_sources (name, url, source_type, active, country) VALUES
('PsyPost', 'https://www.psypost.org/feed/', 'rss', true, 'США'),
('Neuroscience News', 'https://neurosciencenews.com/feed/', 'rss', true, 'США'),
('ScienceDaily Mind', 'https://www.sciencedaily.com/rss/mind_brain.xml', 'rss', true, 'США'),
('B17 Психология', 'https://www.b17.ru/rss/', 'rss', true, 'Россия'),
('PubMed Search', 'pubmed:psychology', 'pubmed', true, 'Мир');
