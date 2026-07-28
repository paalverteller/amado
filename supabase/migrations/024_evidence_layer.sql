-- Amado Stage 2 — Evidence Ingestion Platform
-- 
-- §9.3: Evidence layer
-- §9.8: AI operations layer
-- §7.4: Source configuration fields

-- ─── 1. Source items raw (immutable ingestion payload) ──────────────────────

CREATE TABLE IF NOT EXISTS source_items_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  connector_type TEXT NOT NULL DEFAULT 'rss',
  endpoint TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  http_status INTEGER,
  content_type TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_source_items_raw_source ON source_items_raw (source_id, fetched_at DESC);

-- ─── 2. Evidence items (normalized) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  raw_item_id UUID REFERENCES source_items_raw(id) ON DELETE SET NULL,
  
  -- Canonical identification
  canonical_url TEXT NOT NULL,
  content_fingerprint TEXT,
  
  -- Source content (source of truth)
  source_language TEXT,
  source_title TEXT NOT NULL,
  source_summary TEXT,
  source_author TEXT,
  
  -- Localization (optional enrichment)
  localized_title TEXT,
  localized_summary TEXT,
  localized_language TEXT,
  
  -- Metadata
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Enrichment
  entities TEXT[],
  topics TEXT[],
  region_ids TEXT[],
  source_authority NUMERIC DEFAULT 1.0,
  
  -- Hydration
  hydration_status TEXT DEFAULT 'snippet' CHECK (hydration_status IN ('snippet', 'full_text', 'failed')),
  full_text_storage_ref TEXT,
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES evidence_items(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on canonical URL per source
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_items_canonical 
  ON evidence_items (source_id, canonical_url);

CREATE INDEX IF NOT EXISTS idx_evidence_items_fingerprint 
  ON evidence_items (content_fingerprint) WHERE content_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_items_discovered 
  ON evidence_items (discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_items_source 
  ON evidence_items (source_id, discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_items_processed 
  ON evidence_items (processed, discovered_at) WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_evidence_items_regions 
  ON evidence_items USING GIN (region_ids) WHERE region_ids IS NOT NULL;

-- ─── 3. Evidence localizations ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_localizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id UUID NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (evidence_item_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_evidence_localizations_item 
  ON evidence_localizations (evidence_item_id);

-- ─── 4. Ingestion runs (observability) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  connector_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  items_discovered INTEGER DEFAULT 0,
  items_saved INTEGER DEFAULT 0,
  items_duplicated INTEGER DEFAULT 0,
  errors TEXT[],
  metadata JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source ON ingestion_runs (source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_success ON ingestion_runs (success, started_at DESC);

-- ─── 5. Source health events ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS source_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('success', 'failure', 'degraded', 'recovered')),
  http_status INTEGER,
  error_message TEXT,
  items_yielded INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_health_events_source ON source_health_events (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_health_events_type ON source_health_events (event_type, created_at DESC);

-- ─── 6. Update rss_sources with health fields ───────────────────────────────

ALTER TABLE rss_sources
  ADD COLUMN IF NOT EXISTS authority_weight NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS source_category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS polling_interval_minutes INTEGER DEFAULT 360,
  ADD COLUMN IF NOT EXISTS rights_notes TEXT,
  ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_title_length INTEGER,
  ADD COLUMN IF NOT EXISTS avg_summary_length INTEGER,
  ADD COLUMN IF NOT EXISTS language_detected TEXT,
  ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('unknown', 'healthy', 'degraded', 'unhealthy')),
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ;

-- ─── 7. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE evidence_items IS 'Normalized evidence records — source content independent of localization';
COMMENT ON COLUMN evidence_items.canonical_url IS 'Normalized URL for deduplication';
COMMENT ON COLUMN evidence_items.content_fingerprint IS 'Hash for fuzzy deduplication';
COMMENT ON COLUMN evidence_items.hydration_status IS 'snippet | full_text | failed';
COMMENT ON COLUMN evidence_items.processed IS 'Whether this item has been through signal detection';
COMMENT ON TABLE ingestion_runs IS 'Observability log for each ingestion execution';
COMMENT ON TABLE source_health_events IS 'Individual health events per source';
