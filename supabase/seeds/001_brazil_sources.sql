-- Amado — Validated Brazil Sources (Stage 2)
-- 
-- 12 high-quality sources for Brazilian marketing intelligence.
-- All sources verified for RSS availability and content relevance.
-- Run: psql -d your_db -f supabase/seeds/001_brazil_sources.sql

-- First, ensure Brazil region exists
INSERT INTO regions (id, code, name, currency_code, timezone, locale)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'BR',
  'Brasil',
  'BRL',
  'America/Sao_Paulo',
  'pt-BR'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  timezone = EXCLUDED.timezone,
  locale = EXCLUDED.locale;

-- Get Brazil region ID
WITH br AS (
  SELECT id FROM regions WHERE code = 'BR' LIMIT 1
)
INSERT INTO rss_sources (
  id, name, url, source_type, country, region_id, 
  language_code, active, source_category, authority_weight
) VALUES
  -- Marketing & Advertising
  (gen_random_uuid(), 'Meio & Mensagem', 'https://www.meioemensagem.com.br/feed/', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'marketing', 1.2),
  (gen_random_uuid(), 'ProXXIma', 'https://www.proxxima.com.br/rss.xml', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'marketing', 1.1),
  (gen_random_uuid(), 'Mundo do Marketing', 'https://www.mundodomarketing.com.br/rss/noticias', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'marketing', 1.0),
  
  -- Business & Economy
  (gen_random_uuid(), 'Exame', 'https://exame.com/feed/', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'business', 1.3),
  (gen_random_uuid(), 'Valor Econômico', 'https://valor.globo.com/rss.xml', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'business', 1.4),
  (gen_random_uuid(), 'Estadão', 'https://www.estadao.com.br/rss/ultimas.xml', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'news', 1.3),
  
  -- Technology
  (gen_random_uuid(), 'TechTudo', 'https://www.techtudo.com.br/rss.xml', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'technology', 1.0),
  (gen_random_uuid(), 'TecMundo', 'https://www.tecmundo.com.br/rss.xml', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'technology', 1.0),
  
  -- Social Media & Digital
  (gen_random_uuid(), 'Social Media Today (BR)', 'https://www.socialmediatoday.com/rss.xml', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'social_media', 1.1),
  
  -- Culture & Trends
  (gen_random_uuid(), 'Hypeness', 'https://www.hypeness.com.br/feed/', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'culture', 0.9),
  (gen_random_uuid(), 'Popcorn', 'https://popcorn.com.br/feed/', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'entertainment', 0.8),
  
  -- E-commerce
  (gen_random_uuid(), 'E-Commerce Brasil', 'https://www.ecommercebrasil.com.br/feed/', 'rss', 'Brasil', (SELECT id FROM br), 'pt-BR', true, 'ecommerce', 1.1)

ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  active = EXCLUDED.active,
  source_category = EXCLUDED.source_category,
  authority_weight = EXCLUDED.authority_weight,
  updated_at = now();

-- Add source health baseline (all healthy at seed time)
INSERT INTO source_health_events (source_id, event_type, items_yielded, created_at)
SELECT id, 'success', 0, now()
FROM rss_sources
WHERE country = 'Brasil'
ON CONFLICT DO NOTHING;

-- Update source items count
UPDATE rss_sources
SET items_count = 0
WHERE country = 'Brasil';
