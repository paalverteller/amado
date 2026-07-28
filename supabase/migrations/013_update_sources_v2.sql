DELETE FROM rss_sources WHERE name = 'MedicalNewsToday' OR url LIKE '%medicalnewstoday.com%';

INSERT INTO rss_sources (name, url, source_type, active, country) VALUES
('Science Mail', 'https://science.mail.ru/news/', 'html_site', true, 'Россия'),
('Saude Abril', 'https://saude.abril.com.br/familia/', 'html_site', true, 'Бразилия')
ON CONFLICT (url) DO UPDATE SET active = EXCLUDED.active;
