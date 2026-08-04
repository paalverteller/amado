# Archived legacy migrations

These files predate the numbered migration scheme (`000_...` through
`038_knowledge_library.sql`) and are **not** run by `supabase db push`
or `supabase db reset` from this location anymore.

They are kept here for historical reference only. Their schema changes
are already reflected in the numbered migrations and in
`docs/SCHEMA.md`.

## `clean_history.sql` — why this one mattered

```sql
DELETE FROM articles;
```

No numeric prefix, no guard, no comment. Supabase sorts migrations by
filename, so on a full replay this ran *after all 38 numbered
migrations* and would have deleted every article. Archived on
2026-08-04 as part of Sprint 4B infra cleanup — see
`docs/AMADO_ROADMAP.md`.

## Everything else in this folder

`add_rss_sources.sql`, `ensure_*.sql`, `final_rebuild.sql`, `fix_*.sql`,
`seed_*.sql`, `sprint1_001_*.sql`, `sprint2_001_*.sql`, `sprint3_001_*.sql`
— early, undated iterations of `rss_sources` / `prompt_templates`
schema work, superseded by the numbered migrations. All used
`IF NOT EXISTS` guards, so they were not destructive, just redundant.

Not archived: `022_amado_baseline.sql` / `022_pivot_phase1_cleanup_and_seed.sql`
and `023_brand_profiles.sql` / `023_regions_brands_i18n.sql`. These share
a numeric prefix by mistake but are both legitimate, already-applied,
documented migrations — moving or renumbering them risks desyncing
Supabase's applied-migration tracking table. Left as a cosmetic
follow-up, not urgent.
