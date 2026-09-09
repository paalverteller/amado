-- Amado — market intelligence source + competitor refresh, 2026-09-09.
-- Additive/idempotent. Run AFTER 047_competitor_source_links.sql.
-- Sources are intentionally compact and aligned to B2B software, AI,
-- digital business, SMBs/Mittelstand, CRM, work management and ERP.

BEGIN;

DO $$
DECLARE
  missing_regions TEXT;
BEGIN
  SELECT string_agg(code, ', ' ORDER BY code) INTO missing_regions
  FROM (VALUES ('BR'), ('ES'), ('DE'), ('US')) wanted(code)
  WHERE NOT EXISTS (SELECT 1 FROM regions r WHERE r.code = wanted.code AND r.active = true);
  IF missing_regions IS NOT NULL THEN
    RAISE EXCEPTION 'Missing active Amado regions: %', missing_regions;
  END IF;
END $$;

-- ── Market sources ──────────────────────────────────────────────────────────
WITH source_seed(region_code, name, url, source_type, country, language_code, source_category, authority_weight) AS (
  VALUES
    -- Brazil: software-market data + digital economy + existing high-signal business/marketing feeds.
    ('BR','ABES — Press Releases','https://abes.org.br/noticias/press-releases/','html_index','Brasil','pt-BR','business_technology',1.6),
    ('BR','Brasscom — Publicações','https://brasscom.org.br/publicacoes/','html_index','Brasil','pt-BR','business_technology',1.5),
    ('BR','Meio & Mensagem — Marketing','https://www.meioemensagem.com.br/marketing','html_index','Brasil','pt-BR','marketing',1.4),
    ('BR','Exame — Tecnologia','https://exame.com/tecnologia/','html_index','Brasil','pt-BR','technology',1.3),
    ('BR','StartSe — Artigos','https://www.startse.com/artigos/','html_index','Brasil','pt-BR','business_technology',1.2),
    ('BR','E-Commerce Brasil','https://www.ecommercebrasil.com.br/feed/','rss','Brasil','pt-BR','ecommerce',1.2),

    -- Spain: SME digitization, digital economy and B2B marketing/business signals.
    ('ES','Red.es — Noticias','https://www.red.es/es/actualidad/noticias','html_index','España','es-ES','business_technology',1.6),
    ('ES','Adigital — Actualidad','https://www.adigital.org/actualidad/','html_index','España','es-ES','business_technology',1.5),
    ('ES','Cinco Días','https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada','rss','España','es-ES','business',1.4),
    ('ES','Marketing Directo','https://www.marketingdirecto.com/noticias/marketing-general','html_index','España','es-ES','marketing',1.2),
    ('ES','IAB Spain','https://iabspain.es/','html_index','España','es-ES','marketing',1.1),

    -- Germany: retain the verified 2026 feeds and add Bitkom for software/Mittelstand data.
    ('DE','Bitkom — Presseinformationen','https://www.bitkom.org/Presse/Presseinformation','html_index','Deutschland','de-DE','business_technology',1.6),
    ('DE','t3n','https://t3n.de/rss.xml','rss','Deutschland','de-DE','technology',1.1),
    ('DE','HORIZONT Marketing','https://www.horizont.net/news/feed/marketing/','rss','Deutschland','de-DE','marketing',1.2),
    ('DE','OnlineMarketing.de','https://onlinemarketing.de/feed','rss','Deutschland','de-DE','marketing',1.1),
    ('DE','Gründerszene (Business Insider DE)','https://www.businessinsider.de/gruenderszene/feed/','rss','Deutschland','de-DE','business_technology',1.2),
    ('DE','Handelsblatt Unternehmen','https://feeds.cms.handelsblatt.com/unternehmen','rss','Deutschland','de-DE','business',1.4),
    ('DE','Handelsblatt Technologie','https://feeds.cms.handelsblatt.com/technologie','rss','Deutschland','de-DE','technology',1.3),

    -- US: enterprise software/CRM/ERP + software buyer intent + SaaS/marketing signals.
    ('US','CIO — Enterprise Applications','https://www.cio.com/enterprise-applications/','html_index','United States','en-US','business_technology',1.6),
    ('US','Software Advice — Resources','https://www.softwareadvice.com/resources/','html_index','United States','en-US','business_technology',1.5),
    ('US','TechCrunch','https://techcrunch.com/feed/','rss','United States','en-US','technology',1.4),
    ('US','VentureBeat','https://venturebeat.com/feed/','rss','United States','en-US','technology',1.2),
    ('US','MarTech','https://martech.org/feed/','rss','United States','en-US','marketing',1.2),
    ('US','SaaStr','https://www.saastr.com/feed/','rss','United States','en-US','business_technology',1.1),
    ('US','Adweek','https://www.adweek.com/feed/','rss','United States','en-US','marketing',1.2)
)
INSERT INTO rss_sources (
  name, url, source_type, country, region_id, language_code,
  active, source_category, authority_weight, parser_config
)
SELECT
  seed.name, seed.url, seed.source_type, seed.country, region.id, seed.language_code,
  true, seed.source_category, seed.authority_weight, '{}'::jsonb
FROM source_seed seed
JOIN regions region ON region.code = seed.region_code
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  country = EXCLUDED.country,
  region_id = EXCLUDED.region_id,
  language_code = EXCLUDED.language_code,
  active = true,
  source_category = EXCLUDED.source_category,
  authority_weight = EXCLUDED.authority_weight,
  parser_config = EXCLUDED.parser_config;

-- Remove known low-fit/noisy source from the Spain market set without deleting history.
UPDATE rss_sources
SET active = false
WHERE url = 'https://hipertextual.com/tecnologia/';

-- ── Competitor set ──────────────────────────────────────────────────────────
CREATE TEMP TABLE amado_desired_competitors (
  region_code TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  notes TEXT
) ON COMMIT DROP;

INSERT INTO amado_desired_competitors VALUES
  ('BR',1,'Salesforce','https://www.salesforce.com/','CRM, AI agents and enterprise platform.'),
  ('BR',2,'HubSpot','https://www.hubspot.com/','CRM and customer platform for SMB/mid-market.'),
  ('BR',3,'RD Station','https://www.rdstation.com/','Brazilian marketing automation and CRM.'),
  ('BR',4,'Pipedrive','https://www.pipedrive.com/','Sales CRM focused on SMBs.'),
  ('BR',5,'monday.com','https://monday.com/','Work management and CRM.'),
  ('BR',6,'ClickUp','https://clickup.com/','Work/project management with AI.'),
  ('BR',7,'Pipefy','https://www.pipefy.com/','Brazil-founded workflow/no-code/AI automation.'),
  ('BR',8,'TOTVS','https://www.totvs.com/','Brazilian ERP and business software leader.'),
  ('BR',9,'Omie','https://www.omie.com.br/','Brazilian cloud ERP for SMEs and accountants.'),
  ('BR',10,'Conta Azul','https://contaazul.com/','Brazilian financial/accounting management for SMEs.'),
  ('BR',11,'Ploomes','https://www.ploomes.com/','Brazilian CRM and sales automation.'),
  ('BR',12,'Kenlo','https://kenlo.com.br/','Brazilian real-estate CRM and management software.'),

  ('ES',1,'Salesforce','https://www.salesforce.com/es/','Enterprise CRM and AI platform.'),
  ('ES',2,'HubSpot','https://www.hubspot.es/','CRM/customer platform for SMB and mid-market.'),
  ('ES',3,'Pipedrive','https://www.pipedrive.com/es','Sales CRM for SMEs.'),
  ('ES',4,'monday.com','https://monday.com/','Work management and CRM.'),
  ('ES',5,'ClickUp','https://clickup.com/','Project/work management and AI.'),
  ('ES',6,'Asana','https://asana.com/','Work/project management.'),
  ('ES',7,'Odoo','https://www.odoo.com/','Integrated ERP/CRM suite with strong SME fit.'),
  ('ES',8,'Holded','https://www.holded.com/','Spanish cloud ERP/business management for SMEs.'),
  ('ES',9,'Sage','https://www.sage.com/es-es/','Accounting, finance and ERP.'),
  ('ES',10,'Zoho','https://www.zoho.com/','Broad SMB business software suite.'),
  ('ES',11,'Microsoft Dynamics 365','https://www.microsoft.com/es-es/dynamics-365','CRM/ERP enterprise suite.'),
  ('ES',12,'Witei','https://witei.com/','Spanish real-estate CRM and agency software.'),

  ('DE',1,'Salesforce','https://www.salesforce.com/de/','Enterprise CRM and AI platform.'),
  ('DE',2,'HubSpot','https://www.hubspot.de/','CRM/customer platform for SMB and mid-market.'),
  ('DE',3,'Pipedrive','https://www.pipedrive.com/de','Sales CRM for SMEs.'),
  ('DE',4,'monday.com','https://monday.com/','Work management and CRM.'),
  ('DE',5,'ClickUp','https://clickup.com/','Project/work management and AI.'),
  ('DE',6,'MeisterTask','https://www.meistertask.com/','German task/project management.'),
  ('DE',7,'SAP','https://www.sap.com/germany/','ERP and enterprise applications.'),
  ('DE',8,'Odoo','https://www.odoo.com/','Integrated ERP/CRM for SMEs and mid-market.'),
  ('DE',9,'sevdesk','https://sevdesk.de/','German accounting/invoicing software for SMEs.'),
  ('DE',10,'Lexware Office','https://office.lexware.de/','German accounting/business management for SMEs.'),
  ('DE',11,'Microsoft Dynamics 365','https://www.microsoft.com/de-de/dynamics-365','CRM/ERP enterprise suite.'),
  ('DE',12,'onOffice','https://www.onoffice.com/','German real-estate CRM/software.'),

  ('US',1,'Salesforce','https://www.salesforce.com/','CRM, AI agents and enterprise platform.'),
  ('US',2,'HubSpot','https://www.hubspot.com/','CRM/customer platform for SMB and mid-market.'),
  ('US',3,'Pipedrive','https://www.pipedrive.com/','Sales CRM for SMEs.'),
  ('US',4,'monday.com','https://monday.com/','Work management and CRM.'),
  ('US',5,'ClickUp','https://clickup.com/','Project/work management and AI.'),
  ('US',6,'Asana','https://asana.com/','Work/project management.'),
  ('US',7,'Smartsheet','https://www.smartsheet.com/','Enterprise work management.'),
  ('US',8,'Zoho','https://www.zoho.com/','Broad SMB business software suite.'),
  ('US',9,'Microsoft Dynamics 365','https://www.microsoft.com/en-us/dynamics-365','CRM/ERP enterprise suite.'),
  ('US',10,'Oracle NetSuite','https://www.netsuite.com/','Cloud ERP for mid-market and enterprises.'),
  ('US',11,'QuickBooks','https://quickbooks.intuit.com/','Accounting/finance software for SMBs.'),
  ('US',12,'Follow Up Boss','https://www.followupboss.com/','Real-estate CRM.' );

CREATE TEMP TABLE amado_region_brands ON COMMIT DROP AS
SELECT region.code AS region_code, brand.id AS brand_id
FROM regions region
JOIN LATERAL (
  SELECT bp.id
  FROM brand_profiles bp
  WHERE bp.region_id = region.id AND bp.is_active = true
  ORDER BY bp.is_default DESC, bp.updated_at DESC NULLS LAST, bp.created_at DESC
  LIMIT 1
) brand ON true
WHERE region.code IN ('BR','ES','DE','US');

DO $$
DECLARE
  missing_brands TEXT;
BEGIN
  SELECT string_agg(code, ', ' ORDER BY code) INTO missing_brands
  FROM (VALUES ('BR'),('ES'),('DE'),('US')) wanted(code)
  WHERE NOT EXISTS (SELECT 1 FROM amado_region_brands rb WHERE rb.region_code = wanted.code);
  IF missing_brands IS NOT NULL THEN
    RAISE EXCEPTION 'No active Brand OS profile for regions: %', missing_brands;
  END IF;
END $$;

INSERT INTO competitors (brand_id, name, website, notes, status)
SELECT rb.brand_id, desired.name, desired.website, desired.notes, 'active'
FROM amado_desired_competitors desired
JOIN amado_region_brands rb USING (region_code)
WHERE NOT EXISTS (
  SELECT 1 FROM competitors current
  WHERE current.brand_id = rb.brand_id AND lower(current.name) = lower(desired.name)
);

UPDATE competitors current
SET website = desired.website,
    notes = desired.notes,
    status = 'active',
    updated_at = now()
FROM amado_desired_competitors desired
JOIN amado_region_brands rb USING (region_code)
WHERE current.brand_id = rb.brand_id
  AND lower(current.name) = lower(desired.name);

-- Slack was part of the old Brazil MVP seed, but is not a primary competitive
-- product for the requested CRM/work-management/ERP intelligence set.
UPDATE competitors current
SET status = 'archived', updated_at = now()
FROM amado_region_brands rb
WHERE rb.region_code = 'BR'
  AND current.brand_id = rb.brand_id
  AND lower(current.name) = 'slack';

UPDATE brand_profiles bp
SET competitors = desired.names,
    updated_at = now()
FROM (
  SELECT rb.brand_id, string_agg(dc.name, ', ' ORDER BY dc.sort_order) AS names
  FROM amado_desired_competitors dc
  JOIN amado_region_brands rb USING (region_code)
  GROUP BY rb.brand_id
) desired
WHERE bp.id = desired.brand_id;

-- ── Shared official competitor sources ─────────────────────────────────────
CREATE TEMP TABLE amado_official_sources (
  competitor_name TEXT NOT NULL,
  source_name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  language_code TEXT NOT NULL,
  authority_weight NUMERIC NOT NULL
) ON COMMIT DROP;

INSERT INTO amado_official_sources VALUES
  ('Salesforce','Salesforce News','https://www.salesforce.com/news/','html_index','en',1.5),
  ('HubSpot','HubSpot Newsroom','https://www.hubspot.com/company-news','html_index','en',1.5),
  ('Pipedrive','Pipedrive Newsroom','https://www.pipedrive.com/en/newsroom','html_index','en',1.5),
  ('monday.com','monday.com — Product Updates','https://monday.com/blog/product/','html_index','en',1.5),
  ('ClickUp','ClickUp — Product','https://clickup.com/blog/product/','html_index','en',1.4),
  ('Asana','Inside Asana — Product','https://asana.com/inside-asana/product','html_index','en',1.4),
  ('Pipefy','Pipefy Newsroom','https://www.pipefy.com/newsroom/','html_index','en',1.5),
  ('RD Station','RD Station — Notícias','https://www.rdstation.com/blog/noticias/','html_index','pt-BR',1.5),
  ('Omie','Omie — Novidades','https://www.omie.com.br/blog/omie/novidades-omie/','html_index','pt-BR',1.5),
  ('Conta Azul','Conta Azul — Novidades','https://contaazul.com/blog/novidades/','html_index','pt-BR',1.5),
  ('Odoo','Odoo Blog','https://www.odoo.com/blog','html_index','en',1.4);

INSERT INTO rss_sources (
  name, url, source_type, country, region_id, language_code,
  active, source_category, authority_weight, parser_config
)
SELECT source_name, url, source_type, 'Global', NULL, language_code,
       true, 'competitor', authority_weight, '{}'::jsonb
FROM amado_official_sources
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  country = 'Global',
  region_id = NULL,
  language_code = EXCLUDED.language_code,
  active = true,
  source_category = 'competitor',
  authority_weight = EXCLUDED.authority_weight,
  parser_config = EXCLUDED.parser_config;

INSERT INTO competitor_source_links (competitor_id, source_id)
SELECT competitor.id, source.id
FROM amado_official_sources official
JOIN competitors competitor ON lower(competitor.name) = lower(official.competitor_name)
JOIN rss_sources source ON source.url = official.url
WHERE competitor.status = 'active'
ON CONFLICT (competitor_id, source_id) DO NOTHING;

COMMIT;

-- Verification: expected active competitor set is 12 per region.
SELECT region.code AS region, count(*) AS active_competitors
FROM competitors competitor
JOIN brand_profiles brand ON brand.id = competitor.brand_id
JOIN regions region ON region.id = brand.region_id
WHERE region.code IN ('BR','ES','DE','US') AND competitor.status = 'active'
GROUP BY region.code
ORDER BY region.code;

SELECT region.code AS region, source.name, source.source_category, source.active
FROM rss_sources source
JOIN regions region ON region.id = source.region_id
WHERE region.code IN ('BR','ES','DE','US') AND source.active = true
ORDER BY region.code, source.source_category, source.name;

SELECT competitor.name, count(*) AS linked_official_sources
FROM competitor_source_links link
JOIN competitors competitor ON competitor.id = link.competitor_id
JOIN rss_sources source ON source.id = link.source_id
WHERE source.source_category = 'competitor'
GROUP BY competitor.id, competitor.name
ORDER BY competitor.name;
