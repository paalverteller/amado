-- Amado Sprint 5 — full-text storage for evidence items
--
-- evidence_items already had `hydration_status` and `full_text_storage_ref`
-- (migration 024) but nothing in the app ever wrote to them, and
-- full_text_storage_ref was designed as a pointer to an external store that
-- doesn't exist yet. This adds a plain `full_text` column and uses it
-- directly -- the simplest thing that works, matching the pattern
-- source_summary already uses for snippet content. full_text_storage_ref is
-- left untouched for a future external-storage migration if items outgrow
-- inline TEXT; nothing currently depends on it.

ALTER TABLE evidence_items
  ADD COLUMN IF NOT EXISTS full_text TEXT;

COMMENT ON COLUMN evidence_items.full_text IS
  'Full article/content text when available (manual paste, or future hydration via lib/web-reader.ts). NULL when hydration_status = snippet.';
