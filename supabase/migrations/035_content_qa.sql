-- Amado Sprint 2 — Content QA and Repair
-- 
-- §8.6: qa_findings, claim_spans, repair_runs
-- §13: Editorial QA architecture

-- ─── 1. QA findings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_run_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES brand_rules(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN (
    'schema', 'platform', 'language', 'claims', 'product_truth',
    'privacy', 'compliance', 'brand_voice', 'localization', 'platform_fit',
    'pattern_fatigue', 'duplicate'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'blocker')),
  location_json JSONB,
  message TEXT NOT NULL,
  suggested_fix TEXT,
  auto_repairable BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'repaired', 'ignored', 'confirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_findings_asset ON qa_findings (asset_id, status);
CREATE INDEX IF NOT EXISTS idx_qa_findings_severity ON qa_findings (asset_id, severity);
CREATE INDEX IF NOT EXISTS idx_qa_findings_category ON qa_findings (asset_id, category);

-- ─── 2. Claim spans (factual traceability) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS claim_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  start_position INTEGER NOT NULL,
  end_position INTEGER NOT NULL,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('factual', 'product', 'opinion', 'hypothetical', 'unsupported')),
  evidence_ids UUID[],
  approved_claim_ids UUID[],
  qualifier TEXT,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('verified', 'unverified', 'blocked', 'qualified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_spans_asset ON claim_spans (asset_id);
CREATE INDEX IF NOT EXISTS idx_claim_spans_type ON claim_spans (asset_id, claim_type);

-- ─── 3. Repair runs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS repair_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  finding_ids UUID[] NOT NULL,
  input_snapshot JSONB NOT NULL,
  output_snapshot JSONB NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  repair_prompt_version TEXT,
  model TEXT,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_runs_asset ON repair_runs (asset_id);

-- ─── 4. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE qa_findings IS 'QA findings from deterministic validators and AI-assisted rubric evaluation';
COMMENT ON TABLE claim_spans IS 'Traceable claim spans with evidence and product claim references';
COMMENT ON TABLE repair_runs IS 'Scoped repair attempts with input/output snapshots and changed fields';
