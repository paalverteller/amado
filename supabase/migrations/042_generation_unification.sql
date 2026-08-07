-- Amado Sprint 8 — generation workspace unification (Phase 7)
--
-- content_requests already tracked evidence_item_ids + the junction table
-- (migration 025) but had no concept of a refinement chain or a record of
-- which knowledge chunks / brand facts actually went into the prompt.
-- Adding both here rather than new tables: this is metadata about an
-- existing content_requests row, not a new entity.

ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS thread_id UUID,
  ADD COLUMN IF NOT EXISTS parent_request_id UUID REFERENCES content_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refinement_note TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_chunk_ids UUID[],
  ADD COLUMN IF NOT EXISTS brand_snapshot_summary JSONB;

-- Every existing row becomes the root of its own single-item thread so
-- thread_id is never NULL for rows created going forward either (the
-- application always sets it, this backfill just covers history).
UPDATE content_requests SET thread_id = id WHERE thread_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_requests_thread ON content_requests (thread_id, created_at);

COMMENT ON COLUMN content_requests.thread_id IS 'Groups a generation with its refinements (see parent_request_id). Set to the row''s own id for the first generation in a thread.';
COMMENT ON COLUMN content_requests.parent_request_id IS 'Set when this request is a refinement of a previous one -- the "regenerate with changes" flow, not a new topic.';
COMMENT ON COLUMN content_requests.refinement_note IS 'The person''s instruction for how this version should differ from its parent (e.g. "shorter, more casual tone").';
COMMENT ON COLUMN content_requests.knowledge_chunk_ids IS 'knowledge_chunks.id values actually retrieved and included in the prompt -- for the "what context was used" UI, not a full FK array (chunks can be deleted/reindexed independently).';
COMMENT ON COLUMN content_requests.brand_snapshot_summary IS 'Flat list of {category, label} facts pulled from Brand OS tables into the prompt (see lib/brand-snapshot.ts) -- same transparency purpose as knowledge_chunk_ids.';
