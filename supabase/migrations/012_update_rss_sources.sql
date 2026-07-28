-- Clear old entries
DELETE FROM rss_items;
DELETE FROM rss_sources;

-- Insert exact required sources
INSERT INTO rss_sources (name, url, source_type, active, country) VALUES
('MedicalNewsToday', 'https://www.medicalnewstoday.com/news', 'html_site', true, 'США'),
('RealSimple Health', 'https://www.realsimple.com/health', 'html_site', true, 'США'),
('NeuroscienceNews', 'https://neurosciencenews.com', 'html_site', true, 'США'),
('MedicalXpress', 'https://medicalxpress.com', 'html_site', true, 'США');
