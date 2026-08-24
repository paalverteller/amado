# Amado — schema map

Last consolidated: 2026-08-24.

The authoritative schema source is `supabase/migrations/`.

This file is an architectural map, not a substitute for reading the migrations before changing production schema.

## Identity and markets

- `regions` — market/locale/currency/time-zone metadata
- `user_preferences` — user-level UI preferences
- `brand_profiles` — brand summary and market linkage

Active product markets are BR, ES, DE and US.

## Brand OS

Core normalized Brand OS tables include:

- `brand_profiles`
- `brand_rule_sets`
- `brand_rules`
- `brand_terms`
- `brand_audiences`
- `brand_pain_points`
- `brand_products`
- `brand_capabilities`
- `brand_claims`
- `brand_content_pillars`
- `approved_examples`
- `platform_playbooks`
- `format_playbooks`
- `campaign_profiles`

Guideline/compiler support includes:

- `guideline_import_runs`
- `guideline_rule_candidates`
- `policy_conflicts`
- `policy_snapshots`

`platform_playbooks` is operational: active strategy and measurement JSON is injected into social generation.

## Content and generation

- `articles`
- `content_requests`
- `content_request_evidence`
- `prompt_templates`
- `content_formats`
- `generation_runs`
- `content_packages`
- `content_assets`
- `content_asset_relations`

The canonical application generation pipeline persists both content requests and generated articles.

## Evidence and ingestion

- `rss_sources`
- `rss_items`
- `source_items_raw`
- `source_health_events`
- `ingestion_runs`
- `evidence_items`
- `evidence_localizations`

`rss_items` remains a legacy compatibility layer.

`evidence_items` is the canonical evidence layer for modern workflows.

General-market eligibility is enforced in application code by `lib/market-source-policy.ts`.

Region scoping is based on `rss_sources.region_id`.

## Knowledge / RAG

- `knowledge_assets`
- `knowledge_chunks`

The system supports keyword retrieval and pgvector-backed semantic retrieval when embeddings are configured.

Legacy precursor tables may still exist:

- `books`
- `book_chunks`

Do not remove them without checking live dependencies and production data.

## Competitors

- `competitors`
- competitor-linked `rss_sources`
- competitor-linked `knowledge_assets`

Competitor evidence is intentionally separated from the general market-news eligibility policy.

## Marketing operations and performance

- `marketing_campaigns`
- `performance_snapshots`
- `content_pattern_usage`
- `preference_profiles`
- briefing tables introduced by migration 040

Performance logic should treat engagement metrics as signals, not as the sole business objective.

## QA / repair

- `qa_findings`
- `claim_spans`
- `repair_runs`

## Infrastructure

- cron/runtime state tables
- feature-flag events
- provider/runtime support tables introduced by migrations

See individual migrations for exact constraints and indexes.

## Migration policy

Production does not rely on replaying arbitrary historical migrations as a deployment mechanism.

Rules:

1. Do not rename or reorder already-applied migrations casually.
2. Keep archived legacy migrations in `supabase/migrations_archive/legacy/`.
3. Use explicit additive SQL in Supabase SQL Editor when that is the established production activation path.
4. Verify data changes with explicit SELECT queries.
5. Keep code and schema assumptions synchronized.

## Historical note

The repository predates the current lean product direction and therefore contains more normalized Brand OS / QA / learning machinery than a minimal greenfield implementation would need.

The current strategy is to evolve the existing schema safely rather than rewrite it.
