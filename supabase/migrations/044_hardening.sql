-- Amado Sprint 10 — hardening (Phase 9)
--
-- Two independent additions, both additive-only.

-- ─── 1. AI usage log (cost visibility) ──────────────────────────────────────
--
-- Nothing tracked AI spend anywhere before this. Every AI-calling feature
-- built across Sprints 6-9 (briefing, competitor reviews, performance
-- hypotheses, generation) went ungauged. Token counts are best-effort --
-- not every provider path returns them (see lib/ai.ts's TokenUsage type,
-- null for the DeepSeek raw-HTTP path) -- so call COUNT is the reliable
-- signal for budget checks, tokens are recorded when available for
-- rough cost estimation.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature            TEXT NOT NULL, -- 'briefing' | 'competitor_review' | 'performance_hypothesis' | 'generate' | ...
  model              TEXT NOT NULL,
  prompt_tokens      INT,
  completion_tokens  INT,
  total_tokens       INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature ON ai_usage_log (feature, created_at DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_ai_usage_log" ON ai_usage_log;
CREATE POLICY "allow_all_ai_usage_log" ON ai_usage_log FOR ALL USING (true) WITH CHECK (true);

-- ─── 2. Generic cron run log ─────────────────────────────────────────────────
--
-- ingestion_runs (migration 024) and briefing_runs (migration 040) already
-- log their own domains in detail -- not duplicating those. But ping,
-- market-refresh, and auto-generate had no log at all, and there was no
-- single place to answer "did today's crons run, and did they succeed" 
-- without checking N different tables with different shapes. This is a
-- thin, deliberately generic layer over the top, not a replacement.

CREATE TABLE IF NOT EXISTS cron_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      TEXT NOT NULL, -- matches the route path, e.g. 'market-refresh'
  status        TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  detail        JSONB,
  error_message TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_started ON cron_runs (job_name, started_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_cron_runs" ON cron_runs;
CREATE POLICY "allow_all_cron_runs" ON cron_runs FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE ai_usage_log IS 'Every AI generation call, for cost visibility. Call count is the reliable signal for budget checks (see lib/ai-usage.ts); token counts are best-effort.';
COMMENT ON TABLE cron_runs IS 'Thin generic log for every scheduled job (started/finished/status) -- domain-specific detail still lives in ingestion_runs / briefing_runs, this is just "did it run" visibility across all crons in one place.';
