-- Amado Sprint 2 — Platform Playbooks and Format Rules
-- 
-- §8.3: platform_playbooks, format_playbooks, approved_examples, campaign_profiles
-- §11: Platform-specific output contracts

-- ─── 1. Platform playbooks ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'x', 'threads', 'youtube', 'tiktok', 'whatsapp')),
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'active', 'archived')),
  strategy_json JSONB NOT NULL DEFAULT '{}',
  measurement_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, platform, locale, version)
);

CREATE INDEX IF NOT EXISTS idx_platform_playbooks_brand ON platform_playbooks (brand_id, platform, status);
CREATE INDEX IF NOT EXISTS idx_platform_playbooks_active ON platform_playbooks (brand_id, platform, status) WHERE status = 'active';

-- ─── 2. Format playbooks ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS format_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_playbook_id UUID NOT NULL REFERENCES platform_playbooks(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  version TEXT NOT NULL,
  output_schema_key TEXT NOT NULL,
  required_deliverables TEXT[] NOT NULL DEFAULT '{}',
  constraints_json JSONB NOT NULL DEFAULT '{}',
  rubric_json JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_playbook_id, format, version)
);

CREATE INDEX IF NOT EXISTS idx_format_playbooks_platform ON format_playbooks (platform_playbook_id, format);

-- ─── 3. Approved examples ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approved_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  platform TEXT,
  format TEXT,
  content_pillar_id UUID REFERENCES brand_content_pillars(id) ON DELETE SET NULL,
  label TEXT NOT NULL CHECK (label IN ('positive', 'negative', 'reference')),
  text_content TEXT NOT NULL,
  structured_content JSONB,
  why_it_works TEXT,
  source_document_id UUID,
  source_anchor TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  performance_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approved_examples_brand ON approved_examples (brand_id, label);
CREATE INDEX IF NOT EXISTS idx_approved_examples_platform ON approved_examples (brand_id, platform, format);
CREATE INDEX IF NOT EXISTS idx_approved_examples_pillar ON approved_examples (content_pillar_id);

-- ─── 4. Campaign profiles ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_objective TEXT,
  cta_policy TEXT,
  product_explicitness TEXT CHECK (product_explicitness IN ('none', 'implicit', 'late_light', 'explicit_product')),
  proof_requirement TEXT CHECK (proof_requirement IN ('none', 'preferred', 'required')),
  risk_flags TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_profiles_brand ON campaign_profiles (brand_id, active);

-- ─── 5. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE platform_playbooks IS 'Platform-specific strategy and measurement rules per brand';
COMMENT ON TABLE format_playbooks IS 'Format-specific output schemas, constraints and rubrics';
COMMENT ON TABLE approved_examples IS 'Positive, negative and reference examples for brand voice training';
COMMENT ON TABLE campaign_profiles IS 'Campaign types with default objectives, CTA policies and risk flags';
