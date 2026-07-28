CREATE TABLE IF NOT EXISTS book_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    char_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_chunks_book_id ON book_chunks (book_id);

ALTER TABLE book_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_book_chunks" ON book_chunks;
CREATE POLICY "allow_all_book_chunks" ON book_chunks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE books ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMPTZ;
