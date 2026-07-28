-- Amado Stage 1 — Regions, Brands, and i18n Foundation
-- 
-- §9.1: Multi-region foundations
-- §9.2: Workspaces and brands
-- §14.2: UI i18n support

-- ─── 1. Regions table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- BR, MX, IT
  name TEXT NOT NULL,
  default_language_code TEXT NOT NULL DEFAULT 'pt-BR',
  locale_code TEXT NOT NULL DEFAULT 'pt-BR',
  currency_code TEXT NOT NULL DEFAULT 'BRL',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  search_domain TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Brazil as default region
INSERT INTO regions (code, name, default_language_code, locale_code, currency_code, timezone, search_domain, active)
VALUES ('BR', 'Brasil', 'pt-BR', 'pt-BR', 'BRL', 'America/Sao_Paulo', 'google.com.br', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  default_language_code = EXCLUDED.default_language_code,
  locale_code = EXCLUDED.locale_code,
  currency_code = EXCLUDED.currency_code,
  timezone = EXCLUDED.timezone,
  search_domain = EXCLUDED.search_domain,
  active = EXCLUDED.active;

-- Seed placeholder regions for future expansion
INSERT INTO regions (code, name, default_language_code, locale_code, currency_code, timezone, search_domain, active)
VALUES 
  ('MX', 'México', 'es-MX', 'es-MX', 'MXN', 'America/Mexico_City', 'google.com.mx', false),
  ('IT', 'Italia', 'it-IT', 'it-IT', 'EUR', 'Europe/Rome', 'google.it', false)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. Expand brand_profiles with strategic fields ─────────────────────────

ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS positioning TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS value_propositions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS strategic_themes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_facts TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS proof_points TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_library TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS legal_disclaimers TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS glossary TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sensitive_topics TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_platform_rules TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Update existing brand profile to be default for Brazil
UPDATE brand_profiles 
  SET is_default = true,
      region_id = (SELECT id FROM regions WHERE code = 'BR')
  WHERE is_default = false OR is_default IS NULL;

-- Index for region lookups
CREATE INDEX IF NOT EXISTS idx_brand_profiles_region ON brand_profiles (region_id, is_active);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_default ON brand_profiles (is_default, is_active);

-- ─── 3. Add region reference to sources ─────────────────────────────────────

ALTER TABLE rss_sources
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

-- Link existing Brazil sources to BR region
UPDATE rss_sources
  SET region_id = (SELECT id FROM regions WHERE code = 'BR')
  WHERE region_id IS NULL AND (country = 'Brasil' OR country = 'Brazil' OR country IS NULL);

-- ─── 4. Add region reference to articles ────────────────────────────────────

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'pt-BR';

-- Backfill existing articles
UPDATE articles
  SET region_id = (SELECT id FROM regions WHERE code = 'BR'),
      locale = 'pt-BR'
  WHERE region_id IS NULL;

-- ─── 5. Create user preferences table for i18n ──────────────────────────────

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interface_locale TEXT NOT NULL DEFAULT 'pt-BR',
  output_locale TEXT NOT NULL DEFAULT 'pt-BR',
  default_region_id UUID REFERENCES regions(id),
  default_brand_id UUID REFERENCES brand_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 6. Add updated_at trigger for regions ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_regions_updated_at ON regions;
CREATE TRIGGER update_regions_updated_at
  BEFORE UPDATE ON regions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── 7. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE regions IS 'Multi-region configuration. Brazil is the initial active region.';
COMMENT ON TABLE user_preferences IS 'User-level preferences for locale, region, and brand defaults.';
COMMENT ON COLUMN brand_profiles.region_id IS 'Primary region for this brand profile';
COMMENT ON COLUMN brand_profiles.positioning IS 'Brand positioning statement';
COMMENT ON COLUMN brand_profiles.strategic_themes IS 'Comma-separated strategic themes for signal matching';
COMMENT ON COLUMN brand_profiles.sensitive_topics IS 'Topics requiring mandatory human review';
