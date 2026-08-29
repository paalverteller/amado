# Amado — handoff

Last consolidated: 2026-08-24.

Read `README.md` first. This file contains only the state and constraints that matter when continuing work.

## Product

Amado is an AI-first marketing workspace.

The current product has four active market contexts:

- BR — Brazilian Portuguese
- ES — Spanish for Spain
- DE — German for Germany
- US — US English

The UI is always Russian. Market selection changes content language, market evidence, Brand OS context and market-aware AI prompts.

Do not mix UI locale with market locale.

## Current architecture

### Frontend

Next.js 16 App Router + React 19.

The canonical UI system is August:

- dark desktop sidebar;
- responsive PWA navigation;
- Inter-only typography;
- August semantic tokens in `app/globals.css`;
- standard feedback via `components/ui/AugustFeedback.tsx`;
- standard dialogs via `components/ui/AugustDialog.tsx`.

Do not reintroduce legacy visual systems.

Next.js 16 uses `proxy.ts`. Never create `middleware.ts` in parallel.

### Market context

`lib/market-context.tsx` is the client market context.

`lib/locale.ts` contains static region locale metadata.

Region data also exists in Supabase `regions`.

The market switcher is product-wide. Brand, generation, localization, rewrite, competitors, SEO and market analysis should follow the selected region.

### Generation

Canonical generation entry:

`lib/content-generation/generate-article.ts`

Important dependencies:

- `lib/prompts.ts`
- `lib/brand-snapshot.ts`
- `lib/evidence.ts`
- `lib/social-generation-policy.ts`
- Knowledge/RAG repositories
- article/content-request repositories

Automatic recent evidence must be region-aware.

### Social content

The social-media brief dated 2026-08-24 is integrated as executable Brand OS playbooks.

Supported social formats:

- LinkedIn
- Instagram caption
- Instagram carousel
- Facebook
- X thread
- Threads

`platform_playbooks` contains platform strategy + measurement rules.

`lib/social-generation-policy.ts` adds the permanent social execution contract and active playbook to canonical generation.

Do not hardcode Brazil-specific social guidance into generic prompt code.

### Market evidence

`lib/market-source-policy.ts` is the shared eligibility rule for general market intelligence.

General market intelligence excludes politics/elections, geopolitical conflict, sport and entertainment noise.

Business-relevant regulation, privacy, tax, labour, SaaS, SMB and technology coverage can remain eligible.

Competitor sources are a separate workflow and are not discarded from competitor monitoring.

Evidence selection for generation must respect region.

### Brand OS

Brand OS is region-specific.

Core areas:

- profile / positioning;
- audiences and pains;
- products and claims;
- voice / vocabulary;
- content pillars;
- examples;
- compliance;
- rule-set versions;
- platform playbooks.

The `/brand` workspace must never show another region's profile when the market changes.

### AI providers

Current runtime supports Google, Groq, OpenAI and DeepSeek fallback behavior.

Google key aliases:

- `GEMINI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

See `lib/ai.ts` and `lib/ai-utils.ts`.

## Database discipline

Production Supabase uses a manually consolidated baseline.

Do not casually run historical `supabase db push`.

For additive production data, provide explicit SQL for Supabase SQL Editor plus a verification query.

Historical migrations are intentionally retained because changing already-applied migration history can desynchronize Supabase.

## Verification discipline

For normal code changes:

```bash
npm test
npm run build
node scripts/verify-august-ui.mjs
git diff --check
```

Also run the relevant product verifier:

- `verify-mvp-runtime.mjs`
- `verify-final-workspaces.mjs`
- `verify-multimarket-localization.mjs`
- `verify-social-source-sprint.mjs`
- `verify-amado-chain.mjs`

Do not create a verifier that asserts guessed UI text or brittle implementation details. Verify behavior/invariants.

## Patch discipline

One task = one consolidated patch.

Before delivery:

1. inspect the real target code;
2. patch structurally when a file has already been touched by earlier patches;
3. run syntax/type/tests/build;
4. rerun the patch when idempotency matters;
5. do not leave patch scripts in repository root.

Root `apply_*.py`, `fix*.py`, recovery scripts, Repomix exports and Python caches are temporary artifacts and should not be committed.

## Current documentation

`README.md` is the primary engineering/product overview.

`docs/AMADO_ROADMAP.md` tracks current direction rather than every historical patch.

`docs/SCHEMA.md` is the schema map.

Old patch-by-patch narrative should not be reintroduced into HANDOFF.

## Deferred unless explicitly requested

Do not build these autonomously:

- direct social publishing;
- protected/private social scraping;
- autonomous campaign decisions;
- automatic Brand OS learning without review;
- automatic external social-metrics ingestion;
- complex agent swarms;
- document/OCR pipelines unrelated to the current product priorities.

<!-- DATA_SOURCES_DE_US_SEED_20260825 -->

## Data Sources — Germany + US Seed (2026-08-25)

**What was done:**
- Added the `supabase/seeds/008_de_us_sources.sql` seed, delivered via
  `apply_datasources_de_us_seed_20260825.py`.
- DE and US regions existed since `007_germany_us_locales.sql` but had
  **zero** `rss_sources` rows. This seed adds the first sources for both.
- 6 Germany sources: t3n (technology), HORIZONT Marketing (marketing),
  OnlineMarketing.de (marketing), Gründerszene / Business Insider DE
  (business_technology), Handelsblatt Unternehmen (business), Handelsblatt
  Technologie (technology).
- 5 US sources: TechCrunch (technology), VentureBeat (technology),
  MarTech (marketing), SaaStr (business_technology), Adweek (marketing).
- Every URL was verified live by fetching the actual RSS/Atom XML on
  2026-08-25 and confirming recent publication dates (within days of
  verification), not just guessed from a directory listing.
- `source_type = 'rss'` for all 11 — none is a guessed `html_index` path.
- New rows set `health_status = 'healthy'` and `last_success_at = now()`
  directly on insert (confirmed real columns on `rss_sources`, with
  `health_status` under a CHECK constraint), plus a matching
  `source_health_events` row per source, since these were live-verified
  at seed time rather than left at the default `'unknown'`.

**Consciously not done:**
- Did not add Retail Dive: no confirmed direct feed URL found (site only
  offers a third-party "Generate RSS" service, not an official feed).
- Did not add RetailWire: feed resolves and parses, but `lastBuildDate` was
  ~5 months stale at verification time — fails the "always fresh" bar for
  this project, so it was excluded rather than seeded with a known-stale
  source.
- Did not add Ad Age: no confirmed native feed URL; only third-party feed
  generators found in search results.
- US set (5) is intentionally smaller than DE (6) — stopped once the
  remaining reachable candidates failed live-verification, per the standing
  instruction to verify before seeding rather than pad the count.

**Bugs found and fixed along the way:**
- First draft of this seed guessed `rss_sources.items_count` and a
  `source_health_events` schema without checking migrations against this
  snapshot. Re-verified against actual CREATE/ALTER TABLE statements in
  `supabase/migrations/` before finalizing: `items_count`,
  `health_status`, `last_success_at`, `authority_weight`,
  `source_category`, `region_id` all confirmed real; `source_health_events`
  columns (`source_id, event_type, items_yielded, created_at`) also
  confirmed real and correct on first guess.
- First draft also had a dead `UPDATE ... WHERE items_count IS NULL`
  block — the column defaults to `0`, not `NULL`, so that condition could
  never match on freshly inserted rows. Removed it; `health_status` and
  `last_success_at` are now set directly in the INSERT instead.
- First draft's `source_health_events` INSERT was scoped to
  `WHERE region_id IN (...)`, which would re-insert an event row for
  *every* DE/US source (including ones from earlier seed runs) on each
  re-run, not just the 11 new ones. Scoped it to the 11 specific URLs
  instead.

**Next steps queued:**
- Consider a second pass once more DE/US candidates can be verified live
  (e.g. Modern Retail, Search Engine Land, more DE regional business press).
- No product decision needed before this seed goes live — it's additive to
  an already-approved region/source data model.

<!-- GUIDELINE_IMPORT_SCHEMA_FIX_20260829 -->

## Guideline Import Pipeline — Schema Mismatch Fix (2026-08-29)

**Context:**
- Investigating Priority #2 ("Brand OS depth by market", DE/US/ES all
  still placeholders) found that the intended unblock path -- uploading a
  real brand book through `GuidelineImportTab`, which POSTs to
  `app/api/brands/[brandId]/guidelines/import` and later PATCHes
  `.../import/[runId]` to publish approved rules -- was silently broken
  end to end.
- Two earlier delivery attempts (scripts dated 2026-08-28 and 2026-08-29,
  before this one) both correctly refused to apply: their anchor for the
  pre-patch file content was built from a `repomix` XML export using a
  regex that stripped the file's real trailing newline, so the computed
  anchor was 5335 bytes instead of the real file's 5336 bytes. Neither
  script ever touched the route file or the database because of this --
  the drift-guard in both scripts did exactly what it was supposed to do
  and refused to overwrite a file that didn't match the expected anchor,
  rather than silently corrupting it. This script rebuilds the anchor
  correctly from a fresh repomix export and has been verified to match
  the real on-disk file byte for byte before proceeding.

**What was found (in `app/api/brands/[brandId]/guidelines/import/route.ts`):**
1. The `guideline_rule_candidates` INSERT never supplied `raw_text` or
   `enforcement`, both `NOT NULL` columns with no default in
   `030_brand_os_core.sql`. Every insert would fail its NOT NULL
   constraint.
2. The same INSERT sent `is_hard_rule`, which is not a column on
   `guideline_rule_candidates` at all.
3. The same INSERT sent `confidence: rule.confidence`, a string
   (`'high'|'medium'|'low'`) into a `NUMERIC` column -- invalid type.
4. The `policy_conflicts` INSERT sent `description` and
   `conflicting_rules`, neither of which exist on that table. The real
   columns are `explanation` plus `candidate_a_id`/`candidate_b_id`
   foreign keys into `guideline_rule_candidates`.
5. Downstream, the publish step (`PATCH .../guidelines/import/[runId]`)
   passes `candidate.rule_class` and `candidate.enforcement` straight
   through into `brand_rules`, which has its own, stricter CHECK
   constraints: `brand_rules.enforcement` only allows `hard_block,
   required, forbidden, warning, preference, scoring, human_review`, and
   `brand_rules.rule_class` only allows `safety, legal, factual,
   brand_positioning, language, platform, format, campaign, style,
   optimization_hypothesis, measurement`. The extraction agent's own
   `ruleType` vocabulary (`tone, vocabulary, claim, structure, visual,
   legal, safety`) has five values not in that list, so even a correctly
   inserted candidate would fail to publish.

**What was done:**
- Rewrote the candidate-insert loop to populate `raw_text`, `enforcement`
  (mapped to `'hard_block'`/`'preference'`, matching `brand_rules`), and
  `confidence` as NUMERIC (`1`/`0.6`/`0.3`). Added a `RULE_CLASS_MAP`
  translating each `ruleType` to a `brand_rules`-valid `rule_class`
  (`tone->style, vocabulary->language, claim->factual, structure->format,
  visual->style, legal->legal, safety->safety`), with an unrecognized-type
  fallback to `brand_positioning` since the column is NOT NULL.
- Captured each inserted candidate's real row id and resolved
  `conflict.ruleA`/`ruleB` back to those ids for the `policy_conflicts`
  insert, writing `explanation` instead of the non-existent
  `description`/`conflicting_rules` columns.
- Confirmed via search that `.enforcement` and `.rule_class` are read
  nowhere else in the codebase, so mapping them correctly at
  candidate-insert time means the publish route (`[runId]/route.ts`)
  needs no changes itself -- it already passes both fields through
  correctly, it was just receiving invalid values.
- Added per-row error logging so partial extraction failures are visible
  instead of silent.

**Consciously not done:**
- Did not touch `workspace_id: '00000000-0000-0000-0000-000000000000'`.
  No `workspaces` table exists anywhere in the codebase, so this looks
  like a leftover from an abandoned multi-tenant design rather than an
  active bug. Flagging it here in case it matters later.
- Did not write any DE/US/ES brand voice, claims, or positioning content.
  That's business input Paal or each market owner needs to provide
  (upload a real brand book) -- this fix only unblocks the pipe.

**Bugs found and fixed along the way:**
- See "What was found" above.
- Separately: the anchor-mismatch bug described in "Context" above, which
  caused two earlier delivery attempts to correctly self-abort rather
  than apply. Root cause was in the delivery tooling (a `repomix`
  extraction regex on Claude's side), not in anything Paal did.

**Verification performed:**
- Confirmed the true on-disk file (5336 bytes, ends with a newline) is
  byte-identical to this script's anchor before finalizing it.
- Diffed old vs new file to confirm only the two broken insert blocks
  changed.
- Ran `tsc --noEmit` against the file in an isolated project with stub
  modules matching the real `@/lib/*` export signatures. The fixed file
  produces the same set of type errors as the unmodified original (all
  `strict`-mode nullability complaints from simplified stub types, not
  from this patch) -- zero new type errors introduced.
- Confirmed brace/paren/backtick/quote balance on the new file.

**Next steps queued:**
- Once this lands, Paal or each market owner can use `GuidelineImportTab`
  to import a real brand book for each market, end to end (import,
  review, publish).
