-- Amado — Sprint 12 Phase 5: Spain market sources + first Spain brand profile
--
-- Mirrors supabase/seeds/001_brazil_sources.sql's pattern. Additive only —
-- does not touch any Brazil data. Run in Supabase SQL Editor (no
-- `supabase db push` — production DB follows the manually consolidated
-- baseline, see HANDOFF.md).
--
-- All 5 RSS/source URLs below were verified live via web search before
-- writing this file (Cinco Días confirmed as an actual working RSS feed;
-- the other 4 use html_index at a confirmed-live category URL rather than
-- a guessed RSS path — same convention already used in
-- 002_mvp_brazil_saas.sql for exactly this reason). No political-news-only
-- outlets included.
--
-- IMPORTANT — read before treating the brand profile as finished:
-- the Spain brand row below is a deliberately MINIMAL placeholder, not a
-- fleshed-out brand voice. The existing Bitrix24 Brasil brand has an
-- extensive, hand-authored template/prompt library (see
-- supabase/seeds/003_final_workspaces.sql) built up over many sprints —
-- reproducing that depth for Spain via find-replace would fabricate a
-- brand voice nobody actually decided on. This seed creates just enough
-- (region-linked, is_default = false so it cannot compete with the
-- Brazil default brand in the global fallback lookup) for the Phase 2-4
-- market-switcher machinery to have something real to select and
-- exercise end-to-end. Flesh it out for real in Settings → Brand OS.

-- ── 1. Spain market sources (5) ─────────────────────────────────────────

WITH es AS (
  SELECT id FROM regions WHERE code = 'ES' LIMIT 1
)
INSERT INTO rss_sources (
  id, name, url, source_type, country, region_id,
  language_code, active, source_category, authority_weight
) VALUES
  -- Business & economy
  (gen_random_uuid(), 'Cinco Días (El País)', 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada', 'rss', 'España', (SELECT id FROM es), 'es-ES', true, 'business', 1.4),
  (gen_random_uuid(), 'El Economista — Empresas', 'https://www.eleconomista.es/empresas/', 'html_index', 'España', (SELECT id FROM es), 'es-ES', true, 'business', 1.3),

  -- Marketing & advertising
  (gen_random_uuid(), 'Marketing Directo', 'https://www.marketingdirecto.com/noticias/marketing-general', 'html_index', 'España', (SELECT id FROM es), 'es-ES', true, 'marketing', 1.2),
  (gen_random_uuid(), 'IAB Spain', 'https://iabspain.es/', 'html_index', 'España', (SELECT id FROM es), 'es-ES', true, 'marketing', 1.1),

  -- Technology
  (gen_random_uuid(), 'Hipertextual — Tecnología', 'https://hipertextual.com/tecnologia/', 'html_index', 'España', (SELECT id FROM es), 'es-ES', true, 'technology', 1.0)

ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  country = EXCLUDED.country,
  region_id = EXCLUDED.region_id,
  language_code = EXCLUDED.language_code,
  active = true,
  source_category = EXCLUDED.source_category,
  authority_weight = EXCLUDED.authority_weight,
  updated_at = now();

-- Baseline health event, matching 001_brazil_sources.sql's convention.
INSERT INTO source_health_events (source_id, event_type, items_yielded, created_at)
SELECT id, 'success', 0, now()
FROM rss_sources
WHERE url IN (
  'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada',
  'https://www.eleconomista.es/empresas/',
  'https://www.marketingdirecto.com/noticias/marketing-general',
  'https://iabspain.es/',
  'https://hipertextual.com/tecnologia/'
)
ON CONFLICT DO NOTHING;

-- ── 2. First Spain brand profile (minimal placeholder — see note above) ─

DO $$
DECLARE
  v_region_id UUID;
BEGIN
  SELECT id INTO v_region_id FROM regions WHERE code = 'ES' LIMIT 1;

  IF v_region_id IS NULL THEN
    RAISE EXCEPTION 'ES region not found. Run Sprint 12 Phase 1 (005_spain_region.sql) first.';
  END IF;

  INSERT INTO brand_profiles (
    brand_name, voice_description, forbidden_words, example_posts,
    target_audience, competitors, region_id, is_active, is_default
  )
  SELECT
    'Marca España (placeholder)',
    'PLACEHOLDER — completar en Configuración → Brand OS antes de generar contenido real. Tono provisional: directo, profesional, sin jerga anglosajona innecesaria.',
    '',
    '',
    'Por definir en Configuración.',
    '',
    v_region_id,
    true,
    false  -- deliberately not default: must not compete with the Brazil
           -- default brand in resolveDefaultBrandProfileId's global,
           -- region-agnostic fallback lookup (see lib/brand-snapshot.ts).
  WHERE NOT EXISTS (
    SELECT 1 FROM brand_profiles WHERE region_id = v_region_id
  );
END $$;

-- Verification: expect 5 active ES sources and exactly one ES brand profile.
SELECT name, url, source_type, source_category, active
FROM rss_sources
WHERE region_id = (SELECT id FROM regions WHERE code = 'ES')
ORDER BY source_category, name;

SELECT brand_name, region_id, is_active, is_default
FROM brand_profiles
WHERE region_id = (SELECT id FROM regions WHERE code = 'ES');
