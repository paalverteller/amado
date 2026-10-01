-- Amado: live-schema audit. READ-ONLY. Safe on production.
-- Run each numbered statement SEPARATELY in the Supabase SQL Editor: it shows
-- only the last statement's result grid, and never shows RAISE NOTICE output.
-- The live database is the source of truth: it differs from supabase/migrations
-- (production was consolidated by hand), so do not infer prod state from files.

-- 1. region_id columns: type + FK + delete rule (expect uuid + FK everywhere)
SELECT c.table_name, c.column_name, c.data_type, c.is_nullable,
       fk.constraint_name AS fk_name, fk.delete_rule
FROM information_schema.columns c
LEFT JOIN (
  SELECT tc.table_name, kcu.column_name, tc.constraint_name, rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
WHERE c.table_schema = 'public' AND c.column_name = 'region_id'
ORDER BY c.table_name;

-- 2. *_id columns with no FK. A review list, NOT a bug list: some are intentional
--    (thread_id) or point at tables that do not exist (workspace_id, brief_id...).
SELECT c.table_name, c.column_name, c.data_type
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.column_name LIKE '%\_id' AND c.column_name <> 'id'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = c.table_name
      AND kcu.column_name = c.column_name)
ORDER BY c.table_name, c.column_name;

-- 3. FK columns with no supporting index (only matters as tables grow)
SELECT tc.table_name, kcu.column_name, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes pi
    WHERE pi.tablename = tc.table_name
      AND (pi.indexdef LIKE '%(' || kcu.column_name || ')%'
        OR pi.indexdef LIKE '%(' || kcu.column_name || ',%'))
ORDER BY tc.table_name;

-- 4. RLS status. This app uses the service-role key server-side, so the
--    convention is RLS enabled + one permissive policy on every table.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, count(p.polname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity, c.relname;

-- 5. Nullable columns that are NULL in every row (dead-column signal).
--    Returns a grid (temp table + final SELECT); run BOTH parts in one execution.
CREATE TEMP TABLE IF NOT EXISTS _audit_null_cols (table_name text, column_name text, row_count bigint);
TRUNCATE _audit_null_cols;
DO $$
DECLARE rec RECORD; filled BIGINT; total BIGINT;
BEGIN
  FOR rec IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.is_nullable = 'YES' AND c.column_name NOT IN ('id', 'created_at', 'updated_at')
  LOOP
    EXECUTE format('SELECT count(*), count(*) FILTER (WHERE %I IS NOT NULL) FROM %I', rec.column_name, rec.table_name)
      INTO total, filled;
    IF total > 0 AND filled = 0 THEN
      INSERT INTO _audit_null_cols VALUES (rec.table_name, rec.column_name, total);
    END IF;
  END LOOP;
END $$;
SELECT * FROM _audit_null_cols ORDER BY table_name, column_name;

-- 6. Orphan check for three columns that look like missing FKs (target table exists,
--    no FK). Add the FK only if orphan_rows = 0 for that row.
SELECT 'brand_claims.product_id -> brand_products' AS candidate_fk, count(*) AS orphan_rows
FROM brand_claims c WHERE c.product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM brand_products p WHERE p.id = c.product_id)
UNION ALL
SELECT 'content_assets.generation_run_id -> generation_runs', count(*)
FROM content_assets c WHERE c.generation_run_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM generation_runs g WHERE g.id = c.generation_run_id)
UNION ALL
SELECT 'content_packages.policy_snapshot_id -> policy_snapshots', count(*)
FROM content_packages c WHERE c.policy_snapshot_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM policy_snapshots s WHERE s.id = c.policy_snapshot_id);
