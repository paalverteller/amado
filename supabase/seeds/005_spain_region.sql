-- Amado — Sprint 12 Phase 1: activate Spain as second region
--
-- Additive only. Does NOT touch existing BR data, brand_profiles, or any
-- content. Matches the project's own precedent (002/003/004 seeds): SQL
-- Editor, not `supabase db push` -- production DB follows the manually
-- consolidated baseline, not raw migration history (see HANDOFF.md).
--
-- What this does:
--   1. Inserts and activates 'ES' (Spain) into `regions`. Migration 023 only
--      seeded 'BR' (active) plus 'MX'/'IT' as inactive placeholders -- 'ES'
--      was never present at all, so this is a plain insert, not a reactivation.
--   2. Nothing else. No brand_profiles, no rss_sources, no UI wiring --
--      those are later phases of the same sprint (see docs/AMADO_ROADMAP.md
--      Sprint 12 entry for the full phase breakdown).
--
-- Run: paste into Supabase SQL Editor and execute.

INSERT INTO regions (code, name, default_language_code, locale_code, currency_code, timezone, search_domain, active)
VALUES ('ES', 'España', 'es-ES', 'es-ES', 'EUR', 'Europe/Madrid', 'google.es', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  default_language_code = EXCLUDED.default_language_code,
  locale_code = EXCLUDED.locale_code,
  currency_code = EXCLUDED.currency_code,
  timezone = EXCLUDED.timezone,
  search_domain = EXCLUDED.search_domain,
  active = true,
  updated_at = now();

-- Verification: expect one active ES row alongside the existing active BR row.
SELECT code, name, default_language_code, locale_code, currency_code, timezone, active
FROM regions
WHERE code IN ('BR', 'ES')
ORDER BY code;
