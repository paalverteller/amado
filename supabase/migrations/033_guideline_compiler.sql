-- Amado Sprint 2 — Guideline Compiler
-- 
-- §8.4: guideline_import_runs, guideline_rule_candidates, policy_conflicts, policy_snapshots

-- ─── 1. Guideline import runs ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guideline_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  source_document_ids UUID[],
  document_type TEXT CHECK (document_type IN (
    'brand_core', 'platform_playbook', 'format_playbook', 'compliance',
    'product_facts', 'approved_examples', 'measurement'
  )),
  model TEXT,
  prompt_version TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'review')),
  extraction_summary JSONB DEFAULT '{}',
  error_summary TEXT,
  timing_ms INTEGER,
  cost_estimate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_guideline_import_runs_brand ON guideline_import_runs (brand_id, status);

-- ─── 2. Guideline rule candidates ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guideline_rule_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES guideline_import_runs(id) ON DELETE CASCADE,
  source_document_id UUID,
  source_anchor TEXT,
  raw_text TEXT NOT NULL,
  rule_class TEXT NOT NULL,
  enforcement TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  operator TEXT NOT NULL,
  value_json JSONB NOT NULL DEFAULT '{}',
  scope_json JSONB NOT NULL DEFAULT '{}',
  confidence NUMERIC,
  rationale_summary TEXT,
  human_decision TEXT CHECK (human_decision IN ('approved', 'rejected', 'modified', 'pending')),
  human_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guideline_candidates_run ON guideline_rule_candidates (import_run_id);
CREATE INDEX IF NOT EXISTS idx_guideline_candidates_decision ON guideline_rule_candidates (import_run_id, human_decision);

-- ─── 3. Policy conflicts ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID REFERENCES guideline_import_runs(id) ON DELETE CASCADE,
  candidate_a_id UUID REFERENCES guideline_rule_candidates(id) ON DELETE CASCADE,
  candidate_b_id UUID REFERENCES guideline_rule_candidates(id) ON DELETE CASCADE,
  existing_rule_id UUID REFERENCES brand_rules(id) ON DELETE SET NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('contradiction', 'duplicate', 'ambiguity', 'scope_overlap', 'precedence')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  explanation TEXT NOT NULL,
  proposed_resolution TEXT,
  human_decision TEXT CHECK (human_decision IN ('resolved', 'ignored', 'pending')),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_conflicts_run ON policy_conflicts (import_run_id);
CREATE INDEX IF NOT EXISTS idx_policy_conflicts_severity ON policy_conflicts (import_run_id, severity);

-- ─── 4. Policy snapshots (immutable compiled policies) ──────────────────────

CREATE TABLE IF NOT EXISTS policy_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  brand_policy_version TEXT NOT NULL,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  platform TEXT,
  format TEXT,
  objective TEXT,
  campaign_profile_id UUID REFERENCES campaign_profiles(id) ON DELETE SET NULL,
  hard_rules JSONB NOT NULL DEFAULT '[]',
  required_deliverables TEXT[] NOT NULL DEFAULT '{}',
  deterministic_validators TEXT[] NOT NULL DEFAULT '{}',
  soft_rubric JSONB NOT NULL DEFAULT '[]',
  approved_example_ids UUID[],
  knowledge_document_versions TEXT[],
  compiled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_snapshots_brand ON policy_snapshots (brand_id, compiled_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_snapshots_hash ON policy_snapshots (policy_hash);

-- ─── 5. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE guideline_import_runs IS 'Tracks guideline document import and extraction jobs';
COMMENT ON TABLE guideline_rule_candidates IS 'Extracted rules awaiting human review before activation';
COMMENT ON TABLE policy_conflicts IS 'Detected conflicts between extracted rules and existing policy';
COMMENT ON TABLE policy_snapshots IS 'Immutable compiled policy used by generation runs';
