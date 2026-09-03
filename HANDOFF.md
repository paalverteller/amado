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

<!-- GUI_AUDIT_PHASE1_20260831 -->

## GUI Audit and Modernization — Phase 1 (2026-08-31)

**Context:**
- Paal requested a GUI audit as a new roadmap priority (#6): find and fix
  visual/UX defects, remove dead layers, migrate to the August design
  token system. Flagged specifically: a broken-looking "+" (add) button
  showing what looked like a stray dot/mark instead of a clean icon.
- Full audit performed against the repomix snapshot. Findings and
  severity are recorded in docs/AMADO_ROADMAP.md under this same tag.

**What was found and fixed in this phase:**
1. Root cause of the "+" defect: `RU_DICT.competitors.add_source` in
   `lib/i18n/config.ts` was the literal string `'+ Добавить источник'` —
   a plain `+` character concatenated into translated text, not an SVG
   icon. Same pattern found independently in
   `components/settings/SourceCard.tsx` (`'+ Добавить материал'`).
   Both fixed: the `+` character removed from translated/hardcoded text;
   SourceCard's manual-add toggle now renders a proper inline SVG plus
   icon (matching the existing `NavIcon` SVG-icon convention) instead of
   a text character.
2. `app/analytics/page.tsx` was not wrapped in `<Layout>` — a real
   navigation dead-end: visiting `/analytics` gave the user no sidebar,
   no mobile nav, no way back into the app without using the browser
   back button. Fixed by wrapping the page in `<Layout>`.
3. Same file had a Cyrillic function identifier
   (`АналитикаPage`), which conflicts with the project's standing rule
   that all code — including identifiers — must be in English. Renamed
   to `AnalyticsPage`.
4. Same file mixed pt-BR text fragments ("do total", "eventos", "Nunca")
   into what is otherwise a Russian-only UI page. Replaced with Russian
   equivalents ("от общего числа", "событий", "Никогда").
5. Same file was 100% raw Tailwind utility colors (bg-blue-600,
   text-gray-500, bg-green-500, etc.) with no design-system classes at
   all. Migrated to `m3-card` for card surfaces and August CSS custom
   properties (`--aug-ink`, `--aug-muted`, `--aug-success-fg`,
   `--aug-danger-fg`, `--aug-warning-fg`, `--aug-accent`) for text/status
   colors, and `aug-button aug-button--secondary` for the refresh
   action.
6. `components/settings/SourceCard.tsx`'s `HEALTH_COLOR` map used raw
   Tailwind `bg-*-100 text-*-800` pairs. These happened to render
   correctly today only because `app/globals.css` has a legacy
   compatibility block (`.aug-app-shell .bg-green-100 Ellipsis` etc.)
   that intercepts exactly those class names — but that's an implicit,
   fragile dependency (a future rename of either side breaks status
   colors with no compiler error). Replaced with an explicit
   `HEALTH_BADGE_STYLE` map of inline styles reading `--aug-success-bg`/
   `-fg`, `--aug-warning-bg`/`-fg`, `--aug-danger-bg`/`-fg`,
   `--aug-neutral-bg`/`-fg` directly.

**Consciously not done in this phase (queued for later phases):**
- `app/competitors/page.tsx` and `app/knowledge/page.tsx` are still 100%
  inline `v2-color-*` legacy styles with no `m3-card`/`aug-button`/
  `aug-field` classes. Deferred to Phase 2 (competitors) and Phase 3
  (knowledge) — both are larger, self-contained page rewrites and don't
  belong in the same patch as the critical analytics-navigation fix.
- The 8 brand-tab components (`AudiencePainsTab`, `ComplianceTab`,
  `VoiceVocabularyTab`, `VersionsTab`, `ContentPillarsTab`,
  `ExamplesTab`, `OverviewTab`, `ProductsClaimsTab`,
  `GuidelineImportTab`) still use raw Tailwind (`bg-blue-600`,
  `bg-gray-100`, etc.) instead of August tokens. Deferred to Phase 4.
  `GuidelineImportTab` should be prioritized within that phase since
  it's the pipeline just unblocked for Priority #2.
- Did not touch the broader `.aug-app-shell` legacy-Tailwind override
  block in `app/globals.css` itself (the block that maps bg-green-100
  etc. to August tokens for older pages). It's still load-bearing for
  `app/competitors/page.tsx`, `app/knowledge/page.tsx`, and the 8 brand
  tabs until Phases 2-4 land. Removing it now would visually break those
  pages. It should be deleted once Phases 2-4 are complete and nothing
  depends on it anymore — tracked in the roadmap.
- Did not add a full `analytics.*` i18n namespace for this page's
  strings (labels are still hardcoded Russian, just corrected from the
  pt-BR contamination). The rest of the app is inconsistent about this
  too (some pages use `t()` throughout, some hardcode Russian). Doing
  this properly means auditing which pages should move to `t()` — a
  separate, larger cleanup, not bundled into a UI-token fix.

**Bugs found and fixed along the way:**
- See "What was found and fixed" above — all four items in
  `app/analytics/page.tsx` and both `+`-in-text occurrences were found
  during this audit, not previously tracked anywhere.

**Verification performed:**
- `python3 -m py_compile` on this script.
- Anchor drift guard: confirmed `app/analytics/page.tsx` on disk
  contains the exact pre-patch marker (`АналитикаPage` identifier)
  before allowing the full-file replacement; `lib/i18n/config.ts` and
  `components/settings/SourceCard.tsx` edits use uniqueness-checked
  `str_replace`-style anchors (each anchor confirmed to occur exactly
  once in the source snapshot before this script was written).
- Brace/paren balance check (`check_braces_balanced`) run against all
  three modified/replaced TS/TSX files.
- `--verify` re-reads all three files from disk after `--apply` and
  re-confirms: no leftover `+` inside `add_source` or the SourceCard
  manual-add label; `<Layout>` import and usage present in
  `app/analytics/page.tsx`; no Cyrillic identifiers in that file;
  no `bg-blue-`, `text-gray-`, or other raw Tailwind color utility
  remains in `app/analytics/page.tsx`.

**Next steps queued:**
- Phase 2: `app/competitors/page.tsx` → August tokens.
- Phase 3: `app/knowledge/page.tsx` → August tokens.
- Phase 4: 8 brand-tab components → August tokens, `GuidelineImportTab`
  first.
- After Phase 4: remove the now-dead `.aug-app-shell` legacy-Tailwind
  override block from `app/globals.css`.

<!-- GUI_AUDIT_PHASE2_20260901 -->

## GUI Audit and Modernization — Phase 2 (2026-09-01)

**Context:**
- Continuation of Priority #6 (see Phase 1, 2026-08-31). This phase
  covers `app/competitors/page.tsx`, flagged in the original audit as
  100% inline `v2-color-*` legacy styles with zero design-system
  classes.

**What was changed:**
- Every card surface (`CompetitorCard` root, the add-competitor form
  panel, the empty state) migrated from a raw `rounded-lg border` div
  with inline `borderColor`/`background` reading `--v2-color-*` to the
  `m3-card` class.
- Every button (archive/restore toggle, add source, add competitor,
  generate/refresh review, form submit buttons) migrated from raw
  `rounded`/`rounded-full` divs with inline `background`/`color` to
  `aug-button` with the appropriate `--primary`/`--secondary` modifier.
- Every form input/textarea/select migrated from `rounded-md px-3 py-1.5`
  with inline `background: var(--v2-color-surface-alt)` to the
  `aug-field` wrapper pattern (`<label className="aug-field"><input
  .../></label>`), matching the convention already used elsewhere in
  the codebase (e.g. the content-generation form).
- The "archived" status chip migrated from a raw span with inline
  background/color to `m3-chip`.
- Remaining text/status colors (`--v2-color-text-primary`,
  `--v2-color-text-secondary`, `--v2-color-brand-primary`,
  `--v2-color-surface-alt`, `--v2-color-success`, `--v2-color-warning`)
  replaced with their direct August equivalents (`--aug-ink`,
  `--aug-muted`, `--aug-accent`, `--aug-soft`, `--aug-success-fg`,
  `--aug-warning-fg`) rather than going through the `--v2-color-*`
  alias layer.
- Added a real inline SVG plus icon to the "add source" and "add
  competitor" buttons. Neither previously had an icon (the `+` lived
  only in the translation string, already fixed in Phase 1) — this adds
  a proper icon rather than just removing the stray character.

**Consciously not done in this phase:**
- Did not change any state, effect, or handler logic. This is a pure
  visual/structural migration; the only new symbol is
  `getSourceDotColor()`, a named-function refactor of what was
  previously an inline ternary picking the source-health dot color —
  same behavior, easier to read.
- Did not touch `lib/i18n/config.ts` translation strings beyond what
  Phase 1 already fixed — this page's remaining hardcoded Russian
  strings ("архив", "Вручную") are unchanged, consistent with the
  decision in Phase 1 to defer the broader `t()` coverage audit.
- Did not remove the `.aug-app-shell` legacy-Tailwind override block
  from `app/globals.css` yet — `app/knowledge/page.tsx` and the 8
  brand-tab components (Phases 3-4) still depend on it.

**Bugs found and fixed along the way:**
- None beyond what was already tracked in the Phase 1 audit for this
  file (inline `v2-color-*` throughout, no icon on either add button).

**Verification performed:**
- `python3 -m py_compile` on this script.
- Composite drift guard: 4 independent structural markers, each checked
  against its exact expected occurrence count in the pre-patch file,
  before allowing the full-file replacement (see DRIFT_MARKERS in this
  script).
- Logic fingerprint check: confirmed all 19 `useState` declarations, both
  `useCallback`/`useEffect` calls, and all 4 async handlers
  (`addSource`, `generateReview`, `toggleArchive`, `addCompetitor`) are
  present unchanged in the new file.
- Brace/paren/bracket balance check on the new file.
- `tsc --noEmit --strict` against the new file in an isolated sandbox
  with stub `@/components/Layout`, `@/lib/i18n/config`, and
  `@/lib/market-context` modules matching real export signatures — zero
  type errors. Confirmed the stub setup actually catches errors by
  deliberately breaking a type and re-running before restoring.
- Confirmed zero remaining `v2-color` references in the new file.

**Next steps queued:**
- Phase 3: `app/knowledge/page.tsx` → August tokens.
- Phase 4: 8 brand-tab components → August tokens, `GuidelineImportTab`
  first.
- After Phase 4: remove the now-dead `.aug-app-shell` legacy-Tailwind
  override block from `app/globals.css`.

<!-- GUI_AUDIT_PHASE3_20260901 -->

## GUI Audit and Modernization — Phase 3 (2026-09-01)

**Context:**
- Continuation of Priority #6 (see Phase 1, 2026-08-31; Phase 2,
  2026-09-01). This phase covers `app/knowledge/page.tsx`, flagged in
  the original audit as 100% inline `v2-color-*` legacy styles, plus
  one fully hardcoded off-token color pair.

**What was changed:**
- Same migration pattern as Phase 2: all three card sections (upload
  form, search panel, asset list) moved from `rounded-lg border` +
  inline `borderColor`/`background: v2-color-*` to `m3-card`; all
  buttons moved to `aug-button` with `--primary`/`--secondary`/
  `--danger` modifiers; all form fields moved to the `aug-field`
  wrapper pattern.
- The search-mode badge (`{searchMode === 'semantic' ? ... : ...}`)
  previously used `style={{ background: '#DBEAFE', color: '#1E40AF' }}`
  — a fully hardcoded hex pair bypassing the token system entirely, not
  even going through a `--v2-color-*` alias. This was the one item
  flagged in the original audit as a genuine off-token color, distinct
  from the rest of the file's (at least token-aliased) `v2-color-*`
  usage. Replaced with `m3-chip`, the existing accent-badge class
  already used for the equivalent "archived" chip fixed in Phase 2.
- `STATUS_COLORS` (the knowledge-asset processing-status badge colors)
  already read `var(--aug-*)` tokens directly — this was the one part of
  the file that was already August-native, unlike Phase 1's SourceCard
  `HEALTH_COLOR` which read raw Tailwind classes. Left unchanged.
- Result colors (search result cards, delete button, submit error text)
  moved from `--v2-color-border-default` / `--v2-color-surface-base` /
  `--v2-color-surface-muted` / `--v2-color-surface-alt` /
  `--v2-color-text-primary` / `--v2-color-text-secondary` /
  `--v2-color-danger` to their direct August equivalents (`--aug-border`,
  `--aug-canvas`, `--aug-soft`, `--aug-ink`, `--aug-muted`,
  `--aug-danger-fg`).

**Consciously not done in this phase:**
- Did not change any state, effect, or handler logic — pure
  visual/structural migration, verified via logic-fingerprint check
  (all 19 `useState`, the one `useRef`, the one `useEffect`, and all 8
  async/sync handlers present unchanged).
- Did not touch `lib/i18n/config.ts` beyond what Phase 1 already fixed.
  This page reads all its strings through `t()` already (unlike
  `app/analytics/page.tsx`, which had hardcoded pt-BR contamination) —
  no translation-layer changes were needed here.
- Did not remove the `.aug-app-shell` legacy-Tailwind override block
  from `app/globals.css` yet — the 8 brand-tab components (Phase 4)
  still depend on it.

**Bugs found and fixed along the way:**
- The hardcoded `#DBEAFE`/`#1E40AF` search-mode badge, flagged in the
  original Phase-1 audit pass, is now fixed in this phase (it belongs
  to `app/knowledge/page.tsx`, not to Phase 1's scope).

**Verification performed:**
- `python3 -m py_compile` on this script.
- Composite drift guard: 5 independent structural markers (including
  the hardcoded hex pair and the exact `STATUS_COLORS` lookup line),
  each checked against its exact expected occurrence count in the
  pre-patch file.
- Logic fingerprint check: confirmed all 19 `useState` declarations, the
  `useRef`, the `useEffect`, and all 8 handlers (`loadAssets`,
  `handleFileChange`, `handleSubmit`, `handleReindex`,
  `handleToggleActive`, `handleDelete`, `handleSearch`, `toggleExcluded`,
  `handleCopy`) are present unchanged in the new file.
- Brace/paren/bracket balance check on the new file.
- `tsc --noEmit --strict` against the new file in an isolated sandbox
  with stub `@/components/Layout`, `@/components/ui/AugustFeedback`,
  `@/lib/i18n/config`, and `@/lib/domain/knowledge` modules matching
  real export signatures — zero type errors. Ran together with the
  already-migrated Phase 1/2 pages in the same sandbox project to check
  for cross-file regressions — zero errors project-wide.
- Confirmed zero remaining `v2-color` references and zero remaining
  hardcoded off-token hex colors in the new file.

**Next steps queued:**
- Phase 4: 8 brand-tab components → August tokens, `GuidelineImportTab`
  first (Priority #2 pipeline).
- After Phase 4: remove the now-dead `.aug-app-shell` legacy-Tailwind
  override block from `app/globals.css`.
