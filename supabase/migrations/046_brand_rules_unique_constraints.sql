-- Amado — Fable code review remediation, Phase 1
--
-- Fixes two confirmed data-integrity gaps found during the Fable 5.1
-- code review (see docs/fable-review.md, Phase 1 and "Triage notes"):
--
-- 1. brand_rule_sets had only a non-unique partial index on
--    (brand_id, status) WHERE status = 'active'. Two active rule sets
--    per brand can coexist today, which makes brand-snapshot.ts's
--    .maybeSingle() lookup throw a PostgREST "multiple rows" error --
--    silently dropping all compliance rules from generation via the
--    caught/ignored error path that Phase 1's brand-snapshot.ts fix
--    now surfaces instead of swallowing.
--
-- 2. brand_rules had no unique constraint on (rule_set_id, rule_key).
--    The guideline-import publish path (app/api/brands/[brandId]/
--    guidelines/import/[runId]/route.ts) copies rule_key unchanged
--    from guideline_rule_candidates, which builds it as
--    `${ruleType}_${scope}` -- e.g. every "tone" rule scoped globally
--    collides on "tone_global". Without a DB-level constraint, these
--    duplicates are inserted silently and only ever get arbitrated
--    at READ time by compileRules()'s in-memory Map-based dedup,
--    which is non-deterministic across requests when createdAt ties
--    (see precedence.ts's sortByPrecedence findings). Adding the
--    constraint here does not fix the collision at the source (that's
--    a separate application-layer fix, in the import route) but it
--    stops duplicates from silently accumulating in the meantime and
--    makes the failure loud and attributable instead of silent.
--
-- Both changes are defensive against pre-existing violations: any
-- brand that already has more than one active rule_set, or any
-- rule_set that already has duplicate rule_keys, is repaired (see
-- step 0 below) BEFORE the constraint is added, so this migration
-- cannot fail on data that predates it.

-- ─── 0. Defensive repair of any pre-existing violations ─────────────────────

-- 0a. If any brand already has more than one 'active' rule_set (which the
--     old non-unique index allowed), keep only the most recently published
--     one active and archive the rest. This mirrors the ORDER BY
--     published_at DESC LIMIT 1 the application already uses when reading
--     "the" active rule set, so behavior does not change for any brand
--     that already had exactly one active set (the overwhelming majority).
WITH ranked AS (
  SELECT
    id,
    brand_id,
    ROW_NUMBER() OVER (
      PARTITION BY brand_id
      ORDER BY published_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM brand_rule_sets
  WHERE status = 'active'
)
UPDATE brand_rule_sets
SET status = 'archived'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 0b. If any rule_set already has duplicate rule_keys (which the missing
--     unique constraint allowed), keep only the highest-precedence row per
--     (rule_set_id, rule_key) -- same ordering compileRules() itself uses
--     minus the createdAt tiebreak ambiguity this review flagged -- and
--     delete the rest. This is a one-time cleanup; it does not change
--     which single rule "wins" once the constraint exists, since that's
--     exactly the row compileRules() would already have selected on ties
--     going forward, just made deterministic instead of input-order-
--     dependent.
WITH ranked AS (
  SELECT
    id,
    rule_set_id,
    rule_key,
    ROW_NUMBER() OVER (
      PARTITION BY rule_set_id, rule_key
      ORDER BY
        (CASE WHEN enforcement = 'hard_block' THEN 0
              WHEN enforcement IN ('required', 'forbidden') THEN 1
              ELSE 2 END) ASC,
        priority ASC,
        human_approved DESC,
        created_at DESC,
        id ASC
    ) AS rn
  FROM brand_rules
)
DELETE FROM brand_rules
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── 1. Unique partial index: at most one active rule set per brand ─────────

DROP INDEX IF EXISTS idx_brand_rule_sets_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_rule_sets_active_unique
  ON brand_rule_sets (brand_id)
  WHERE status = 'active';

-- ─── 2. Unique constraint: no duplicate rule_key within one rule set ────────

ALTER TABLE brand_rules
  DROP CONSTRAINT IF EXISTS brand_rules_rule_set_id_rule_key_key;

ALTER TABLE brand_rules
  ADD CONSTRAINT brand_rules_rule_set_id_rule_key_key
  UNIQUE (rule_set_id, rule_key);

-- ─── 3. Comments ─────────────────────────────────────────────────────────────

COMMENT ON INDEX idx_brand_rule_sets_active_unique IS
  'Fable review Phase 1: enforces at most one active rule_set per brand. Replaces the old non-unique idx_brand_rule_sets_active.';
COMMENT ON CONSTRAINT brand_rules_rule_set_id_rule_key_key ON brand_rules IS
  'Fable review Phase 1: prevents silent duplicate rule_key accumulation from the guideline-import publish path. See docs/fable-review.md Phase 1.';
