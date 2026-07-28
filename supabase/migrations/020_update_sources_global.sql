-- Remove APA and Veja Saude
DELETE FROM rss_sources WHERE url ILIKE '%apa.org%' OR url ILIKE '%abril.com.br%';

-- Add Global Sources
INSERT INTO rss_sources (name, url, source_type, active, country) VALUES
('BPS Research Digest', 'https://digest.bps.org.uk/feed/', 'rss', true, 'Великобритания'),
('In-Mind Magazine', 'https://www.in-mind.org/', 'html_site', true, 'Европа'),
('Clinical Psychology in Europe', 'https://cpe.psychopen.eu/', 'html_site', true, 'Европа'),
('PsychoPedia', 'https://psychopedia.in/', 'html_site', true, 'Индия'),
('CPAMedia (China)', 'https://www.cpsbeijing.org/', 'html_site', true, 'Китай'),
('SciELO Psychology', 'https://www.scielo.br/j/pusp/', 'html_site', true, 'Бразилия'),
('Revista Latinoamericana', 'https://revistas.konradlorenz.edu.co/index.php/rlpsi', 'html_site', true, 'Колумбия')
ON CONFLICT (url) DO UPDATE SET 
  active = true, 
  name = EXCLUDED.name, 
  country = EXCLUDED.country, 
  source_type = EXCLUDED.source_type;
