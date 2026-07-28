-- Amado Sprint 2 — Brand Operating System Core
-- 
-- §6.1: Rule classes and enforcement modes
-- §6.3: Rule provenance and versioning
-- §6.4: Scope system
-- §8.1: brand_rule_sets, brand_rules, brand_terms, brand_claims

-- ─── 1. Brand rule sets (versioned policy containers) ───────────────────────

CREATE TABLE IF NOT EXISTS brand_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'active', 'archived')),
  parent_version_id UUID REFERENCES brand_rule_sets(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, version)
);

CREATE INDEX IF NOT EXISTS idx_brand_rule_sets_brand ON brand_rule_sets (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_brand_rule_sets_active ON brand_rule_sets (brand_id, status) WHERE status = 'active';

-- ─── 2. Brand rules (structured, scoped, versioned) ─────────────────────────

CREATE TABLE IF NOT EXISTS brand_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES brand_rule_sets(id) ON DELETE CASCADE,
  
  -- Rule classification
  rule_class TEXT NOT NULL CHECK (rule_class IN (
    'safety', 'legal', 'factual', 'brand_positioning', 'language',
    'platform', 'format', 'campaign', 'style', 'optimization_hypothesis', 'measurement'
  )),
  enforcement TEXT NOT NULL CHECK (enforcement IN (
    'hard_block', 'required', 'forbidden', 'warning', 'preference', 'scoring', 'human_review'
  )),
  
  -- Rule content
  rule_key TEXT NOT NULL,
  operator TEXT NOT NULL,
  value_json JSONB NOT NULL DEFAULT '{}',
  scope_json JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 100,
  
  -- Provenance
  source_document_id UUID,
  source_anchor TEXT,
  extraction_confidence NUMERIC,
  human_approved BOOLEAN NOT NULL DEFAULT false,
  
  -- Lifecycle
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  superseded_by UUID REFERENCES brand_rules(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_rules_set ON brand_rules (rule_set_id, rule_class);
CREATE INDEX IF NOT EXISTS idx_brand_rules_key ON brand_rules (rule_key);
CREATE INDEX IF NOT EXISTS idx_brand_rules_enforcement ON brand_rules (enforcement);
CREATE INDEX IF NOT EXISTS idx_brand_rules_scope ON brand_rules USING GIN (scope_json);

-- ─── 3. Brand terms (vocabulary governance) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  policy TEXT NOT NULL CHECK (policy IN ('preferred', 'allowed', 'discouraged', 'forbidden')),
  replacement TEXT,
  notes TEXT,
  platform TEXT,
  format TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, normalized_term, locale, platform, format)
);

CREATE INDEX IF NOT EXISTS idx_brand_terms_brand ON brand_terms (brand_id, locale);
CREATE INDEX IF NOT EXISTS idx_brand_terms_policy ON brand_terms (brand_id, policy);
CREATE INDEX IF NOT EXISTS idx_brand_terms_normalized ON brand_terms (brand_id, normalized_term);

-- ─── 4. Brand claims (product truth and compliance) ─────────────────────────

CREATE TABLE IF NOT EXISTS brand_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  product_id UUID,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('approved', 'qualified', 'forbidden', 'requires_proof')),
  qualifier TEXT,
  proof_document_id UUID,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_claims_brand ON brand_claims (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_brand_claims_type ON brand_claims (brand_id, claim_type);
CREATE INDEX IF NOT EXISTS idx_brand_claims_product ON brand_claims (product_id, status);

-- ─── 5. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE brand_rule_sets IS 'Versioned brand policy containers. Only one active per brand.';
COMMENT ON TABLE brand_rules IS 'Structured, scoped, versioned rules extracted from guidelines or created manually.';
COMMENT ON COLUMN brand_rules.rule_class IS 'safety | legal | factual | brand_positioning | language | platform | format | campaign | style | optimization_hypothesis | measurement';
COMMENT ON COLUMN brand_rules.enforcement IS 'hard_block | required | forbidden | warning | preference | scoring | human_review';
COMMENT ON COLUMN brand_rules.scope_json IS 'JSON with optional workspace, brand, region, language, platform, format, pillar, product, campaign, objective, audience, risk filters';
COMMENT ON TABLE brand_terms IS 'Vocabulary governance: preferred, allowed, discouraged, forbidden terms by brand and locale';
COMMENT ON TABLE brand_claims IS 'Product claims with approval status, qualifiers, and proof requirements';
