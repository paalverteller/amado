-- Добавляем бронебойные ссылки (для западных - чистый RSS, для российских - HTML парсинг раздела)
INSERT INTO rss_sources (name, url, source_type, active, country) VALUES
('APA News', 'https://www.apa.org/news/rss/apa-news.xml', 'rss', true, 'США'),
('Greater Good Berkeley', 'https://greatergood.berkeley.edu/feeds/all', 'rss', true, 'США'),
('APS Science', 'https://www.psychologicalscience.org/news/feed', 'rss', true, 'США'),
('Naked Science Психология', 'https://naked-science.ru/article/psy', 'html_site', true, 'Россия'),
('Reminder', 'https://reminder.media/', 'html_site', true, 'Россия')
ON CONFLICT (url) DO UPDATE SET 
  active = EXCLUDED.active, 
  source_type = EXCLUDED.source_type,
  name = EXCLUDED.name;
