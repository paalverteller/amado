-- 019_books_author_gender.sql
-- Add author_gender column to books table.
-- Enum values: 'female' | 'male' | 'neutral'
-- NULL means unknown / not set (backwards-compatible default).

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS author_gender TEXT
    CHECK (author_gender IN ('female', 'male', 'neutral'));

-- Verify
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'books'
ORDER BY ordinal_position;
