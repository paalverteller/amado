-- Amado MVP — Brazil SaaS market + competitor seed
-- Additive/idempotent. Safe for the manually consolidated current schema.
-- Run in Supabase SQL Editor AFTER the clean baseline already used by Amado.
-- AMADO_MVP_RUNTIME_REPAIR_V1

BEGIN;

DO $$
DECLARE
  v_brand_id UUID;
  v_region_id UUID;
  v_salesforce_id UUID;
  v_monday_id UUID;
  v_slack_id UUID;
BEGIN
  SELECT id INTO v_brand_id
  FROM brand_profiles
  WHERE is_default = true
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_brand_id IS NULL THEN
    SELECT id INTO v_brand_id
    FROM brand_profiles
    WHERE brand_name = 'Bitrix24 Brasil'
    LIMIT 1;
  END IF;

  IF v_brand_id IS NULL THEN
    RAISE EXCEPTION 'Default/Bitrix24 Brasil brand profile not found. Apply the Amado baseline first.';
  END IF;

  SELECT id INTO v_region_id
  FROM regions
  WHERE code = 'BR'
  LIMIT 1;

  IF v_region_id IS NULL THEN
    RAISE EXCEPTION 'BR region not found. Apply the Amado baseline first.';
  END IF;

  -- The user-defined competitive set for the Brazil SaaS workspace.
  UPDATE brand_profiles
  SET
    competitors = 'Salesforce, monday.com, Slack',
    updated_at = now()
  WHERE id = v_brand_id;

  INSERT INTO competitors (brand_id, name, website, notes, status)
  SELECT
    v_brand_id,
    'Salesforce',
    'https://www.salesforce.com/',
    'Enterprise CRM / AI / sales platform. Track product, AI, CRM and Brazil-relevant go-to-market signals.',
    'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM competitors
    WHERE brand_id = v_brand_id AND lower(name) = 'salesforce'
  );

  INSERT INTO competitors (brand_id, name, website, notes, status)
  SELECT
    v_brand_id,
    'monday.com',
    'https://monday.com/',
    'Work management and CRM platform. Track product launches, AI/work-management positioning and campaigns.',
    'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM competitors
    WHERE brand_id = v_brand_id AND lower(name) = 'monday.com'
  );

  INSERT INTO competitors (brand_id, name, website, notes, status)
  SELECT
    v_brand_id,
    'Slack',
    'https://slack.com/',
    'Work collaboration platform. Track AI, productivity, collaboration and enterprise-work messaging.',
    'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM competitors
    WHERE brand_id = v_brand_id AND lower(name) = 'slack'
  );

  SELECT id INTO v_salesforce_id
  FROM competitors
  WHERE brand_id = v_brand_id AND lower(name) = 'salesforce'
  LIMIT 1;

  SELECT id INTO v_monday_id
  FROM competitors
  WHERE brand_id = v_brand_id AND lower(name) = 'monday.com'
  LIMIT 1;

  SELECT id INTO v_slack_id
  FROM competitors
  WHERE brand_id = v_brand_id AND lower(name) = 'slack'
  LIMIT 1;

  -- Brazil market intelligence. html_index is deliberate: the current Amado
  -- ingestion layer supports it natively and it is less brittle than assuming
  -- an undocumented RSS endpoint exists forever.
  INSERT INTO rss_sources (
    name, url, source_type, country, region_id, language_code,
    active, source_category, authority_weight, parser_config
  ) VALUES
    (
      'Meio & Mensagem — Marketing',
      'https://www.meioemensagem.com.br/marketing',
      'html_index', 'Brasil', v_region_id, 'pt-BR',
      true, 'marketing', 1.4, '{}'::jsonb
    ),
    (
      'Exame — Tecnologia',
      'https://exame.com/tecnologia/',
      'html_index', 'Brasil', v_region_id, 'pt-BR',
      true, 'technology', 1.3, '{}'::jsonb
    ),
    (
      'StartSe — Artigos',
      'https://www.startse.com/artigos/',
      'html_index', 'Brasil', v_region_id, 'pt-BR',
      true, 'business_technology', 1.2, '{}'::jsonb
    )
  ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    country = EXCLUDED.country,
    region_id = EXCLUDED.region_id,
    language_code = EXCLUDED.language_code,
    active = true,
    source_category = EXCLUDED.source_category,
    authority_weight = EXCLUDED.authority_weight,
    parser_config = EXCLUDED.parser_config,
    competitor_id = NULL;

  -- Official competitor channels. They go through the SAME evidence pipeline
  -- as market sources, linked by competitor_id; no parallel scraper is added.
  INSERT INTO rss_sources (
    name, url, source_type, country, region_id, language_code,
    active, source_category, authority_weight, parser_config, competitor_id
  ) VALUES
    (
      'Salesforce News',
      'https://www.salesforce.com/news/',
      'html_index', 'Global', v_region_id, 'en',
      true, 'competitor', 1.5, '{}'::jsonb, v_salesforce_id
    ),
    (
      'monday.com — Product',
      'https://monday.com/blog/product/',
      'html_index', 'Global', v_region_id, 'en',
      true, 'competitor', 1.5, '{}'::jsonb, v_monday_id
    ),
    (
      'Slack — News',
      'https://slack.com/blog/news',
      'html_index', 'Global', v_region_id, 'en',
      true, 'competitor', 1.5, '{}'::jsonb, v_slack_id
    )
  ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    country = EXCLUDED.country,
    region_id = EXCLUDED.region_id,
    language_code = EXCLUDED.language_code,
    active = true,
    source_category = 'competitor',
    authority_weight = EXCLUDED.authority_weight,
    parser_config = EXCLUDED.parser_config,
    competitor_id = EXCLUDED.competitor_id;

END $$;

COMMIT;

-- Verification: expect 3 active competitors and 6 MVP sources.
SELECT
  c.name,
  c.website,
  c.status,
  count(rs.id) AS source_count
FROM competitors c
LEFT JOIN rss_sources rs
  ON rs.competitor_id = c.id AND rs.active = true
WHERE lower(c.name) IN ('salesforce', 'monday.com', 'slack')
GROUP BY c.id, c.name, c.website, c.status
ORDER BY c.name;

SELECT
  name,
  url,
  source_type,
  source_category,
  active,
  competitor_id
FROM rss_sources
WHERE url IN (
  'https://www.meioemensagem.com.br/marketing',
  'https://exame.com/tecnologia/',
  'https://www.startse.com/artigos/',
  'https://www.salesforce.com/news/',
  'https://monday.com/blog/product/',
  'https://slack.com/blog/news'
)
ORDER BY source_category, name;
