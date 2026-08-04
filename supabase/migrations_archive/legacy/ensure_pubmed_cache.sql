CREATE TABLE IF NOT EXISTS pubmed_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pmid TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  abstract_text TEXT,
  authors TEXT[],
  journal TEXT,
  published_date DATE,
  fetched_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pubmed_fetched ON pubmed_cache (fetched_at DESC);
ALTER TABLE pubmed_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_pubmed" ON pubmed_cache;
CREATE POLICY "allow_all_pubmed" ON pubmed_cache FOR ALL USING (true) WITH CHECK (true);
