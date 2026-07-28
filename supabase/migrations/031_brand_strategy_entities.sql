-- Amado Sprint 2 — Brand Strategy Entities
-- 
-- §5.1-5.10: Brand essence, audiences, pains, pillars, products
-- §8.2: brand_products, brand_capabilities, brand_audiences, brand_pain_points, brand_content_pillars

-- ─── 1. Brand products ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  approved_definition TEXT,
  product_role TEXT CHECK (product_role IN ('infrastructure', 'hero', 'support', 'integration')),
  deep_link TEXT,
  whatsapp_cta_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_brand_products_brand ON brand_products (brand_id, active);

-- ─── 2. Brand capabilities (features → benefits → pains) ────────────────────

CREATE TABLE IF NOT EXISTS brand_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES brand_products(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  capability_name TEXT NOT NULL,
  feature_description TEXT,
  user_benefit TEXT,
  supported_pain_ids UUID[],
  proof_document_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_capabilities_product ON brand_capabilities (product_id, status);
CREATE INDEX IF NOT EXISTS idx_brand_capabilities_brand ON brand_capabilities (brand_id, status);

-- ─── 3. Brand audiences ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  roles TEXT[],
  company_profile TEXT,
  pains TEXT[],
  desired_outcomes TEXT[],
  objections TEXT[],
  technical_detail_level TEXT CHECK (technical_detail_level IN ('low', 'medium', 'high')),
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_audiences_brand ON brand_audiences (brand_id, active);

-- ─── 4. Brand pain points ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_pain_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  description TEXT,
  observable_symptoms TEXT[],
  business_consequences TEXT[],
  related_product_capability_ids UUID[],
  approved_brazilian_examples TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_pain_points_brand ON brand_pain_points (brand_id, active);

-- ─── 5. Brand content pillars ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose TEXT,
  audience_applicability TEXT[],
  product_applicability TEXT[],
  default_product_explicitness TEXT CHECK (default_product_explicitness IN ('none', 'implicit', 'late_light', 'explicit_product')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_pillars_brand ON brand_content_pillars (brand_id, active);

-- ─── 6. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE brand_products IS 'Products and services offered by the brand';
COMMENT ON TABLE brand_capabilities IS 'Product capabilities mapped to user benefits and pain points';
COMMENT ON TABLE brand_audiences IS 'Target audience segments with roles, pains and objections';
COMMENT ON TABLE brand_pain_points IS 'Canonical pain points with Brazilian business context';
COMMENT ON TABLE brand_content_pillars IS 'Strategic content pillars for editorial planning';
