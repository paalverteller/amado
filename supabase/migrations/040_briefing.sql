-- Amado Sprint 6 — daily AI briefing (Overview module, Phase 5)
--
-- One briefing_runs row per calendar day (run_date UNIQUE). One agent
-- pass, two stages: a cheap heuristic DB pre-select of recent evidence
-- (no AI call), then a single AI call over that shortlist that both
-- ranks and writes a "why it matters" line per item -- see
-- lib/briefing.ts. briefing_items.evidence_item_id links back to
-- Sprint 5's evidence_items (source_title/full_text/canonical_url etc.)
-- rather than duplicating that data here.

CREATE TABLE IF NOT EXISTS briefing_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date       DATE NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'generating'
                   CHECK (status IN ('generating', 'ready', 'failed', 'empty')),
  model_used     TEXT,
  items_count    INT NOT NULL DEFAULT 0,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_briefing_runs_run_date ON briefing_runs (run_date DESC);

CREATE TABLE IF NOT EXISTS briefing_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID NOT NULL REFERENCES briefing_runs(id) ON DELETE CASCADE,
  evidence_item_id   UUID REFERENCES evidence_items(id) ON DELETE SET NULL,
  rank               INT NOT NULL,
  why_it_matters     TEXT NOT NULL,
  feedback           TEXT CHECK (feedback IN ('useful', 'irrelevant')),
  feedback_at        TIMESTAMPTZ,
  sent_to_generation_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_briefing_items_run_id ON briefing_items (run_id);
CREATE INDEX IF NOT EXISTS idx_briefing_items_evidence_item_id ON briefing_items (evidence_item_id);

-- Single-tenant app, service-role backend does all writes -- same
-- allow_all pattern as knowledge_assets/knowledge_chunks (migration 038).
ALTER TABLE briefing_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_briefing_runs" ON briefing_runs;
CREATE POLICY "allow_all_briefing_runs" ON briefing_runs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE briefing_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_briefing_items" ON briefing_items;
CREATE POLICY "allow_all_briefing_items" ON briefing_items FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE briefing_runs IS 'One row per calendar day the briefing agent ran (Sprint 6 / Phase 5).';
COMMENT ON TABLE briefing_items IS 'Ranked items within a briefing run, each with an AI-written why_it_matters line and optional person feedback.';
COMMENT ON COLUMN briefing_items.feedback IS 'useful | irrelevant | NULL (no feedback yet) -- explicit signal only, never inferred.';
