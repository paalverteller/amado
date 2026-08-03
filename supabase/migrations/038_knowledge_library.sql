-- 038_knowledge_library.sql
-- Sprint 3 (lean plan Phase 2): text-first knowledge library.
--
-- Additive only. Does NOT touch books / book_chunks — those keep powering
-- /api/ideas/random exactly as before. This introduces the plan's §12.6/
-- §12.7 tables alongside them; a later cleanup sprint can retire the old
-- tables once the new pipeline is validated in production.

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── knowledge_assets ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'note'
    CHECK (content_type IN ('book', 'report', 'note', 'transcript', 'guideline', 'competitor_note', 'other')),
  raw_text TEXT NOT NULL,
  collection TEXT,
  retrieval_mode TEXT NOT NULL DEFAULT 'idea'
    CHECK (retrieval_mode IN ('idea', 'evidence', 'brand')),
  language TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'ready', 'error')),
  processing_error TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_assets_brand ON knowledge_assets (brand_id, active);
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_status ON knowledge_assets (processing_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_assets_collection ON knowledge_assets (collection);

ALTER TABLE knowledge_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_knowledge_assets" ON knowledge_assets;
CREATE POLICY "allow_all_knowledge_assets" ON knowledge_assets FOR ALL USING (true) WITH CHECK (true);
-- ^ Same permissive MVP policy as book_chunks/content_requests elsewhere in
--   this schema. Tightened in Phase 9 hardening (see docs/AMADO_ROADMAP.md).

-- ─── knowledge_chunks ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  char_count INTEGER,
  embedding vector(1536),
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_asset ON knowledge_chunks (asset_id);

-- IVFFlat index for cosine similarity search. lists=100 is a reasonable
-- default for a corpus of a few thousand chunks; revisit (higher lists,
-- or switch to HNSW) once real volume is known — see plan §12.10.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_knowledge_chunks" ON knowledge_chunks;
CREATE POLICY "allow_all_knowledge_chunks" ON knowledge_chunks FOR ALL USING (true) WITH CHECK (true);

-- ─── Semantic search RPC ────────────────────────────────────────────────────
-- Cosine distance via pgvector's <=> operator. Only returns chunks whose
-- parent asset is active and fully processed.

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_brand_id UUID DEFAULT NULL,
  match_retrieval_mode TEXT DEFAULT NULL,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  chunk_id UUID,
  asset_id UUID,
  asset_title TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    kc.id    AS chunk_id,
    ka.id    AS asset_id,
    ka.title AS asset_title,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_assets ka ON ka.id = kc.asset_id
  WHERE ka.active = true
    AND ka.processing_status = 'ready'
    AND (match_brand_id IS NULL OR ka.brand_id = match_brand_id)
    AND (match_retrieval_mode IS NULL OR ka.retrieval_mode = match_retrieval_mode)
    AND kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_knowledge_chunks(vector, UUID, TEXT, INT) TO anon, authenticated, service_role;

-- ─── Migrate existing books (plan Phase 2, task 1) ─────────────────────────
-- Additive: books/book_chunks are untouched, /api/ideas/random keeps
-- working. Chunks are NOT copied — the migrated rows land in
-- processing_status='pending' and get real chunks + (optionally)
-- embeddings the first time someone hits "Переиндексировать" on them
-- from the /knowledge UI, going through the same pipeline as any newly
-- uploaded text. Re-running this migration is safe: the NOT EXISTS guard
-- skips books that were already migrated.

INSERT INTO knowledge_assets (brand_id, title, content_type, raw_text, retrieval_mode, processing_status, active, source_note, created_at)
SELECT
  NULL,
  b.title,
  'book',
  COALESCE(string_agg(bc.content, E'\n\n' ORDER BY bc.chunk_index), ''),
  'idea',
  'pending',
  b.active,
  'Migrated from legacy books table',
  b.added_at
FROM books b
LEFT JOIN book_chunks bc ON bc.book_id = b.id
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge_assets ka
  WHERE ka.source_note = 'Migrated from legacy books table' AND ka.title = b.title
)
GROUP BY b.id, b.title, b.active, b.added_at;
