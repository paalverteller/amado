-- 017_get_random_book_chunk.sql
-- Creates (or replaces) the RPC used by /api/ideas/random.
-- Safe to run multiple times — uses CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION get_random_book_chunk()
RETURNS TABLE (
  book_id    UUID,
  book_title TEXT,
  content    TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    bc.book_id,
    b.title  AS book_title,
    bc.content
  FROM book_chunks bc
  JOIN books b ON b.id = bc.book_id
  WHERE b.active = true
    AND length(bc.content) > 100
  ORDER BY random()
  LIMIT 1;
$$;

-- Grant execute to the anon and service_role used by Supabase client
GRANT EXECUTE ON FUNCTION get_random_book_chunk() TO anon, authenticated, service_role;

-- Diagnostic: show current state after migration
SELECT
  b.id,
  b.title,
  b.active,
  b.chunk_count            AS stored_chunk_count,
  COUNT(bc.id)             AS actual_chunk_count,
  b.last_indexed_at
FROM books b
LEFT JOIN book_chunks bc ON bc.book_id = b.id
GROUP BY b.id, b.title, b.active, b.chunk_count, b.last_indexed_at
ORDER BY b.added_at DESC;
