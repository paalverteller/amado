-- Amado Sprint 2 — Content Packages and Asset Relations
-- 
-- §8.5: content_packages, content_asset_relations, content_assets extensions

-- ─── 1. Content packages ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  brief_id UUID,
  signal_id UUID,
  opportunity_id UUID,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planning', 'generating', 'review', 'approved', 'rejected', 'published')),
  policy_version TEXT,
  policy_snapshot_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_packages_brand ON content_packages (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_content_packages_owner ON content_packages (owner_id, status);

-- ─── 2. Content assets (extended from Sprint 1 articles concept) ────────────

CREATE TABLE IF NOT EXISTS content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES content_packages(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  
  -- Platform and format
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  
  -- Content classification
  content_pillar_id UUID REFERENCES brand_content_pillars(id) ON DELETE SET NULL,
  hook_type TEXT,
  structure_pattern TEXT,
  ending_type TEXT,
  product_explicitness TEXT CHECK (product_explicitness IN ('none', 'implicit', 'late_light', 'explicit_product')),
  
  -- Policy and generation
  policy_snapshot_id UUID REFERENCES policy_snapshots(id) ON DELETE SET NULL,
  generation_run_id UUID,
  
  -- Content
  structured_content JSONB,
  rendered_text TEXT,
  
  -- QA and approval
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_review', 'approved', 'rejected', 'needs_repair')),
  qa_score NUMERIC,
  human_edit_distance INTEGER,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_assets_package ON content_assets (package_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_brand ON content_assets (brand_id, platform, format);
CREATE INDEX IF NOT EXISTS idx_content_assets_status ON content_assets (approval_status);

-- ─── 3. Content asset relations ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_asset_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  child_asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'first_comment', 'link_reply', 'banner_variant', 'caption',
    'slide_copy', 'visual_brief', 'follow_up', 'alt_text', 'metadata'
  )),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_asset_id, child_asset_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_asset_relations_parent ON content_asset_relations (parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_relations_child ON content_asset_relations (child_asset_id);

-- ─── 4. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE content_packages IS 'Groups related content assets created from one brief or signal';
COMMENT ON TABLE content_assets IS 'Individual content pieces with platform-native structure and QA metadata';
COMMENT ON TABLE content_asset_relations IS 'Links between related assets (e.g., post + first comment + banner)';
