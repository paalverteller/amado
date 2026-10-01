-- Amado — fix rss_sources.region_id column type
--
-- Root cause: 022_amado_baseline.sql added rss_sources.region_id as TEXT.
-- 023_regions_brands_i18n.sql later tried to add it as
-- "UUID REFERENCES regions(id)" via ADD COLUMN IF NOT EXISTS, but the
-- column already existed (as TEXT from 022), so that statement silently
-- no-op'd. articles.region_id and brand_profiles.region_id both got the
-- correct UUID + FK treatment directly in 023, since those columns didn't
-- already exist. rss_sources.region_id is the only region_id column left
-- as untyped TEXT with no foreign key to regions(id).
--
-- In practice every write path (seeds and application code) has always
-- stored a real regions.id UUID as a string here, so this migration is a
-- type correction, not a data migration. It is defensive: it only casts
-- rows that are valid UUIDs matching an existing region, and reports
-- (rather than silently drops) anything that wouldn't survive the cast.
--
-- Run this in the Supabase SQL Editor. Idempotent — safe to re-run.
--
-- Note (2026-09-19): after this was run against production, the constraint read
-- back as ON DELETE SET NULL, which is what every other region_id FK in production
-- uses (articles, brand_profiles, content_requests, ...). Plain Postgres would have
-- produced NO ACTION from the original text, so production either already had this
-- FK or was created differently from these files (production was consolidated by
-- hand). The ON DELETE SET NULL below makes a fresh environment match production.

-- ─── 1. Pre-flight check: anything that would NOT survive the cast ─────────
-- If this returns any rows, STOP and investigate before proceeding — do not
-- run section 2 until this is empty or you have reviewed every row.
-- Safe to re-run after the column is already UUID: the WHERE clause short
-- circuits to no rows once region_id is no longer TEXT, instead of erroring
-- on the text-only !~* operator.

SELECT id, name, region_id AS unmigratable_region_id
FROM rss_sources
WHERE region_id IS NOT NULL
  AND (SELECT data_type FROM information_schema.columns
       WHERE table_name = 'rss_sources' AND column_name = 'region_id') = 'text'
  AND (
    -- not shaped like a UUID at all
    region_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    -- shaped like a UUID, but doesn't match any real region
    OR region_id::text::uuid NOT IN (SELECT id FROM regions)
  );

-- ─── 2. Migrate the column type (only run if section 1 returned 0 rows) ────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rss_sources' AND column_name = 'region_id' AND data_type = 'text'
  ) THEN
    -- Null out anything that wouldn't survive the cast, rather than
    -- aborting the whole migration. Section 1 should have already caught
    -- these — this is a defensive fallback, not the primary path.
    UPDATE rss_sources
    SET region_id = NULL
    WHERE region_id IS NOT NULL
      AND (
        region_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR region_id::uuid NOT IN (SELECT id::text::uuid FROM regions)
      );

    ALTER TABLE rss_sources
      ALTER COLUMN region_id TYPE UUID USING region_id::uuid;

    ALTER TABLE rss_sources
      ADD CONSTRAINT rss_sources_region_id_fkey
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

    RAISE NOTICE 'rss_sources.region_id migrated from TEXT to UUID with FK to regions(id)';
  ELSE
    RAISE NOTICE 'rss_sources.region_id is not TEXT (already migrated or unexpected state) — no action taken';
  END IF;
END $$;

-- ─── 3. Verify ───────────────────────────────────────────────────────────

SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'rss_sources' AND column_name = 'region_id';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'rss_sources'::regclass AND contype = 'f' AND conname = 'rss_sources_region_id_fkey';
