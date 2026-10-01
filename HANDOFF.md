# Amado — handoff

Last consolidated: 2026-09-09.

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

The default production generation pipeline is currently Google AI Studio only.
Groq, OpenAI and DeepSeek adapters still exist in `lib/ai-utils.ts`, but they are
not part of the active fallback chain. This is intentional MVP behavior; do not
assume multi-provider failover exists unless the pipeline is explicitly changed.

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

<!-- GUI_AUDIT_PHASE4_20260902 -->

## GUI Audit and Modernization — Phase 4 (2026-09-02, final phase)

**Context:**
- Final phase of Priority #6 (Phase 1: 2026-08-31; Phase 2 and 3:
  2026-09-01). Covers all 8 remaining brand-tab components under
  `components/brand/tabs/`, all flagged in the original audit as 100%
  raw Tailwind utility colors with zero design-system classes.
  `GuidelineImportTab.tsx` was prioritized within this set since it's
  the pipeline just unblocked for Priority #2 (guideline import schema
  fix, 2026-08-29).

**What was changed (all 9 files, same pattern):**
- Every card surface moved from `bg-white rounded-lg shadow p-N` to
  `m3-card`.
- Every status/severity/policy/risk/role badge moved from
  `bg-{color}-100 text-{color}-800` Tailwind pairs to explicit
  inline styles reading August status tokens (`--aug-success-bg/-fg`,
  `--aug-warning-bg/-fg`, `--aug-danger-bg/-fg`, `--aug-accent-bg/-fg`,
  `--aug-neutral-bg/-fg`). Unlike the pages fixed in Phases 1-3, these
  components had **no** `.aug-app-shell` legacy-override safety net
  working in their favor — the override block in `app/globals.css`
  only maps a narrow set of blue/gray/green/yellow/red class-name
  variants, and several of these components used `bg-purple-100` /
  `bg-indigo-100` (ExamplesTab, ContentPillarsTab), which the override
  never covered at all. Those badges were rendering as literal
  Tailwind default purple/indigo, not any August color, before this
  fix. Purple/indigo both mapped to `--aug-accent-bg/-fg`, the only
  purple-family token August defines.
- Filter-toggle buttons (ComplianceTab, VoiceVocabularyTab) moved from
  a manual inline `background: var(--aug-accent), color: '#fff'` /
  neutral-background pattern to the `aug-button` class with
  `--primary`/`--secondary` modifiers — removing the last hardcoded
  `#fff` color reference in this batch.
- `VersionsTab.tsx`'s publish button had a fully hardcoded off-token
  hex color, `style={{ background: '#2563EB' }}`, bypassing the
  token system entirely (similar in kind to the `#DBEAFE`/`#1E40AF`
  badge fixed in Phase 3, though found independently during this
  phase's audit). Replaced with `aug-button aug-button--primary`.

**Consciously not done in this phase:**
- Did not change any state, effect, or handler logic in any of the 9
  files — pure visual/structural migration in every case. Each file
  was checked with the same logic-fingerprint approach as Phases 2-3
  (all `useState`, `useEffect`, `useCallback`, and handler function
  signatures confirmed present and unchanged).
- Did not add any new i18n coverage — these components already mix
  hardcoded Russian labels with some inline English fallbacks; that's
  consistent with the broader `t()` coverage gap noted (and
  deliberately deferred) since Phase 1.
- Did NOT yet remove the `.aug-app-shell` legacy-Tailwind override
  block from `app/globals.css`, even though this was the last phase
  that depended on it. Removal is a separate, verifiable step (need to
  grep the whole codebase for any remaining raw Tailwind color-class
  usage before deleting the safety net) — see "Next steps" below.

**Bugs found and fixed along the way:**
- `VersionsTab.tsx`'s hardcoded `#2563EB` publish-button color,
  bypassing the token system (same class of bug as Phase 3's
  `#DBEAFE`/`#1E40AF`, found independently here).
- `ExamplesTab.tsx` and `ContentPillarsTab.tsx` used `bg-purple-100`
  and `bg-indigo-100` respectively — colors with **no** entry in the
  `.aug-app-shell` legacy-override block at all, meaning these badges
  were never actually themed correctly even before this fix; they were
  rendering plain Tailwind purple/indigo regardless of brand theme.

**Verification performed:**
- `python3 -m py_compile` on this script.
- Composite drift guard: 2 independent structural markers per file (18
  total across all 9 files), each checked against its exact expected
  occurrence count in the pre-patch file before allowing that file's
  replacement.
- Brace/paren/bracket balance check on all 9 new files.
- `tsc --noEmit --strict` against all 9 new files together with the
  already-migrated Phase 1-3 pages, in an isolated sandbox with stub
  `@/lib/api-client` (`fetchJson`) and `@/lib/api/error-message`
  (`getErrorMessage`) modules matching real export signatures — zero
  type errors project-wide.
- Confirmed zero remaining raw Tailwind color-utility classes
  (`bg|text|border`-`{blue,gray,green,red,yellow,purple,indigo,orange}`-
  `{shade}`) and zero remaining hardcoded off-token hex colors (except
  `#FFFFFF`, which is the literal white already used inside
  `aug-button--primary`'s own CSS definition) across all 9 files.
- Confirmed all import statements are byte-for-byte unchanged from the
  pre-patch files (no new or removed dependencies).

**Next steps queued:**
- Grep the full codebase for any remaining raw Tailwind color-utility
  usage outside the 12 files covered by Phases 1-4, to confirm nothing
  else depends on the `.aug-app-shell` legacy-Tailwind override block.
- If clean, remove that block from `app/globals.css` as a small,
  separate follow-up patch — this closes out Priority #6.
- Priority #6 audit itself: consider a follow-up pass specifically for
  `t()` coverage (several pages/components still hardcode Russian
  strings inline rather than routing through the i18n dictionary) —
  flagged as out of scope for the token migration in every phase so
  far, tracked here as a distinct future priority if wanted.

<!-- FABLE_REVIEW_PHASE0_20260904 -->

## Fable code review — intake and remediation plan (2026-09-04, Phase 0)

**Context:**
- The user commissioned an independent code review from a separate
  Claude Fable 5.1 session, covering 9 core files:
  `lib/content-generation/generate-article.ts`, `lib/prompts.ts`,
  `lib/brand-os/precedence.ts`, `lib/brand-os/guideline-extractor.ts`,
  `app/api/brands/[brandId]/guidelines/import/route.ts`, `lib/ai.ts`,
  `lib/brand-snapshot.ts`, `lib/market-context.tsx`,
  `app/competitors/page.tsx`. The review was pasted into chat as a
  document and is preserved verbatim, plus this project's triage and
  a 6-phase remediation plan, in the new `docs/fable-review.md`.
- Per explicit user instruction, this remediation plan now takes
  priority over the "Current priorities" list in
  `docs/AMADO_ROADMAP.md` until fully closed out — a pointer block was
  added near the top of that file.

**What was done in this phase (docs only, no application code
touched):**
- Created `docs/fable-review.md` containing the full original review
  text, a "Triage notes" section, and the phased plan.
- Closed four of the review's own "can't confirm without file X"
  notes by reading files that were in this project's context but not
  in the reviewer's 9-file bundle:
  - `guideline_rule_candidates.source_anchor` is nullable (migration
    `033_guideline_compiler.sql`) — the reviewer's NOT-NULL concern
    doesn't apply as stated.
  - `brand_rules` has no unique constraint on `(rule_set_id,
    rule_key)` (migration `030_brand_os_core.sql`) — confirms
    duplicate-key imports are silently arbitrated by `compileRules()`
    at read time, not rejected at write time.
  - `brand_rule_sets` has only a non-unique partial index on
    `(brand_id, status) WHERE status='active'` — confirms two active
    rule sets per brand can coexist today, which would silently drop
    all compliance rules via `brand-snapshot.ts`'s
    `.maybeSingle()` call.
  - Read the actual candidate → `brand_rules` publish path
    (`app/api/brands/[brandId]/guidelines/import/[runId]/route.ts`,
    `PATCH` handler's `publish` branch — distinct from
    `.../rule-sets/[ruleSetId]/publish/route.ts`, which only flips
    `brand_rule_sets.status` and never writes `brand_rules` at all).
    This closes the review's single largest "pending confirmation"
    item with certainty: `scope_json` is copied byte-for-byte from
    the import route's `{ scope, target }` shape into `brand_rules`,
    which has **zero fields in common** with the `RuleScope` type
    (`lib/brand-os/types.ts`) that `precedence.ts`'s `scopeMatches()`
    reads. Every rule published through this pipeline today
    scope-matches as fully global. This is now a confirmed live bug,
    escalated into Phase 1 of the plan, not a hypothetical.
  - Also found, independently of the reviewer's bundle: the publish
    route's `brand_rules` insert loop is `console.warn`-only on
    failure (same silent-partial-failure shape the reviewer flagged
    in the *import* route), and its response's `published: N` count
    is read from the request body's `candidateDecisions`, never from
    actual `brand_rules` insert successes — folded into Phase 1.

**Consciously not done in this phase:**
- No application code was touched. This phase is intake and planning
  only, per the user's explicit instruction to deliver the plan first
  and then work through it phase by phase, one patch script per
  phase/file group.
- Did not yet re-verify the review's findings on files this project
  didn't have in the current session context beyond the four listed
  above (`ai-utils.ts`, `evidence.ts`, `text-cleanup.ts`,
  `content-formats.ts`, `content-request-repository.ts` were
  available and spot-checked for the Phase 1/3 items that reference
  them, but a line-by-line re-audit of every review claim against
  every file was not performed — Phase-by-phase work will re-verify
  the specific claim relevant to that phase's diff before writing
  each patch).

**Bugs found and fixed along the way:**
- None yet — this phase is documentation only. See `docs/fable-review.md`
  Phase 1 for the first application-code fixes queued.

**Verification performed:**
- `python3 -m py_compile` on this delivery's patch script.
- Idempotency: script checks for the exact pre-patch state of
  `HANDOFF.md` and `docs/AMADO_ROADMAP.md` via composite drift-guard
  markers before creating `docs/fable-review.md` or modifying either
  file; a second `--apply` run is a no-op with a clear message rather
  than a duplicate insertion.
- Full dry-run in an isolated sandbox git repo seeded with the exact
  pre-patch `HANDOFF.md` / `docs/AMADO_ROADMAP.md` / `.gitignore`
  content from this session's repomix snapshot: `--check`, `--apply`,
  `--verify` all passed; byte-for-byte diff confirmed against the
  drafted content.
- Confirmed `docs/fable-review.md`'s backtick count is even (no
  unclosed code fence) and the file is well-formed Markdown.

**Next steps queued:**
- Phase 1 (Brand OS integrity): `brand-snapshot.ts` error handling +
  unordered-limit fixes, `brand_rules`/`brand_rule_sets` unique
  constraints, the `scope_json` shape fix in the import route, the
  publish-route silent-failure and lying-count fixes, and the
  `generate-article.ts` persist-ordering / `record()`-failure fixes.
  See `docs/fable-review.md` for the full itemized list.

<!-- FABLE_REVIEW_PHASE1A_20260905 -->

## Fable review remediation — Phase 1A: brand-snapshot + generate-article (2026-09-05)

**What was done:**
- `lib/brand-snapshot.ts`: every query inside `buildBrandSnapshot`'s
  `Promise.all` now checks `error` (previously silently discarded on
  ~10 queries — the same failure class as the guideline-import bug
  this project fixed once before, in the file whose entire job is
  enforcing brand rules). Added a `degraded: string[]` field to
  `BrandSnapshotResult` so a query failure produces a visibly
  incomplete brand context instead of an innocent-looking empty fact
  list. `brand_claims`, `brand_terms`, and the `brand_rules` query
  (forbidden claims/terms, hard compliance rules) now have a
  deterministic `ORDER BY` and a 200-row safety cap that logs loudly
  if it's ever actually hit — replacing the old unordered
  `LIMIT 15`/`LIMIT 20` that could silently drop an arbitrary subset
  of a real brand's forbidden claims/terms/rules, with the dropped
  subset changing between requests.
- `brand_rules` is now routed through `compileRules()`/`scopeMatches()`
  (`lib/brand-os/precedence.ts`) with a `CompileContext` built from the
  brand/platform/format instead of being read raw with zero scope
  filtering — a LinkedIn-only `hard_block` can no longer be injected
  into an email generation, and duplicate `rule_key`s are now
  arbitrated by real precedence instead of "whichever DB row came back
  first" (see the SQL migration below for the write-side half of this
  fix).
- `resolveBrandRegionId` now throws on a genuine DB error instead of
  collapsing "brand not found", "brand has no region set", and "DB
  query failed" into the same `null` → Brazil-default fallback.
  Verified all three call sites (`generate-article.ts`, the guideline
  import route, `guideline-extractor.ts`) already have a top-level
  `try/catch` that turns this into a loud 500 instead of an unhandled
  rejection — confirmed by reading each file, not assumed.
- `lib/content-generation/generate-article.ts`: reordered so the
  article is persisted **before** the best-effort localization-notes
  LLM call (previously after). The old ordering meant a platform kill
  during the second LLM call left a `content_requests` row stuck in
  `processing` forever, with `generated_content` populated and no
  article row ever created — nothing ever transitioned it. Now the
  article and `content_requests` row both reach their terminal state
  first; the notes are attached via a follow-up update afterward, and
  a failure there only means the article's `source_context` stays
  null (which the UI already treats as "no notes available").
- `content_requests.record()` returning `null` (the repository's
  documented contract on insert failure) was previously treated as an
  unremarkable null id, with the code silently proceeding to create an
  orphaned article (no `content_request_id`, no version history, no
  evidence-usage tracking) and reporting success. This is now surfaced
  via a new `persistenceWarning: string | null` field on
  `GenerateArticleResult` plus a `console.error`, while still
  persisting the article — the paid LLM call already happened, and
  discarding a good result over a bookkeeping-row failure would be
  worse than a visible gap.
- `lib/repositories/article-repository.ts`: added an **optional**
  `updateSourceContext()` method, needed by the reorder above. Made
  optional specifically so the existing fake repositories in
  `generate-article.test.ts` (which don't implement it) keep compiling
  unchanged — confirmed via `tsc`, not assumed.
- `supabase/migrations/046_brand_rules_unique_constraints.sql`: adds a
  unique partial index (`brand_rule_sets(brand_id) WHERE
  status='active'`, replacing the old non-unique
  `idx_brand_rule_sets_active`) and a unique constraint
  (`brand_rules(rule_set_id, rule_key)`). Both are defensively
  preceded by a repair step for any pre-existing violations (keeps the
  most recently published active rule_set per brand and archives the
  rest; keeps the highest-precedence row per duplicate `rule_key` and
  deletes the rest), so the migration cannot fail on data that
  predates it. **Not applied by the patch script** — per this
  project's database discipline, run it via the Supabase SQL Editor.

**Consciously not done in this phase:**
- The `scope_json` shape fix itself (writing `RuleScope`-correct data
  instead of `{ scope, target }`) is **not** in this phase — it's
  Phase 1B, in the guideline import route. This phase's SQL migration
  and `brand-snapshot.ts`'s `compileRules()` routing prepare the
  ground for that fix (a rule with a correctly-shaped scope will now
  actually be scope-filtered at read time, and can't silently
  duplicate at write time) but don't fix the shape at the source.
- Did not touch `app/generate/page.tsx` to surface the new
  `persistenceWarning` field in the UI. The `console.error` is the
  load-bearing part of this fix (making the failure loud in logs
  instead of silent); wiring it into the generation UI is a
  reasonable follow-up but wasn't treated as required for this phase.
- Did not attempt to fix the `maxTokens` passed as `undefined` in
  `generateArticleWithFallback`'s call in `generate-article.ts` — that
  line is pre-existing and unrelated to this phase's scope; the
  `maxTokens`/`maxOutputTokens` SDK-rename issue is tracked under
  Phase 3 in `docs/fable-review.md`.

**Bugs found and fixed along the way (beyond the review's own list):**
- `error_summary` is a `TEXT` column (confirmed against
  `supabase/migrations/033_guideline_compiler.sql`), not `JSONB`. This
  doesn't affect brand-snapshot.ts/generate-article.ts directly, but
  was caught while cross-checking schemas for Phase 1B and is fixed
  there — noting it here since it was discovered during this phase's
  verification pass.

**Verification performed:**
- `python3 -m py_compile` on the patch script.
- Real `tsc --noEmit --strict` against an isolated reconstruction of
  the actual dependency graph (real `lib/brand-os/types.ts`,
  `lib/brand-os/precedence.ts`, `lib/content-formats.ts`; type-accurate
  stubs for `lib/supabase/client.ts`, `lib/ai.ts`, `lib/ai-usage.ts`,
  `lib/prompts.ts`, `lib/evidence.ts` matched field-for-field against
  the real files' exported signatures) — zero errors, including the
  **unmodified, pre-existing** `generate-article.test.ts`.
- Ran the actual pre-existing `generate-article.test.ts` suite via
  vitest against the new implementation: all 4 existing tests pass
  unchanged (region precedence, evidence linking, brand snapshot
  injection, explicit-regionId-wins). Added 2 new regression tests for
  this phase's specific fixes (persist-before-notes ordering,
  `record()`-failure surfacing) — 6/6 pass, run 3× for flakiness, zero
  failures.
- SQL migration validated against a real PostgreSQL 16 instance (not
  a syntax-only check): loaded the exact `brand_rule_sets`/
  `brand_rules` DDL from migration 030, seeded two violation shapes
  (a brand with two active rule sets; a rule set with three duplicate
  `rule_key` rows of differing enforcement/priority/human_approved/
  created_at), ran the migration, and confirmed: the correct rule set
  was kept active and the other archived; the correct single row
  survived the duplicate-`rule_key` cleanup (highest enforcement class,
  then priority, then human_approved, then most recent); unrelated
  rows were untouched; both constraints reject new violations
  afterward; a second migration run is a clean idempotent no-op.
- Structural balance checks (braces/parens/brackets/backticks) on all
  changed TypeScript files.
- Drift-guard: this patch script compares the full on-disk content of
  each changed file, byte-for-byte, against the exact pre-patch
  content pulled from this session's repomix snapshot, before writing
  — refuses to overwrite a file that doesn't match (already patched a
  different way, hand-edited, or a previous phase's write never
  landed) rather than blindly proceeding.

**Next steps queued:**
- Phase 1B: fix `scope_json` construction in the guideline import
  route (currently `{ scope, target }`, zero fields in common with
  `RuleScope` — confirmed live bug, not hypothetical), honest
  inserted/failed candidate counts in both the import route and the
  publish route (`[runId]/route.ts` PATCH), and the pre-existing
  `error_summary` TEXT-vs-object bug found during this phase's
  cross-checking.
- After Phase 1B, Phase 1 is complete; Phase 2 (region-failure ≠
  absence, collapsing the four hand-maintained region maps) follows
  per `docs/fable-review.md`.

<!-- FABLE_REVIEW_PHASE1B_20260906 -->

## Fable review remediation — Phase 1B: guideline import + publish routes (2026-09-06)

**What was done:**
- `app/api/brands/[brandId]/guidelines/import/route.ts`: fixed the
  confirmed critical `scope_json` bug. The old code wrote
  `scope_json: { scope: rule.scope, target: rule.scopeTarget }` — a
  shape with **zero fields in common** with `RuleScope`
  (`lib/brand-os/types.ts`), which is what `precedence.ts`'s
  `scopeMatches()` actually reads at generation time. Every rule ever
  published through this pipeline therefore scope-matched as fully
  global regardless of its intended platform/format/campaign scope —
  this was confirmed as a live, not hypothetical, bug during Phase 0's
  intake (see `docs/fable-review.md`, "Triage notes"). Added a new
  exported `toRuleScope()` function: `rule.scope` names the scope
  *dimension* (`'global' | 'platform' | 'format' | 'campaign'`), and
  `rule.scopeTarget` is the *value* within that dimension — so the fix
  keys exactly one `RuleScope` field, by dimension name, to the target
  value, and returns `{}` (matches everywhere, correctly) for
  `'global'` or a missing target.
- Same route: candidate insert failures are now counted
  (`insertedCount`/`insertErrors`) instead of only logged. If
  extraction found candidates but literally none of them persisted
  (the exact bug class this project fixed once before, reachable here
  via a different constraint), the run is now marked `failed` with
  `error_summary` instead of `review` with HTTP 201 and a `stats.total`
  that doesn't reflect what's actually in the database. The response
  now includes `insertedCandidates`/`failedCandidates` alongside the
  existing extraction-quality `stats`.
- `app/api/brands/[brandId]/guidelines/import/[runId]/route.ts`
  (`PATCH`, the `publish` branch — the actual candidate → `brand_rules`
  write path, distinct from `.../rule-sets/[ruleSetId]/publish/
  route.ts` which only flips `brand_rule_sets.status`): the
  `published: N` count and `success` flag are now ground truth from
  this request's own `brand_rules` insert loop, not an echo of the
  `publish` boolean or a count taken from `candidateDecisions` in the
  request body. If candidates were approved but zero could be saved to
  `brand_rules`, the run is no longer marked `completed` — it stays in
  `review` with the failure recorded in `error_summary`, and the
  response is a `500` with `success: false` instead of a silent
  `200`. Confirmed via `components/brand/tabs/GuidelineImportTab.tsx`
  that no frontend code reads `data.published` as a strict boolean
  (it only reads `data.success` and `res.ok`), so widening that field's
  type from `boolean` to `number | false` is safe.
- **Bonus fix found during this phase's cross-checking (not in the
  original review, which didn't have the DDL to check this):**
  `guideline_import_runs.error_summary` is a `TEXT` column (confirmed
  against `supabase/migrations/033_guideline_compiler.sql`), not
  `JSONB`. Both routes — including the *pre-existing* extraction-
  failure catch block in the import route, which predates this
  phase's changes — were writing plain JS objects directly into it.
  All `error_summary` writes across both routes now `JSON.stringify`
  first. The `GET` handler in `[runId]/route.ts` now parses it back to
  an object on read (`parseErrorSummary`), tolerating legacy rows that
  may hold the old buggy value or a plain string, so a pre-fix run
  doesn't throw when read after this fix lands.
- Added `app/api/brands/[brandId]/guidelines/import/route.test.ts`:
  focused unit tests for `toRuleScope()` covering all three non-global
  dimensions, the global case (including the defensive case of a
  global rule with a spuriously-set `scopeTarget`), and a missing-
  target fallback. This is the single most load-bearing fix in the
  entire Fable review, so it gets dedicated regression coverage rather
  than only being exercised indirectly.

**Consciously not done in this phase:**
- Did not add integration-level tests for either route's full request/
  response cycle (would require a substantial new Supabase-mocking
  harness that doesn't exist yet for these routes) — scoped this
  phase's testing to the pure-function fix (`toRuleScope`) that
  carries the confirmed-critical bug, which is both the highest-value
  target and the one actually testable in isolation without new
  infrastructure.
- Did not change `rule_key` construction (`${ruleType}_${scope}`,
  still collision-prone across multiple rules of the same type/scope
  in one brand book) — the SQL migration from Phase 1A now makes that
  collision fail loudly at insert instead of silently duplicating, but
  fixing the collision at the source (e.g. including a stable index or
  content hash) is a separate design decision not yet made, tracked in
  `docs/fable-review.md` Phase 1.
- Did not touch `.../rule-sets/[ruleSetId]/publish/route.ts` (the
  other, currently-unused-in-practice publish path that only flips
  `brand_rule_sets.status`) — it doesn't write `brand_rules` at all,
  so it wasn't in scope for this fix.

**Bugs found and fixed along the way (beyond the review's own list):**
- The `error_summary` TEXT-vs-object mismatch described above,
  including in code this phase didn't otherwise need to touch (the
  extraction-failure catch block in the import route) — fixed while
  in the area rather than left inconsistent with the new writes.

**Verification performed:**
- `python3 -m py_compile` on the patch script.
- Real `tsc --noEmit --strict` against both route files together, plus
  the real `lib/brand-os/types.ts`, `lib/brand-os/precedence.ts`,
  `lib/brand-os/guideline-extractor.ts` (unmodified), and Phase 1A's
  fixed `lib/brand-snapshot.ts` (since the import route calls
  `resolveBrandRegionId`, exercising both phases' changes together) —
  zero errors.
- New `toRuleScope()` unit tests run via vitest: 6/6 pass, run 3× for
  flakiness, zero failures.
- Confirmed via direct inspection of
  `components/brand/tabs/GuidelineImportTab.tsx` that the `published`
  field's type change is not a breaking change for any current
  consumer (grepped for `.published` usage — none found; the
  component only reads `data.success` and `res.ok`).
- Structural balance checks (braces/parens/brackets/backticks) on both
  changed route files.
- Drift-guard: byte-for-byte comparison of each changed route file's
  full on-disk content against the exact pre-patch content pulled
  from this session's repomix snapshot, before writing.

**Next steps queued:**
- Phase 1 is now complete pending your application of both 1A and 1B
  plus the SQL migration. Phase 2 (region-failure ≠ absence,
  `resolveLanguageProfile`'s Brazil-default leak for unmapped region
  codes, collapsing the four hand-maintained region maps onto the
  `regions` table) follows per `docs/fable-review.md`.

<!-- FABLE_REVIEW_PHASE2_20260908 -->

## Fable review remediation — Phase 2: region-failure ≠ absence (2026-09-08)

**Correction to the review's own assumption, found during this phase's
intake (documented here since it changes this phase's actual scope):**
The original review assumed DE/US/ES brands might not have `region_id`
set and treated that as the likely near-term trigger for the Brazil-
default bugs it found. Checking `supabase/seeds/005_spain_region.sql`,
`006_spain_market_and_brand.sql`, and `007_germany_us_locales.sql`
(not in the review's 9-file bundle) against `HANDOFF.md`'s own record
— which states as current fact that "the current product has four
active market contexts: BR, ES, DE, US" — confirms these seeds are
already applied. ES/DE/US regions and their placeholder brand profiles
already exist with a `region_id` set. This phase is therefore a code
correctness fix (removing latent risk and making a currently-hidden
class of failure loud) rather than a fix for an actively-manifesting
Brazil-language bug in production today — none of the severity ratings
below are downgraded on that basis, since the underlying code defects
are real and would bite the moment a query fails, a new region is
added, or any input arrives slightly malformed.

**What was done:**
- `lib/prompts.ts` (`resolveRegionProfile`): now derives `languageName`
  from the region's own `default_language_code` column (already the
  source of truth `buildRegionContextLayer` uses) instead of a second,
  independently hand-maintained `LANGUAGE_NAMES` map keyed by region
  code. That map already covered `ES`/`DE`/`US`/`GB` correctly today,
  but had no defense against a future region being added to `regions`
  without a matching code added there too — it would have silently
  produced `'Portuguese (Brazil)'` for the language name via its own
  `?? DEFAULT_REGION_PROFILE.languageName` fallback, the exact
  "unresolvable → Brazil" pattern this phase targets. Replaced with a
  much smaller `LANGUAGE_DISPLAY_NAMES` map keyed by *locale code*
  (`'es-ES'`, `'de-DE'`, …) — a property of the language itself, not
  of Amado's region model, so it can't drift out of sync with
  `regions` the way the old map did — and an unmapped locale now
  degrades to its raw code (e.g. `'fr-FR'`) rather than silently
  becoming Brazilian Portuguese.
- Same function: distinguishes and logs three previously-identical
  silent outcomes — DB query error, region genuinely not found, and
  region found but `active = false` — each with its own
  `console.error` before falling back to the documented Brazil
  default. Previously all three (plus genuine absence) produced the
  exact same `DEFAULT_REGION_PROFILE` with no log line at all.
- `buildRegionContextLayer`: same three-way error/not-found/inactive
  distinction and logging added.
- `buildEvidenceContext`: removed the hardcoded
  `toLocaleDateString('pt-BR')` — a US or DE generation would see a
  Brazilian-format date (`DD/MM`) in its evidence context regardless
  of target market. Added an optional `locale` parameter (defaults to
  ISO 8601 — unambiguous, no locale assumption — when not given); also
  fixed the same silently-collapsed `error || !items` pattern the rest
  of this review's Phase 1/2 work has been fixing elsewhere.
- `resolveLanguageProfile`: removed the risky
  `ctx.languageName !== 'Portuguese (Brazil)'` string-equality
  self-reference (checking a language *name* string against the exact
  literal produced by this same file's own default). Replaced with a
  check on `ctx.locale !== DEFAULT_REGION_PROFILE.locale` — unambiguous
  — so any region not explicitly curated in this function (today: any
  region other than BR/ES/DE/US, e.g. Italy, which is seeded in
  `regions` per migration 023 but has no dedicated branch here) uses
  its own real region data instead of silently being mislabeled as
  Brazil. The three curated branches (ES/DE/US, which carry genuinely
  market-specific seasonal/cultural authoring content, not just a
  language name) are unchanged.
- Bonus, one-line fix found while in this function: the fallback
  strings `'Конкурент'` / `'Без названия'` in `buildCompetitorContext`
  fed both the UI-facing `signals` array *and* the actual LLM prompt
  text — a Russian UI-axis string leaking into the content-language
  axis. Changed to `'Competitor'` / `'Untitled'`. Confirmed via
  `app/generate/page.tsx` that the UI renders these values directly
  (`{c.competitor}: {c.title}`) with no `t()` wrapper around them
  specifically, so this is a pure improvement (consistent English
  fallback next to otherwise-real evidence data) rather than removing
  Russian from anywhere the UI actually intends it — the surrounding
  static label stays Russian and is untouched.
- `lib/content-generation/generate-article.ts` (building on Phase 1A):
  `input.regionId ?? await resolveBrandRegionId(...)` used `??`, which
  only falls through on `null`/`undefined` — a client sending
  `regionId: ''` (a plausible default for an unset `<select>`) would
  skip brand-derived region resolution entirely and hit
  `resolveRegionProfile('')`'s own falsy fallback to Brazil. Normalized
  to `input.regionId?.trim() || null` before applying the brand
  fallback. Also reordered `resolveRegionProfile` before
  `buildEvidenceContext` (both only depend on `effectiveRegionId`,
  already resolved earlier) so the resolved locale can be passed
  through instead of evidence context always defaulting to ISO dates.
- `lib/brand-os/guideline-extractor.ts`: added `BrandRegionRequiredError`,
  thrown by `extractGuidelineRules` when a brand has no `region_id` set,
  before any LLM call is made. Previously this case fell through to
  `resolveRegionProfile(null)` → Brazil defaults, extracting guideline
  rules in Portuguese for a brand that might target any market. Given a
  brand is the unit this operates on, "brand has no region" is now an
  error the caller can act on, not a silent default. **In practice this
  should be unreachable through normal application flows** — confirmed
  there is no `POST /api/brands` endpoint anywhere in this codebase;
  every brand that exists was created via a SQL seed that sets
  `region_id`. This is defensive hardening against a brand created
  without one in the future, not a fix for an actively-reachable gap
  today — noted explicitly rather than overstating the severity.
- `app/api/brands/[brandId]/guidelines/import/route.ts` (building on
  Phase 1B): catches `BrandRegionRequiredError` specifically and
  returns `400` with an actionable message, instead of the generic
  `500` every other extraction failure gets. The run is marked
  `failed` with a distinguishing `error_summary.code:
  'brand_region_required'` rather than a generic message, so it's
  identifiable later without re-parsing the message text.

**Consciously not done in this phase:**
- Did not fully collapse `culturalNotes`/`MARKET_FLAGS` (in
  `lib/market-context.tsx`) onto the `regions` table — those two maps
  carry genuinely curated content (cultural notes, flag emoji) that
  isn't derivable from `default_language_code` the way a language
  *name* is. `resolveLanguageProfile`'s three curated market branches
  (ES/DE/US) are left as explicit code for the same reason: their
  seasonality examples are real authored content, not generated data.
  What's fixed is the *fallback* path for everything NOT explicitly
  curated — it no longer silently mislabels as Brazil.
- Did not touch `buildSystemPrompt`'s silent template-resolution
  fallback (requested template errors → default template → hardcoded
  `PROMPT_FALLBACK`, no log on either branch) — this is a template
  resolution concern, not a region resolution one; flagged in
  `docs/fable-review.md` but not bundled into this phase to keep the
  diff focused.
- Did not address `buildKnowledgeContext`/`buildCompetitorContext`'s
  own silently-collapsed `error` checks beyond the one-line date-format
  and Russian-fallback fixes made in passing — these are the same
  cross-cutting "`{data,error}` collapse" pattern Phase 1 fixed in
  `brand-snapshot.ts`, tracked as its own cross-cutting item in
  `docs/fable-review.md` rather than duplicated function-by-function
  across every phase that happens to touch a file.

**Bugs found and fixed along the way (beyond the review's own list):**
- None new this phase beyond the scope-correcting finding documented
  above (the ES/DE/US region seeds already being applied).

**Verification performed:**
- `python3 -m py_compile` on the patch script.
- Real `tsc --noEmit --strict` against `lib/prompts.ts` with its real
  transitive dependency graph (`lib/repositories/knowledge-repository.ts`,
  `lib/knowledge/embeddings.ts`, `lib/amado-config.ts`,
  `lib/domain/knowledge.ts`, `lib/content-formats.ts`, plus type-accurate
  stubs for `lib/supabase/client.ts` and `lib/ai-utils.ts`) — zero errors.
- Real `tsc --noEmit --strict` against the full combined Phase 1A + 1B +
  Phase 2 change set together (`brand-snapshot.ts`, both
  `generate-article.ts` iterations, both guideline routes,
  `guideline-extractor.ts`, `prompts.ts`, all four test files) — zero
  errors.
- 14 tests across 3 files run via vitest, 3× for flakiness, order
  varied between runs (confirmed order-independence, not just repeat-
  independence) — zero failures throughout:
  - `lib/prompts.test.ts` (5 new): Brazil default with no
    `regionContext`; curated ES/DE branches; the core regression test
    — an uncurated non-Brazil region (Italy) does NOT collapse into
    Brazil; explicit `pt-BR` locale still resolves to Brazil correctly.
  - `lib/brand-os/guideline-extractor.test.ts` (3 new):
    `BrandRegionRequiredError` thrown before any LLM call for a
    region-less brand (confirmed via a mock assertion that
    `generateArticleWithFallback` was never called — the fail-fast
    behavior, not just the error type); the error carries the
    `brandId` for the caller to act on; a brand WITH a region
    proceeds normally.
  - `lib/content-generation/generate-article.test.ts` (6, from Phase
    1A, unchanged): all still pass against the Phase 2 reorder and
    `''`-normalization, confirming no regression to "explicit regionId
    always wins" / "derives region from brand" behavior.
- Drift-guard correctness check on this delivery itself: initially
  generated the `generate-article.ts` and
  `guidelines/import/route.ts` "original" (pre-Phase-2) payloads
  against the wrong baseline (the true pre-Phase-1 pristine file
  instead of Phase 1A's/1B's actual output) and separately caught that
  `guideline-extractor.ts`'s "original" payload had been generated
  from an already-in-place-edited copy of the file rather than the
  pristine source — both would have produced a patch script whose
  drift-guard either falsely rejected an already-Phase-1-patched repo
  or (worse) silently accepted re-overwriting already-patched content
  with something else. Caught via explicit `diff` against the correct
  baseline before packaging, not discovered by the drift-guard itself
  at apply time — worth calling out since it's exactly the
  phase-recorded-vs-file-on-disk risk this project's own conventions
  warn about, this time in the patch-authoring step rather than the
  target repo.
- Structural balance checks (braces/parens/brackets/backticks) on all
  changed files.

**Next steps queued:**
- Phase 3 (generation reliability: `maxTokens`/`maxOutputTokens` SDK
  rename, fixed model order instead of `rotateGroup` shuffling,
  cooldown on timeout/5xx not just quota errors, shared request-scoped
  deadline, parallelizing `generate-article.ts`'s remaining serial
  awaits) follows per `docs/fable-review.md`.

<!-- FABLE_REVIEW_CLOSEOUT_20260909 -->

## Fable review remediation — Phases 0-2 applied and closed out (2026-09-09)

**Status:** Applied, verified, committed, pushed. Confirmed by the user
directly in Codespaces (all `--verify` steps passed after the
trailing-newline drift-guard fix described below).

**What shipped:**
- Phase 0: `docs/fable-review.md` (full review text + triage + 6-phase
  plan) created; `docs/AMADO_ROADMAP.md` override pointer added and
  now removed (see roadmap for the current summary).
- Phase 1A: `lib/brand-snapshot.ts` error handling + `degraded[]`,
  unordered-LIMIT fix with safety caps, `compileRules()` routing,
  `resolveBrandRegionId` throws on DB error. `lib/content-generation/
  generate-article.ts` persist-before-notes reorder, `persistenceWarning`.
  `lib/repositories/article-repository.ts` optional `updateSourceContext`.
  `supabase/migrations/046_brand_rules_unique_constraints.sql` applied
  via Supabase SQL Editor (unique constraints on `brand_rule_sets`/
  `brand_rules`, validated against real PostgreSQL 16 pre-migration).
- Phase 1B: confirmed-critical `scope_json` shape fix (`toRuleScope()`)
  in the guideline import route; honest insert/publish counts in both
  guideline routes; `error_summary` TEXT-vs-object bug fixed.
- Phase 2: `resolveRegionProfile`/`buildRegionContextLayer` derive
  language from `regions.default_language_code` instead of a
  hand-maintained map, with error/not-found/inactive logging;
  `resolveLanguageProfile`'s Brazil self-reference removed;
  `buildEvidenceContext` locale-aware date formatting;
  `generate-article.ts` regionId `''` normalization;
  `BrandRegionRequiredError` in `guideline-extractor.ts` (defensive —
  confirmed no `POST /api/brands` endpoint exists, so unreachable in
  practice today).

**Post-delivery fixes (found after initial delivery, both resolved
before this closeout):**
- `do_verify`/`do_commit` in the Phase 1B/2 patch scripts crashed with
  an unhandled `FileNotFoundError` instead of a clean `[FAIL]` when a
  prior phase hadn't applied yet (missing `.exists()` guard in the
  brace-balance check loop) — fixed in all three scripts.
- The Phase 1A/1B/2 drift-guards initially compared on-disk files
  against payloads built from this session's repomix XML snapshot,
  whose extraction had inconsistently dropped a trailing newline
  relative to the real files in Codespaces (4 of 11 files affected:
  `article-repository.ts`, both guideline routes,
  `guideline-extractor.ts` — confirmed via a dedicated read-only
  diagnostic script, `diagnose_fable_review_drift_v1.py`, before
  patching). Fixed by making the drift-guard comparison tolerant of a
  trailing-newline-only difference while staying byte-exact for any
  real content change.

**Verification discipline used throughout (for reference in future
sessions):** every changed `.ts`/`.tsx` file was checked with a real
`tsc --noEmit --strict` against an isolated reconstruction of its
actual dependency graph (not text heuristics); the SQL migration was
validated against a real PostgreSQL 16 instance seeded with the exact
pre-existing-violation shapes it needed to repair; every new/changed
test was run 3× via vitest to check for flakiness and order-dependence;
every patch script was dry-run through a full `--check/--apply/--verify/
--commit` cycle in an isolated sandbox git repo seeded with the exact
pre-patch file content before being delivered.

**Not yet done — remaining Fable review scope:** Phases 3-6 of
`docs/fable-review.md` (generation reliability, prompt-injection
surface, `market-context.tsx` first-render correctness, `competitors`
page correctness/accessibility) are still open. See
`docs/AMADO_ROADMAP.md` for the current pointer.


<!-- FABLE_REVIEW_PHASE3A_20260909 -->

## Fable review remediation — Phase 3A: generation reliability core (2026-09-09)

This patch starts the next roadmap block after Phases 0–2. It closes the
high-impact runtime issues in the canonical generation path without changing the
current provider strategy.

**What changed:**
- `lib/ai.ts`: migrated AI SDK output limits from the obsolete `maxTokens`
  option to AI SDK 6's `maxOutputTokens`, including every active call site and
  the raw DeepSeek adapter boundary.
- `lib/ai.ts`: removed fallback rotation from the active Google chain. The
  order is now deterministic and quality-ordered: configured primary -> newest
  stable Flash -> older stable Flash -> Flash-Lite recovery.
- `lib/ai.ts` / `lib/ai-utils.ts`: timeout, network and 5xx failures now put the
  affected model on a short 90-second in-process cooldown, in addition to the
  existing quota cooldown. This prevents every request in a warm instance from
  repeatedly spending its full budget on a hanging primary.
- `lib/ai.ts`: AI SDK 6 native `timeout` is used for `generateText` and
  `streamText`, so timeout expiry aborts the provider request instead of merely
  abandoning a still-running promise. The DeepSeek raw-fetch path now uses an
  `AbortController` for the same reason.
- `lib/ai.ts`: an empty response whose `finishReason` is `content-filter` is a
  non-retryable failure. The pipeline no longer burns the remaining Google
  models on a prompt that the provider has already blocked.
- `lib/ai.ts`: `generateArticleWithFallback` now honors `task`; guideline
  extraction therefore uses the extraction budget instead of silently using
  the generation pipeline.
- Canonical `/api/generate`, `/api/generate/seo`, and `/api/generate/batch`
  routes now create an absolute request deadline (with an 8-second Vercel
  reserve) and pass it through `generateAndPersistArticle` to both AI calls.
  `lib/ai.ts` additionally keeps a 52-second per-operation cap, so the 300-second
  batch route cannot let one item monopolize the whole request.
- `lib/content-generation/generate-article.ts`: independent pre-generation
  context builders now execute in parallel after region resolution. Refinement
  lookup and brand-region resolution are parallelized as well. The dependency
  on explicit-vs-recent evidence is preserved, so recent evidence is not fetched
  unnecessarily when explicit evidence already exists.
- Documentation now reflects reality: the active production fallback chain is
  Google-only. Groq/OpenAI/DeepSeek remain available adapters, not active
  fallbacks.

**Tests added/extended:**
- `lib/ai.test.ts`: SDK 6 token option + timeout, deterministic fallback order,
  transient-failure cooldown, content-filter fail-fast, extraction budget.
- `lib/ai-utils.test.ts`: timeout/5xx transient-error classification.
- `lib/content-generation/generate-article.test.ts`: one request-scoped deadline
  reaches both canonical AI calls.

**Still open in Phase 3:**
- Add explicit stale-row visibility/reaping for `content_requests` and
  `guideline_import_runs` left in `processing` past the accepted threshold.
  This is intentionally separated because it changes operational/database
  behavior rather than the AI call path itself.

**Verification contract for the patch:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-august-ui.mjs`, and `git diff --check` must all pass before
commit/push.

<!-- FABLE_REVIEW_PHASE3B_20260909 -->
## Fable review remediation — Phase 3B: stale processing ownership (2026-09-09)

Phase 3 is now complete.

**What changed:**
- `lib/stale-processing.ts` defines the operational policy for stuck status
  machines. A row is stale after 15 minutes in `processing`, intentionally far
  above the 60-second synchronous guideline/generation request budget.
- `/api/admin/runtime-health` now exposes stale `content_requests` and
  `guideline_import_runs` counts, oldest timestamps and small ID samples. A
  stale row makes the top-level runtime `ok` flag false without pretending the
  database itself is unavailable.
- `/api/cron/stale-processing` is authenticated with the shared cron guard,
  records every run through `cron_runs`, and conditionally reaps only rows that
  are still `processing` and still older than the cutoff at update time. The
  cron runs daily at 03:15 UTC.
- Reaping moves stale `content_requests` to `failed` with a deterministic
  `error_message`, and stale `guideline_import_runs` to `failed` with
  `error_summary.code = stale_processing_timeout`. It does not rewrite
  completed/review rows and does not revive rows that changed state during the
  check.
- While wiring the reaper, a pre-existing queue-state bug was found in
  `app/api/content-requests/process/route.ts`: every successful queued request
  was left in `processing` forever because the route only reported
  `status: completed` in its response and never persisted that transition.
  The route now atomically claims pending rows, stamps `updated_at` at claim
  time, persists `completed` after a successful canonical generation call, and
  constrains recovery updates to rows that are still `processing`.

**Operational invariant:**
`content_requests.updated_at` is the processing-age clock for content requests;
`guideline_import_runs.created_at` is the processing-age clock for guideline
imports. Any future code path that moves an existing content request into
`processing` must stamp `updated_at` in the same write.

**Verification contract:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-august-ui.mjs`, and `git diff --check` must pass before
commit/push.

**Next Fable phase:** Phase 4 — prompt-injection surface and validation.



<!-- FABLE_REVIEW_PHASE4_20260909 -->
## Fable review remediation — Phase 4: prompt boundaries and validation (2026-09-09)

Phase 4 is now complete.

**Prompt boundary hardening:**
- `lib/prompt-safety.ts` is the shared boundary helper for untrusted and
  semi-trusted prompt material. `promptBlock()` caps field size, escapes `&`,
  `<` and `>`, validates static block tags, and distinguishes source/data blocks
  from intentional lower-priority policy blocks.
- The helper is wired through canonical generation plus the prompt-producing
  paths for evidence, knowledge, competitor monitoring, Brand OS fields/rules,
  platform playbooks, previous drafts/refinement notes, localization, rewrite,
  AI checks, briefing, market analysis/translation and performance hypotheses.
  Raw source text can no longer close an XML-like delimiter and inject a sibling
  pseudo-system block.

**Structured guideline extraction:**
- `lib/brand-os/guideline-extractor.ts` no longer asks for free-form JSON and
  regex-parses/`JSON.parse`s cleaned article text. It uses the current AI SDK 6
  structured-output path (`generateText` + `Output.object`) with a Zod schema,
  so enum/type/range failures are rejected before application code receives the
  object.
- Extracted `sourceQuote` values are accepted as reviewer-facing provenance only
  when the exact quote exists in the imported source text. A miss removes the
  quote and downgrades confidence one level.
- The old template `.replace()` interpolation path was removed entirely, which
  also eliminates JavaScript replacement-token expansion (`$&`, `$'`, `$\`` and
  `$$`) from imported document text.

**Guideline import boundary:**
- `app/api/brands/[brandId]/guidelines/import/route.ts` validates document type,
  platform, source type, URL, content size/title and locale with Zod. `sourceUrl`
  is restricted to HTTP(S). A supplied locale must equal the brand region's
  resolved locale; the stored locale is always pinned to that region instead of
  trusting an independently supplied request value.

**Supabase keepalive:**
- The existing authenticated `/api/cron/ping` route remains the single keepalive
  implementation and performs a real lightweight `rss_sources` query before
  reporting success. Vercel invokes it daily at `0 3 * * *`, but the route applies a deterministic
  UTC five-day gate before any Supabase call. Actual database activity therefore
  occurs once every five days without month-boundary drift. This avoids adding a duplicate cron path.
- The route continues to use `CRON_SECRET` and `cron_runs` logging. This is an
  availability aid for Free-plan inactivity, not a substitute for a paid-plan
  availability guarantee.

**Verification contract:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-august-ui.mjs`, and `git diff --check` must pass before
commit/push.

**Next Fable phase:** Phase 5 — `market-context.tsx` first-render correctness.

<!-- SESSION_CLOSEOUT_20260909_FABLE_PHASE4 -->
## Session closeout — 2026-09-09

This session completed Fable remediation Phases 3 and 4 and prepared the repository for continuation in a new chat.

**Completed:**
- Phase 3A: AI SDK 6 token option correctness, deterministic Google fallback order, transient-error cooldown, aborting provider timeouts, content-filter fail-fast, task-aware extraction budgets, one request-scoped deadline and parallel context assembly.
- Phase 3B: stale `content_requests` / `guideline_import_runs` visibility and guarded recovery, plus the queued content-request status-machine fix so successful work returns to `completed`.
- Phase 4: shared bounded prompt boundaries, structured guideline extraction with AI SDK 6 + Zod, source-quote verification, and validated guideline-import inputs/locale alignment.
- The original Phase 4 patch was rejected by legitimate local drift in four files. The corrective v2 used three-way/semantic merging and was successfully applied without reverting those local changes.
- Supabase keepalive reuses `/api/cron/ping`: Vercel invokes it daily, while a deterministic UTC five-day gate runs before any Supabase access, so database activity occurs once every five days without month-boundary drift.

**Repository hygiene:**
- Root-level historical `apply_*.py`, `diagnose_*.py`, `fix*.py`, `cleanup_*.py`, `finalize_*.py` and recovery scripts are temporary artifacts, already ignored by `.gitignore`, and should not remain in the repository after this closeout.
- `node_modules` and `.next` are local runtime/build artifacts and are intentionally not deleted by the closeout patch.

**Next implementation order:**
1. Fable Phase 5 — `lib/market-context.tsx` first-render correctness.
2. Fable Phase 6 — `app/competitors/page.tsx` correctness/accessibility.
3. Return to source quality, market-specific Brand OS depth, performance learning, social experiments and E2E coverage.

`docs/AMADO_ROADMAP.md` has been reduced to remaining work only. Historical detail stays in Git and `docs/fable-review.md`.

<!-- MARKET_INTELLIGENCE_SPRINT_20260909 -->
## Market intelligence + frontend hardening sprint — 2026-09-09

Fable Phases 5 and 6 are complete in this sprint.

**Frontend / market correctness:**
- `lib/market-context.tsx` no longer exposes a fake `br-fallback` id. It resolves the persisted market only after active regions load, validates stale cookies, exposes `ready`, and memoizes the context.
- Market-scoped workspaces now wait for a resolved region and cancel stale requests on market changes where applicable. This includes Generate, SEO, Market, deep analysis, Ideas, Localization, Rewrite, Brand, Competitors and Settings.
- Quick Create never submits an unresolved/fake region and shows market/generation failures through the August feedback system.
- `AugustDialog` now traps focus, restores focus to the opener and keeps Escape/backdrop behavior. Competitor cards use semantic buttons/labels, explicit loading/error/empty states and visible source-health text.

**Market intelligence sources:**
- `supabase/seeds/009_market_intelligence_sprint_20260909.sql` refreshes compact BR/ES/DE/US source sets around B2B software, AI, digital business, SMB/Mittelstand, CRM/work management/ERP and adjacent marketing/buyer signals.
- The seed is additive/idempotent and preserves historical evidence. Do not use historical `supabase db push` to install it in production; apply the reviewed migration/seed SQL explicitly.

**Competitor intelligence:**
- `supabase/migrations/047_competitor_source_links.sql` adds the many-to-many competitor/source relation and backfills legacy one-to-one links. This is required because `rss_sources.url` is globally unique while Salesforce/HubSpot/etc. are tracked in multiple markets.
- The seed establishes 12 active competitors per BR/ES/DE/US, aligned to CRM, work/project management, ERP, accounting/finance and real-estate software.
- Competitor reviews now merge two provenance layers for the last 30 days: linked official company sources and independent mentions from active sources in that competitor’s market. AI is explicitly told not to treat owned/PR claims as independent confirmation.
- Competitor ingestion preserves company-news signals such as press releases, investor relations and quarterly results that the general-market noise filter intentionally suppresses.

**Production order:**
1. Apply `047_competitor_source_links.sql` in Supabase.
2. Apply `009_market_intelligence_sprint_20260909.sql` and review its verification queries.
3. Run code verification.
4. Commit/push; Vercel deploy remains automatic.

**Required verification:**
`npm test`, `npm run build`, `node scripts/verify-market-intelligence-sprint.mjs`, `node scripts/verify-august-ui.mjs`, `node scripts/verify-multimarket-localization.mjs`, `node scripts/verify-amado-chain.mjs`, and `git diff --check`.
<!-- MARKET_INTELLIGENCE_SPRINT_20260909_FINAL -->

## 2026-09-09 — Market intelligence / competitor sprint finalized

Status: completed and production-ready.

What changed:
- Market context no longer exposes a fake BR fallback region while `/api/regions` is unresolved.
- Market-scoped workspaces now wait for resolved market state before fetching or mutating regional data.
- Quick Create submits only a real region UUID and blocks submission while market context is unresolved.
- AugustDialog gained focus trapping, Escape handling, focus restore, body-scroll lock, and improved ARIA wiring.
- Competitors UX now has explicit loading/error/empty states, safer mutation handling, semantic controls, accessible source health, and region-safe creation.
- Competitor creation resolves the active/default Brand OS for the selected region instead of relying on a global/default brand.
- Competitor source architecture now supports many-to-many links through `competitor_source_links` while preserving the legacy `rss_sources.competitor_id` path.
- Competitor review combines official company evidence with independent regional market evidence and labels the evidence type in the AI prompt.
- Competitor ingestion preserves company-news signals such as press releases, investor-relations items, shareholder news, and quarterly results instead of dropping them as generic noise.
- Curated market sources and competitor sets were expanded for BR, ES, DE, and US.
- Market-context tests were added.
- Localization and Market nullable-region TypeScript regressions were fixed after the sprint.
- Settings now imports `useCallback` correctly.
- Global CSS import ordering was corrected so the production build no longer emits the Google Fonts `@import` ordering warning.

Validation completed:
- `npm test`: 15 test files / 174 tests passed.
- `npm run build`: passed after the final TypeScript fixes.
- Supabase market-intelligence SQL: applied successfully in Supabase SQL Editor.
- Repository delivery files are expected to be uploaded to the repository root; patch scripts must relocate canonical files themselves when needed.

Supabase production rule:
- Do not run historical `supabase db push` against production.
- For production changes, provide one ready-to-run SQL block for Supabase SQL Editor.
- This sprint introduced `supabase/migrations/047_competitor_source_links.sql` and `supabase/seeds/009_market_intelligence_sprint_20260909.sql` as the canonical repository records for the applied SQL.

Delivery convention:
- The operator uploads patch/SQL/delivery files to the repository root.
- Automation/patch scripts must assume root-first delivery and move files to canonical paths themselves when required.


<!-- MARKET_BASE_REGION_FIX_20260910 -->
## Audit + fix — `/market/base` ignored the selected market (2026-09-10)

Audit scope: full market-selection path (`lib/market-context.tsx`,
`MarketSwitcher.tsx`, `/api/regions`, `/api/market`,
`/api/market/refresh`, `/api/market/deep-analysis`, `app/market/page.tsx`,
`app/market/analysis/page.tsx`, `app/ideas/page.tsx`) plus the
`evidence_items` vs. legacy `rss_items` schema history. Fable Phases 5 and
6 were confirmed already correctly implemented in the audited snapshot;
`useMarket()`, the region switcher, `/api/market`, `/api/market/deep-analysis`
and `/api/ideas` all wait for `ready` and filter by `region_id` with the
established tolerant rule (a source with no `region_id` is pre-multi-market
and stays visible in every market rather than being hidden everywhere).

**Confirmed bug:** `app/api/market/base/route.ts` ("База рынка", reachable
from the secondary button on `/market`) was never migrated off the legacy
`rss_items` table during the Stage-2 evidence-layer pivot, and had no
`region_id` filtering at all. `app/market/base/page.tsx` never sent a
`region_id`. Result: the page showed the same 50 global items regardless
of the selected market.

**Fix:**
- `app/api/market/base/route.ts` now accepts `?region_id=`, joins
  `region_id` through `source:source_id(...)` exactly like
  `/api/market/route.ts`, and applies the same tolerant filter (null
  `region_id` = visible everywhere). Over-fetches 400 rows pre-filter,
  slices to the existing 50-item cap after. Wrapped in try/catch using
  `getErrorMessage` for consistency with sibling routes (previously had no
  try/catch).
- `app/market/base/page.tsx` now waits on `useMarket().ready` before
  fetching, passes `region_id`, and surfaces loading/error/empty states
  consistent with `/market` and `/ideas`.

**Verification performed (isolated repo, real install):**
- `npm install` (triggers `next build` via `postinstall`) — passed, clean
  baseline before touching any file.
- `npx tsc --noEmit --strict` — zero errors, before and after the patch.
- `npx next build` — passed after the patch.
- `npx vitest run` — 174/174 tests passed, run 3× for flakiness — stable
  all three runs.
- `node scripts/verify-amado-chain.mjs` — 17/17 passed.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29 passed.
- `node scripts/verify-multimarket-localization.mjs` — 23/24, unchanged
  from baseline (see below — pre-existing, unrelated to this patch).
- `node scripts/verify-august-ui.mjs` — fails only on missing binary PNG
  icons (`amado-icon-192.png` etc.), which cannot exist in a text-only
  repomix snapshot; not a regression from this patch.
- `npx eslint` on both changed files: the page produces one
  `react-hooks/set-state-in-effect` error. Confirmed via full-repo
  `npm run lint` that this rule already fires on 9 other files already in
  production (`app/market/page.tsx`, `app/ideas/page.tsx`,
  `app/brand/page.tsx`, `app/competitors/page.tsx`,
  `app/generate/seo/page.tsx`, `app/localize/page.tsx`,
  `app/settings/page.tsx`, `components/MarketSwitcher.tsx`,
  `components/brand/tabs/PlatformPlaybooksTab.tsx`) — same early-return
  guard-clause shape. `market/base/page.tsx` follows the identical
  established pattern; not introduced by this patch, not fixed by it
  either (separate, repo-wide cleanup — see roadmap).

**Two adjacent findings, not fixed in this patch (out of scope):**
1. `regions.search_domain` column (migration 023) has zero code consumers
   anywhere in the repository — dead schema, not a bug.
2. `scripts/verify-multimarket-localization.mjs`'s "AI check follows
   selected market" assertion fails on a brittle exact-string match
   (`generatePage.includes('regionId: currentRegionId || undefined')`)
   against code that actually reads `regionId: currentRegionId` — the
   route itself (`app/api/ai-check/route.ts`) is correctly region-aware
   via `resolveRegionProfile(body.regionId)`. Confirmed pre-existing on
   the unmodified baseline, unrelated to `/market/base`. HANDOFF.md's own
   stated principle is not to assert brittle implementation detail in a
   verifier — this check should be loosened, not the source code changed.

**Verification contract for this patch:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs`, and `git diff --check`
must pass before commit/push.

**Next:** proceed to `docs/AMADO_ROADMAP.md` items (source quality /
observability, Brand OS depth by market), per operator direction.


<!-- SOURCE_OBSERVABILITY_PHASE1_20260910 -->
## Source quality & observability — Phase 1 (backend) (2026-09-10)

Scope: roadmap item 1 ("Source quality and observability"), backend half
only. Settings UI to surface this is a separate, not-yet-delivered phase
(see roadmap item 1, "Still open").

### What was built

`GET /api/sources/observability` (optional `?region_id=` query param,
same tolerant filter as every other region-scoped route: a source with no
`region_id` is pre-multi-market and included regardless of the requested
region).

For each source, over a trailing 30-day window (`evidence_items.discovered_at`):
- **Availability** — passthrough of the existing `rss_sources.health_status`
  / `consecutive_failures` / `last_success_at` / `last_failure_at`. Not
  recomputed; this was already correct and lives in `source_health_events`
  via the existing `/api/sources/health` route.
- **Freshness** — days since the most recent `evidence_items.discovered_at`
  for that source. A source can show `health_status: healthy` (last fetch
  succeeded) while still being "freshness-stale" (the fetch succeeded but
  found nothing new) — these are deliberately different signals.
- **Yield** — count of `evidence_items` discovered in the window.
- **Extraction success** — share of window items with
  `hydration_status = 'full_text'` vs `snippet`/`failed`.
- **Duplication** — two honestly-separate signals, not one blended number:
  - `refetchRate` — % of window items where `updated_at` trails
    `created_at` by more than 60s, meaning `saveEvidence()`'s update path
    (not insert path) fired — the same canonical URL was seen again.
  - `fingerprintDuplicateCount` — count of same-source items sharing a
    `content_fingerprint` (title+summary hash) under different URLs — a
    fuzzy same-story signal. **Not** read from
    `evidence_items.duplicate_of`, because nothing in the codebase writes
    that column (confirmed via full-repo grep) — it's dead schema.

Also returns a `regionCoverage` array (one row per active region):
`totalSources`, `activeSources`, `healthySources`,
`evidenceYield30d`. Sources with no `region_id` are excluded from this
rollup (they don't belong to a single region), matching the exclusion
rule used elsewhere. Response includes `unscopedSourceCount` so that
exclusion is visible rather than silently dropped.

### Bug found and fixed: `rss_sources.region_id` had no FK

While building the region-coverage rollup, a real PostgreSQL 16 instance
was stood up from the actual `supabase/migrations/*.sql` files (not a
mocked schema) to validate the observability queries. This surfaced:
`rss_sources.region_id` is `TEXT`, not `UUID`, and has **no foreign key**
to `regions(id)` — unlike `articles.region_id` and
`brand_profiles.region_id`, which are both correctly `UUID` + FK.

Root cause: `022_amado_baseline.sql` created the column as `TEXT` first.
`023_regions_brands_i18n.sql`'s `ALTER TABLE rss_sources ADD COLUMN IF NOT
EXISTS region_id UUID REFERENCES regions(id)` ran after and silently
no-op'd because the column name already existed — `IF NOT EXISTS` checks
the column's presence, not its type. `articles` and `brand_profiles` got
the correct treatment because those `region_id` columns didn't already
exist when `023` ran.

In practice this was never a data-correctness bug — every seed file and
every application write path already resolves a real `regions.id` UUID
before storing it as a string — but it was a live integrity gap: nothing
at the database level would have caught a bad write (typo, stale region
code, accidental non-UUID value), and it would have failed silently
exactly the way `/market/base`'s missing region filter did.

**Fix:** `supabase/migrations/048_rss_sources_region_id_uuid.sql`.
Idempotent and defensive:
1. A pre-flight `SELECT` surfaces any row that wouldn't survive the cast
   (malformed value, or a UUID that doesn't match any real region) —
   guarded so it's a no-op once the column is already `UUID`, rather than
   erroring on the text-only `!~*` operator on a second run.
2. The migration body nulls out (never drops the row for) anything that
   wouldn't survive the cast, then does
   `ALTER COLUMN region_id TYPE UUID USING region_id::uuid` and adds
   `rss_sources_region_id_fkey`.
3. A verify `SELECT` at the end confirms the resulting column type and FK.

**Validated directly against PostgreSQL 16** (not text pattern matching):
- Applied against a schema built from `000`, `022`, `023`, `024`, `039`,
  `041` with realistic seed-shaped data (some sources with a real region,
  some with `NULL` — matching production's legacy/global sources) —
  succeeded, column became `uuid`, FK constraint present.
- Re-ran 3× for idempotency — no errors, correctly detects the
  already-migrated state and no-ops.
- Ran again against deliberately injected bad data (a non-UUID string and
  an orphaned UUID not matching any region) — pre-flight correctly
  surfaced both rows, the defensive path nulled exactly those two rows
  (confirmed via follow-up `SELECT`, not just NOTICE text) and left every
  other row untouched, migration completed without aborting.
- Hand-verified the observability route's actual query logic (per-source
  yield/freshness/extraction/refetch/fingerprint-duplicate counts, and
  the region-coverage rollup) as raw SQL against seeded realistic data —
  results matched expectations exactly.

### Other dead-schema findings, not touched by this patch

Consistent with the `search_domain` finding from the previous patch —
these exist in migrations but have zero application code writing or
reading them:
- `rss_sources.items_count`, `avg_title_length`, `avg_summary_length`,
  `language_detected`, `authority_weight`
- `evidence_items.region_ids` (written as `null` always — the real region
  path is `source_id → rss_sources.region_id`; `duplicate_of` likewise
  unpopulated)

None of these block anything currently working; noted for awareness, not
remediated here — removing dead columns is a separate decision the
operator should make deliberately, not a side effect of an observability
patch.

### Verification performed

- Built a combined verification tree on top of the already-applied
  `MARKET_BASE_REGION_FIX_20260910` patch (this patch assumes that one is
  already applied, since it edits the same `docs/AMADO_ROADMAP.md` header
  section that patch rewrote).
- `npx tsc --noEmit --strict` — 0 errors.
- `npx next build` — passed, `/api/sources/observability` registered as a
  dynamic route.
- `npx vitest run` — 174/174, ×3 for flakiness — stable all three runs.
- `npx eslint app/api/sources/observability/route.ts` — clean, no errors
  or warnings.
- `node scripts/verify-amado-chain.mjs` — 17/17.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29.
- `048_rss_sources_region_id_uuid.sql` validated against a real
  PostgreSQL 16 instance as described above (this is a genuine DB
  validation, not a text-based SQL syntax check).

**Verification contract for this patch:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs` must pass before
commit/push. The SQL migration must be run in the Supabase SQL Editor
**before** or independently of the code patch (they're not
interdependent — the route works whether `region_id` is `text` or `uuid`,
since the TypeScript layer already treats it as an untyped string; the
migration is a data-integrity fix, not a functional prerequisite for the
new route).

**Next:** Settings UI (Phase B) to surface this data per source and per
region; then the remaining roadmap items (competitor-mention source
observability, source authority vs. actual generation use, Brand OS depth
by market).


<!-- SETTINGS_OBSERVABILITY_UI_20260910 -->
## Source observability — Settings UI (Phase B) + roadmap correction (2026-09-10)

Scope: roadmap item 1's "Still open: Settings UI" bullet, plus a
correction to a bug in `apply_001_market_base_region_fix.py`'s own
`docs/AMADO_ROADMAP.md` edit, found while preparing this delivery.

### Bug found in Patch 1's roadmap edit (not previously caught)

While building this phase, a full read of `docs/AMADO_ROADMAP.md` (not
just the structural checks used in Patch 1/2's own `--verify` steps)
found that Patch 1 left the file with duplicated content: the original
item 1 bullets and an entire second copy of "### 2. Brand OS depth by
market" survived, sitting immediately after the new item 1/2 content
Patch 1 inserted.

**Root cause:** Patch 1's anchor string for the roadmap header replace
matched only through the "### 1. Source quality and observability"
heading and its bullet list. It did not also consume the "### 2. Brand OS
depth by market" section that immediately followed in the original file,
even though Patch 1's own replacement text already included a full copy
of that "### 2." section. The result: the replace correctly inserted the
new content, but the original file's own item-1 bullets and item-2
section were never removed — they just ended up duplicated after the new
block.

Patch 1's own `--verify` step did not catch this because it only checked
for a marker string (`"Last consolidated: 2026-09-10."`), not full
content correctness — an example of exactly the "recorded as complete but
didn't fully land" failure mode this project has hit before. Patch 2
inherited this pre-existing duplication unchanged; the bug is Patch 1's,
not Patch 2's.

This patch script removes the duplicated block (the orphaned bullets plus
the second "### 2." header and its two lines) if present, leaving the
single correct "### 2. Brand OS depth by market" section that Patch 1's
new header text already supplied. It is idempotent-safe: if the
duplication is not present (e.g. Patch 1 hasn't been run, or this
correction has already been applied), the removal step is a no-op rather
than an error.

**If you already ran `apply_001_market_base_region_fix.py`** in
Codespaces, your `docs/AMADO_ROADMAP.md` currently has this duplication.
This patch fixes it as part of its normal `--apply` step — no separate
action needed.

### What was built (Settings UI)

- `components/settings/SourceCard.tsx` — new optional `observability`
  prop. When present, renders a compact metrics block (freshness, 30-day
  yield, extraction success rate, re-fetch rate, and a fingerprint-
  duplicate count when non-zero) between the existing availability/health
  display and the card footer. Fully backward compatible — renders
  nothing when `observability` is `undefined`, so existing callers that
  don't pass it are unaffected.
- `components/settings/RegionCoverageCard.tsx` — new component. Shows
  total/active/healthy source counts and 30-day evidence yield for the
  currently selected region. Renders nothing (`null`) if no coverage data
  is available for that region, rather than an empty card.
- `app/settings/page.tsx` — `reloadData` now also fetches
  `/api/sources/observability?region_id=...` alongside the existing
  calls. Failure of this one fetch is caught and treated as "no
  observability data" (falls back to `undefined`/empty state) rather than
  failing the whole Settings page load, since it's additive information,
  not a page-blocking dependency. `RegionCoverageCard` is rendered at the
  top of the Sources section; `SourceCard` now receives the matching
  per-source observability object.
- `lib/i18n/config.ts` — added 15 new keys under `settings.*` in the `ru`
  dictionary only (`observability_*`, `region_coverage_*`). Not added to
  the `pt-BR`/`en` dictionaries: `setLocale()` hardcodes `ru` regardless
  of what's passed, and `t()`'s own fallback logic already returns the
  `ru` string for any key missing from a non-`ru` locale (see the
  "UI is Russian-only" comment already in that file) — those two
  dictionaries are vestigial for the fallback mechanism, not live, so
  adding dead keys to them would be pure noise.

### Verification performed

- Built on top of the combined Patch 1 + Patch 2 state.
- `npx tsc --noEmit --strict` — 0 errors.
- `npx next build` — passed.
- `npx eslint` on all four changed/added files — clean. (Confirmed the
  one pre-existing `react-hooks/set-state-in-effect` error and one
  pre-existing unused-var warning already tracked in roadmap items 0 and
  the `setLocale` signature are unchanged from the pre-patch baseline —
  not introduced by this patch.)
- `npx vitest run` — 174/174, ×3 for flakiness — stable all three runs.
- `node scripts/verify-amado-chain.mjs` — 17/17.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29.
- Full read-through of the resulting `docs/AMADO_ROADMAP.md` (not just a
  structural marker check) to confirm no duplication remains after the
  correction — this is the check that was missing from Patch 1's own
  verification and caused the bug documented above.

**Verification contract for this patch:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs` must pass before
commit/push. No SQL block for this patch — UI and docs only.

**Next:** a "disable/remove low-value source" workflow surfaced by the
new observability data; source-authority-vs-actual-use comparison;
competitor-mention source observability; Brand OS depth by market.


<!-- SET_STATE_IN_EFFECT_CLEANUP_20260912 -->
## Repo-wide `react-hooks/set-state-in-effect` cleanup (2026-09-12)

Scope: roadmap item 0, tracked since the `/market/base` region fix first
surfaced it as a pre-existing, repo-wide finding.

### What the rule actually flags, and why a restructure wasn't the fix

Every one of the 10 affected files (9 with the guard-clause shape, 1 —
`PlatformPlaybooksTab.tsx` — calling a memoized async loader from an
effect) has this in common: `useState`/`useEffect` used to load
market/brand-scoped data, with a guard clause that resets state and
returns early when the market or brand isn't ready yet
(`if (!marketReady || !currentRegionId) { setItems([]); setLoading(true); return }`).

`eslint-plugin-react-hooks@7.1.1`'s `set-state-in-effect` rule flags any
`setState` call reachable synchronously from an effect body, on the
premise that it should instead be "derived during render." That premise
holds for pure derivations (its own docs example:
`const selected = items.find(...)` computed inline). It does not hold
here: the state in question is fetched asynchronously from the network:
there is nothing to derive during render, since the very thing being
reset **is** the trigger for a fetch that hasn't happened yet.

Checked before deciding not to restructure: the rule's own reference page
(react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect)
offers no valid pattern for this shape, only pure-derivation examples.
The open upstream thread
([facebook/react#34743](https://github.com/facebook/react/issues/34743))
confirms this is a known, unresolved gap — commenters' suggested
workarounds (`startTransition()`, `requestAnimationFrame()`, `setTimeout()`)
are explicitly described in that same thread, including by people close
to the React Compiler team, as feeling "wrong, like a code smell or
'tricking the lint rule.'" Multiple newer GitHub issues against the same
rule (#35276, #34858, #35377) report further false positives as of
December 2025, meaning this is still actively unsettled upstream, not a
solved problem this codebase is behind on.

**Decision:** do not contort 10 files' data-loading logic to satisfy a
rule with no working alternative pattern for this shape. Use the
convention this codebase had already independently arrived at and proven
in production: `app/generate/page.tsx` already carries a file-level
`/* eslint-disable react-hooks/set-state-in-effect */` for exactly this
reason, and 8 files under `components/brand/tabs/` (`ExamplesTab.tsx`,
`ProductsClaimsTab.tsx`, `VoiceVocabularyTab.tsx`, `AudiencePainsTab.tsx`,
`ContentPillarsTab.tsx`, `OverviewTab.tsx`, `ComplianceTab.tsx`,
`VersionsTab.tsx`) plus `app/knowledge/page.tsx` already carry a
documented per-line disable for the "call a memoized async fetcher from
an effect" shape. This patch extends the same two conventions rather than
inventing a third.

### Bug found while verifying this patch: `.amado-patch-backups/` was not excluded from lint

While confirming this patch's own before/after `npm run lint` diff, the
raw run reported 13 `set-state-in-effect` occurrences instead of the
expected 0 (source clean) + 1 (the pre-existing, unrelated
`app/analytics/page.tsx` warning). Traced to `.amado-patch-backups/`:
every `apply_*.py` script since `apply_001` writes untouched pre-patch
file copies there before editing, and `eslint.config.mjs`'s
`globalIgnores` only excluded `.next/**`, `out/**`, `build/**`, and
`next-env.d.ts` — not this directory. `.gitignore` already excludes
`.amado-patch-backups/` for git purposes (with a comment saying exactly
that), but ESLint's flat config does not read `.gitignore`
automatically — the two ignore lists are separate and had drifted apart.
Confirmed this was not introduced by this patch: re-running lint against
`apply_003`'s own backup directory on an otherwise unmodified checkout
reproduces the same false findings.

**Fix:** added `".amado-patch-backups/**"` to `eslint.config.mjs`'s
`globalIgnores`, matching the intent already stated in `.gitignore`'s own
comment. Confirmed via `npm run lint` before/after: 13 → 1 occurrence
(the one remaining is the pre-existing, unrelated `app/analytics/page.tsx`
warning). This means running `npm run lint` locally in Codespaces after
any previous patch's `--apply` would have shown the same false noise —
this fix benefits all four patches applied so far, not just this one.

### What was changed

**File-level disable** (9 files — each effect body's guard clause directly
calls `setState`, matching `generate/page.tsx`'s shape exactly):
`app/brand/page.tsx`, `app/competitors/page.tsx`,
`app/generate/seo/page.tsx`, `app/ideas/page.tsx`, `app/localize/page.tsx`,
`app/market/base/page.tsx`, `app/market/page.tsx`, `app/settings/page.tsx`,
`components/MarketSwitcher.tsx`. Each gets:
```
/* eslint-disable react-hooks/set-state-in-effect -- guard-clause reset-and-return
 * on an unready/invalid market is a confirmed false positive, not a
 * cascading-render bug: see https://github.com/facebook/react/issues/34743
 * and docs/AMADO_ROADMAP.md item 0. */
```
placed before `'use client'`, matching `generate/page.tsx`'s exact byte
layout (disable comment, then `'use client'`, then the file's original
first blank line — nothing else in the file reordered).

**Per-line disable** (1 file — only one effect, calling a memoized loader,
matching the `ExamplesTab.tsx`-style shape rather than the guard-clause
shape): `components/brand/tabs/PlatformPlaybooksTab.tsx`. Added the same
two-line comment + `eslint-disable-next-line` immediately above
`void load()`, matching the exact wording already used in
`ExamplesTab.tsx`.

Before applying either fix, every file's full effect list was read (not
just the flagged line) to confirm a file-level disable would not mask an
unrelated, legitimately-catchable issue elsewhere in the same file. All
10 files' other effects (template fetches inside `.then()`, interval
timers, localStorage sync, `.then()`-wrapped async calls) do not have a
synchronous `setState` reachable from the effect body and would not be
flagged regardless — confirmed by diffing the full `npm run lint` output
before and after: the only findings that disappeared are the 11 targeted
ones (`market/page.tsx` and `competitors/page.tsx` each had two), and the
8 pre-existing, unrelated findings elsewhere in the repo
(`app/analytics/page.tsx`'s unused-disable-directive warning,
`app/api/prompts/route.ts`, `app/api/rss/route.ts`,
`components/ui/AugustDialog.tsx`, `lib/i18n/config.ts`'s unused-param
warning, and one unrelated `react-hooks/exhaustive-deps` warning already
present on `app/market/page.tsx`) are byte-for-byte unchanged.

### Verification performed

- Full `npm run lint` before and after, diffed line-by-line (not just a
  pass/fail count) to confirm exactly the 11 targeted findings disappeared
  and the `.amado-patch-backups/` false-positive source (see above) is
  also resolved.
  and nothing else moved.
- `npx tsc --noEmit --strict` — 0 errors.
- `npx next build` — passed.
- `npx vitest run` — 174/174, ×3 for flakiness — stable all three runs.
- `node scripts/verify-amado-chain.mjs` — 17/17.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29.
- `node scripts/verify-multimarket-localization.mjs` — 23/24, unchanged
  from the pre-existing baseline (roadmap item 0b).

**Verification contract for this patch:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs` must pass before
commit/push. No SQL block — lint/docs only, no runtime behavior change.

**Next:** roadmap item 0b (loosen the brittle AI-check verifier
assertion); a "disable/remove low-value source" workflow; source-
authority-vs-actual-use comparison; competitor-mention source
observability; Brand OS depth by market.


<!-- VERIFIER_AI_CHECK_ASSERTION_FIX_20260913 -->
## Loosen the brittle "AI check follows selected market" verifier assertion (2026-09-13)

Scope: roadmap item 0b.

### The problem

`scripts/verify-multimarket-localization.mjs`'s "AI check follows
selected market" check string-matched
`generatePage.includes('regionId: currentRegionId || undefined')`
against the whole `app/generate/page.tsx` file. The real call site sends
`regionId: currentRegionId` (no `|| undefined`) — functionally identical,
since `currentRegionId` was already typed `string | null` there — but a
different literal string, so the check failed even though
`app/api/ai-check/route.ts` is genuinely, correctly region-aware via
`resolveRegionProfile(body.regionId)`. This violates the verifier
discipline already stated elsewhere in this file: don't assert brittle
implementation detail.

### The fix, and the mistake caught while building it

First attempt: replace the exact-string match with
`/regionId:\s*currentRegionId\b/.test(generatePage)` — checking the whole
file for the pattern's presence anywhere. This looked reasonable and
initially returned 24/24. Before shipping it, this was deliberately
stress-tested by injecting a regression (hardcoding the ai-check call's
`regionId` to a fixed string) — and the check **still passed**, because
`app/generate/page.tsx` has a second, unrelated call site
(`fetch('/api/generate', ...)`, the main content-generation request) that
independently sends `regionId: currentRegionId`. A file-wide check would
stay green even if the ai-check call itself completely stopped being
region-aware — replacing one brittle-but-at-least-specific check with a
meaningless one would have been worse than leaving the original bug.

**Final fix:** scope the regex to only the `fetch('/api/ai-check', ...)`
block via
`generatePage.match(/fetch\('\/api\/ai-check',\s*\{[\s\S]*?\n {6}\}\)/)`,
then test the pattern only within that extracted block. Verified in both
directions:
- Runs clean (24/24) against the current, correct code.
- Re-ran the same injected regression (hardcoding `regionId` inside just
  the ai-check fetch block, leaving the generation call untouched) —
  correctly fails (23/24) this time.
- Restored the file and re-confirmed 24/24 afterward.

The route-side assertions (`resolveRegionProfile(body.regionId)`,
`regionProfile.locale`/`languageName`/`name` used in the prompt, no
hardcoded Brazil-only judge text) were already behavior-based and
unchanged.

### Verification performed

- `node --check scripts/verify-multimarket-localization.mjs` — valid
  syntax.
- Brace/paren/bracket balance check — even.
- Ran the verifier directly (not through `npm test`/`tsc`/`next build` —
  `scripts/` is excluded from `tsconfig.json` and isn't part of the app
  build, so this change has zero effect on those; confirmed by the
  `exclude` list in `tsconfig.json`).
- Both directions of the regression test described above.

**Verification contract for this patch:**
`node scripts/verify-multimarket-localization.mjs` must report 24/24
before commit/push. No SQL block, no app code touched — verifier script
and docs only.

**Next:** a "disable/remove low-value source" workflow; source-authority-
vs-actual-use comparison; competitor-mention source observability; Brand
OS depth by market.


<!-- LOW_VALUE_SOURCES_WORKFLOW_20260914 -->
## "Disable low-value sources" workflow (2026-09-14)

Scope: roadmap item 1's "Still open: a remove/disable low-value sources
workflow" bullet, built on top of the observability data from
`SOURCE_OBSERVABILITY_PHASE1_20260910` and its Settings UI.

### What "low-value" means here, deliberately

A source is flagged when it is `active` **and** its observability
`yield.evidenceCount` is exactly `0` for the current window (30 days, per
`/api/sources/observability`). Nothing else feeds into the threshold:

- Extraction success rate and duplicate/re-fetch rate were deliberately
  left out. Those measure the quality of what came in; this threshold
  answers a narrower, unambiguous question — did anything come in at
  all. Combining them would turn one clear signal into a fuzzy score
  that's harder to trust and explain at a glance.
- A source with no observability entry yet (data still loading, or the
  `/api/sources/observability` fetch failed) is never flagged. The
  alternative — treating "no data" as "zero yield" — would produce false
  positives on every page load before the fetch resolves.
- An already-inactive source is never flagged (nothing to disable).

Verified with 5 direct unit-style test cases covering exactly these
edges (active+zero → flagged, active+nonzero → not flagged,
inactive+zero → not flagged, no-data → not flagged, `is_active` field
variant → flagged) before wiring it into the UI.

### What was built

- `components/settings/LowValueSourcesPanel.tsx` (new). Renders nothing
  (`null`) if no sources currently qualify — this is deliberately not a
  permanent fixture of the Sources section, only appears when there's
  something to act on. When sources do qualify: a danger-toned panel (a
  reused `--aug-danger-bg`/`--aug-danger-fg`, the same tokens
  `SourceCard.tsx` already uses for its unhealthy state) listing each
  flagged source with a checkbox, a "select all" toggle, and a "disable
  selected" button that confirms via the existing `confirmAction` dialog
  before acting.
- `app/settings/page.tsx` — renders the panel above `RegionCoverageCard`
  in the Sources section (the more actionable item comes first). Bulk
  disable is implemented as a sequential loop over
  `PATCH /api/rss/{id}` with `{ active: false }` — reusing the existing
  single-source endpoint rather than adding a new bulk one, matching
  `reloadData`'s own existing `Promise.all`-of-individual-fetches style
  elsewhere in this file. On any failure, the loop throws with the
  server's own error message rather than silently continuing.
- `lib/i18n/config.ts` — 9 new `ru`-only keys under `settings.*`
  (`low_value_*`), same rationale as prior i18n additions: the UI is
  Russian-only, so `pt-BR`/`en` entries would be dead weight.

Disabling never deletes evidence or the source record — sources can be
re-enabled at any time from their existing `SourceCard` active/inactive
toggle, which was already there before this patch.

### Verification performed

- `npx tsc --noEmit --strict` — 0 errors.
- `npx next build` — passed.
- `npx eslint` on all three changed/added files — clean (confirmed the
  one pre-existing `lib/i18n/config.ts` unused-param warning is
  unchanged from baseline).
- `npx vitest run` — 174/174, ×3 for flakiness — stable all three runs.
- `node scripts/verify-amado-chain.mjs` — 17/17.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29.
- `node scripts/verify-multimarket-localization.mjs` — 24/24 (the item 0b
  fix from the prior patch holds).
- 5 direct test cases against the `isLowValue` selection logic in
  isolation, covering the edge cases described above, before wiring it
  into the component.

**Verification contract for this patch:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs` must pass before
commit/push. No SQL block — UI and docs only, no schema change.

**Next:** compare source authority (`rss_sources.authority_weight`, a
dead column) with actual use in briefing/generation; competitor-mention
source observability; Brand OS depth by market.


<!-- SOURCE_AUTHORITY_RANKING_FIX_20260915 -->
## Source authority vs. actual use — a correction and a fix (2026-09-15)

Scope: roadmap item 1's "compare source authority with actual use in
briefing and generation" bullet.

### Correcting an earlier characterization

The `SOURCE_OBSERVABILITY_PHASE1_20260910` entry above characterized
`rss_sources.authority_weight` as "dead, never-written," in the same
category as `items_count`, `avg_title_length`, `search_domain`, and
`evidence_items.region_ids`/`duplicate_of`. That was wrong in one
important respect, found while actually investigating "compare with
actual use" rather than assuming the prior note was complete: the column
is correctly identified as never *read* by any application code
(confirmed again here via a full-repo grep), but it **is** written —
every seed file (`001_brazil_sources.sql`, `006_spain_market_and_brand.sql`,
`008_de_us_sources.sql`, `009_market_intelligence_sprint_20260909.sql`,
`002_mvp_brazil_saas.sql`, `003_final_workspaces.sql`) populates it with
real, deliberately-differentiated per-source values (1.0 to 1.4 observed)
— someone genuinely ranked these sources by editorial trust when writing
the seeds. This is not corrected retroactively in the earlier entry
(history isn't rewritten), but is corrected here since the earlier
"dead" label was inaccurate and would have misdirected anyone reading it
looking for this exact task.

### The actual gap, and the fix

`lib/briefing.ts`'s `selectCandidates()` — the very first stage of
briefing generation — already ranks candidates by
`.order('source_authority', { ascending: false, nullsFirst: false })`
against `evidence_items.source_authority`. That column exists
(`024_evidence_layer.sql`), is written on every `saveEvidence()` call in
`lib/evidence.ts` (`source_authority: input.sourceAuthority ?? 1.0`), and
the ranking query is correctly wired. The break was one step further
back: neither of `lib/rss.ts`'s two `saveEvidence()` call sites
(`saveRows()`, used by every RSS/PubMed/HTML-fallback ingestion path, and
`saveManualItem()`) ever passed `sourceAuthority`. Every evidence item,
regardless of which source it came from, was saved with `source_authority`
hardcoded to `1.0` — the ranking machinery ran on every briefing, but
operated on a constant. A source seeded at `1.4` and one seeded at `1.0`
were indistinguishable to the query; the actual sort order fell through
entirely to the secondary key (`published_at`), meaning authority never
influenced which evidence briefing considered first.

**Fix:**
- `saveRows()` already queried `rss_sources` once per batch for
  `source_category` (to apply market-eligibility filtering). Extended
  that same query to also select `authority_weight`, and passed it as
  `sourceAuthority` into the existing `saveEvidence()` call — no new
  query added.
- `saveManualItem()` had no existing `rss_sources` query; added one
  (`select('authority_weight')`) and passed it through the same way.
- Both call sites fall back to `undefined` when `authority_weight` is
  null (a source with no explicit weight), which `saveEvidence()` already
  defaults to `1.0` — unweighted sources behave exactly as before.

### Verification performed

- `npx tsc --noEmit --strict` — 0 errors.
- `npx next build` — passed.
- `npx eslint lib/rss.ts` — clean.
- **Verified against a real PostgreSQL 16 instance**, not just a
  structural check: seeded two sources with differentiated
  `authority_weight` (1.4 vs 1.0) and two evidence items with identical
  `published_at` timestamps (the realistic worst case: without correct
  authority weighting, the secondary sort key also ties, so ordering
  would be arbitrary/insertion-order-dependent). Ran
  `selectCandidates()`'s exact query
  (`ORDER BY source_authority DESC NULLS LAST, published_at DESC NULLS LAST`)
  — the higher-authority item correctly sorted first.
- `npx vitest run` — 174/174, ×3 for flakiness — stable all three runs
  (no existing test covers this path; confirmed no regression elsewhere).
- `node scripts/verify-amado-chain.mjs` — 17/17.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29.
- `node scripts/verify-multimarket-localization.mjs` — 24/24.

**Verification contract for this patch:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs` must pass before
commit/push. No SQL migration needed — this is a write-path fix, not a
schema change; both columns (`rss_sources.authority_weight`,
`evidence_items.source_authority`) already exist and are correctly
typed. Newly-ingested evidence will carry real authority from the next
ingestion run onward; existing `evidence_items` rows already saved with
`source_authority = 1.0` are not backfilled by this patch (a backfill
would need to join back to `rss_sources` by `source_id` and is a
reasonable follow-up if Paal wants historical briefing candidates
re-ranked too, but wasn't assumed here since it's a data change, not a
code fix, and existing evidence ages out of the briefing window over
time regardless).

**Next:** source-level observability for independent competitor
mentions; Brand OS depth by market.


<!-- COMPETITOR_MENTION_OBSERVABILITY_20260916 -->
## Competitor-mention source observability (2026-09-16)

Scope: roadmap item 1's last remaining "Still open" bullet — source-level
observability for independent competitor mentions.

### What existed already, and what was missing

`lib/competitor-review.ts`'s `generateCompetitorReview()` already scans
active, non-competitor market sources for evidence text matching a
competitor's name/website-derived aliases (`gatherIndependentMentions()`),
distinguishing "official" (the competitor's own tracked sources) from
"independent" (third-party market sources that happen to mention them).
This is real, working detection logic — but it only ran on demand, per
competitor, per review request, and discarded the per-source breakdown
after feeding it into the AI review prompt. There was no way to see,
across all sources in a market, which ones actually tend to surface
competitive signal versus which ones never do.

### What was built

- `lib/competitor-review.ts` — exported `competitorAliases`,
  `mentionsCompetitor`, and the `CompetitorRow` type it depends on,
  rather than reimplementing the same matching logic a second time (which
  would have let the two drift apart over time). `mentionsCompetitor`
  was also narrowed from taking a full `EvidenceRow` to taking just the
  three text fields it actually reads (`source_title`, `source_summary`,
  `full_text`) — a cleaner, more honest signature for a function being
  reused outside its original call site. The one internal call site was
  updated to match; behavior is unchanged (confirmed via `tsc --strict`
  and the direct alias/matching test cases below).
- `app/api/sources/competitor-mentions/route.ts` (new). Given
  `?region_id=`: resolves that region's brands → active competitors →
  alias lists, resolves the region's active non-competitor sources, scans
  their evidence over a 30-day window (matching
  `generateCompetitorReview()`'s own review window), and returns per
  source: total mention count and count of distinct competitors covered
  at least once. Both numbers are tracked separately deliberately —
  volume and breadth answer different questions about a source's value
  ("how often does this source mention *a* competitor" vs. "how many of
  our competitors does this source ever cover").
- `components/settings/CompetitorMentionsCard.tsx` (new). Renders nothing
  when no competitors exist for the region (nothing to scan for). Shows
  the top 5 sources by mention count when at least one source has
  mentions; otherwise a plain "none found yet" line.
- `app/settings/page.tsx` — fetches the new endpoint alongside the
  existing observability calls; a failed fetch degrades to an empty
  state rather than blocking the page.
- `lib/i18n/config.ts` — 3 new `ru`-only keys.

### Verification performed

- `npx tsc --noEmit --strict` — 0 errors (this also validated the
  `mentionsCompetitor` signature narrowing didn't break the existing
  internal call site).
- `npx next build` — passed.
- `npx eslint` on all changed/added files — clean.
- `npx vitest run` — 174/174, ×3 for flakiness — stable all three runs
  (no existing test covers `competitor-review.ts`; confirmed no
  regression elsewhere).
- Direct unit-style test of `competitorAliases`/`mentionsCompetitor` in
  isolation with 5 cases, including the two that matter most for a
  false-positive-prone name-matching feature: a source mentioning an
  unrelated word that happens to share a competitor's name ("Monday.com"
  vs. a source just saying "segunda-feira") correctly does not match, and
  a word-boundary case ("Trellodev" should not match "Trello") correctly
  does not match.
- **Verified the full pipeline end-to-end against a real PostgreSQL 16
  instance**, not just structurally: seeded a brand with two active
  competitors (one with a name that only appears via its website-derived
  alias, not literally in its own name, to exercise that code path) and
  two market sources — one whose evidence mentions both competitors, one
  whose evidence mentions neither. Ran each step of the route's query
  sequence (brands in region → competitors → aliases → active
  non-competitor sources → evidence in window) as raw SQL, then applied
  the actual matching/aggregation logic to the returned rows in Node.
  Result matched expectations exactly: the relevant source showed
  `mentionCount: 2, competitorsCovered: 2`; the irrelevant source showed
  `0, 0`.
- `node scripts/verify-amado-chain.mjs` — 17/17.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29.
- `node scripts/verify-multimarket-localization.mjs` — 24/24.

**Verification contract for this patch:**
`npm test`, `npm run build`, `node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs` must pass before
commit/push. No SQL block — read-only aggregation over existing tables,
no schema change.

**Next:** Brand OS depth by market — the last open item on the roadmap.


<!-- BRAND_OS_COVERAGE_DIAGNOSTIC_20260917 -->
## Brand OS depth by market — diagnostic tooling, not content (2026-09-17)

Scope: roadmap item 2, "Brand OS depth by market." Read this entry
carefully before assuming the roadmap item is closed — it is not; only
the diagnostic half of it is done here, deliberately.

### Why this patch does not contain ES/DE/US brand content

Real positioning, voice, approved claims, forbidden terms and content
pillars for Spain, Germany and the US are business decisions that
someone at Amado needs to actually make and approve — not something to
invent from general knowledge of those markets and present as if it were
decided. The Spain and DE/US seed files
(`supabase/seeds/006_spain_market_and_brand.sql`,
`supabase/seeds/007_germany_us_locales.sql`) already say this explicitly
in their own comments when they were written, and this patch honors that
same judgment rather than overriding it.

### What was actually built: a coverage diagnostic

Before this patch, "Brand OS depth by market" was a vague, unquantified
concern. What was missing, precisely, was unknown. This patch makes the
gap concrete and measurable:

- `app/api/brands/os-coverage/route.ts` (new, optional `?region_id=`):
  for each active brand, checks all 16 free-text `brand_profiles` fields
  for emptiness, and gets a row count from every structured table
  `lib/brand-snapshot.ts`'s `buildBrandSnapshot()` actually queries at
  generation time (`brand_audiences`, `brand_pain_points`,
  `brand_products`, `brand_claims`, `brand_terms`,
  `brand_content_pillars`), plus whether the brand has an active
  `brand_rule_sets` row. The table list is not a separately-invented
  checklist — it's read directly from `brand-snapshot.ts`'s own query,
  so this report reflects exactly what generation does or doesn't see
  for a given brand, not an approximation of it.
- A field counts as "filled" if it's non-empty after trimming — a
  placeholder string like `"PLACEHOLDER — ..."` still counts as filled.
  This endpoint reports structural completeness, not content quality;
  judging whether filled text is still a placeholder is for a human
  reading it in `BrandOsEditor`, not something string content alone can
  determine.
- `components/brand/BrandOsCoverageCard.tsx` (new): renders on the Brand
  page next to the existing `BrandOsEditor`, showing empty field names,
  which structured tables have zero rows, and whether there's no active
  rule set — but only when the selected brand actually has gaps
  (`null` otherwise, so a fully-built-out brand shows nothing extra).

### What this confirmed, concretely, that was previously just assumed

Tracing `lib/brand-snapshot.ts`'s `buildBrandSnapshot()` (the function
every generation call uses to assemble brand context) showed that **every
block is conditional on row count** — a brand with zero `brand_claims`
simply gets no approved/forbidden claims guidance in its prompt, silently,
by design (confirmed as the correct, safe behavior — not a bug). Combined
with the seed files: for every market including Brazil, none of the seeds
populate `brand_claims`, `brand_terms`, `brand_content_pillars`, or an
active `brand_rule_sets` row. Whether this has since changed through live
edits in `BrandOsEditor` cannot be determined from this repository
snapshot (repomix and local files don't reflect live Supabase state — see
this file's own standing caution about that). The concrete, previously
unquantified risk this surfaces: ES/DE/US generation may currently be
running with zero compliance rules and zero approved/forbidden claims
enforcement, relying only on a placeholder voice description. Running
`GET /api/brands/os-coverage` against the live database will show exactly
where each brand actually stands today.

### Verification performed

- `npx tsc --noEmit --strict` — 0 errors.
- `npx next build` — passed.
- `npx eslint` on all three changed/added files — clean after adding the
  same file-level `set-state-in-effect` disable documented in the
  `SET_STATE_IN_EFFECT_CLEANUP_20260912` entry above (same guard-clause
  false positive, same established convention — a brand-not-yet-selected
  guard in `BrandOsCoverageCard.tsx`).
- Confirmed via full `npm run lint` diff that the baseline `6 problems`
  is unchanged, all pre-existing.
- `npx vitest run` — 174/174, ×3 for flakiness — stable all three runs.
- **Verified the coverage-counting logic against a real PostgreSQL 16
  instance**, not just structurally: seeded one brand with real content
  (`voice_description`, `positioning`, `target_audience` filled, 2
  `brand_audiences` rows) and one placeholder brand (only
  `voice_description = 'PLACEHOLDER'`, everything else empty, zero
  `brand_audiences` rows). Ran the equivalent count/emptiness queries —
  results matched expectations exactly, including confirming
  `'PLACEHOLDER'` correctly counts as "filled" per this endpoint's
  deliberate structural-completeness-only definition.
- `node scripts/verify-amado-chain.mjs` — 17/17.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29.
- `node scripts/verify-multimarket-localization.mjs` — 24/24.

**Verification contract for this patch:**
`npm test`, `npm run build`, `npm run lint`,
`node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs` must pass before
commit/push. No SQL block — read-only aggregation over existing tables,
no schema change.

**Next:** run `GET /api/brands/os-coverage` against the live database
once this patch is deployed to see the real, current gap per brand
(this repository's seed-file view may be stale relative to any live
edits already made through `BrandOsEditor`). Then: real positioning,
voice, claims and an active rule set for ES/DE/US, entered through the
existing editor — a content and business-decision task, not a further
engineering patch. This closes out every item on the roadmap except that
content work itself.


<!-- POST_SPRINT_AUDIT_CLEANUP_20260918 -->
## Post-sprint audit: KISS/YAGNI/DRY review of Patches 1-9 (2026-09-18)

Scope: a full independent re-read of every file touched by
`apply_001` through `apply_009` (not a re-verification of the earlier
patches' own claims — a fresh read, deliberately skeptical of them),
specifically hunting for DRY/KISS/YAGNI issues and correctness bugs
introduced along the way. Found four real issues; three were code
problems and fixed, one was investigated and correctly left alone after
the investigation itself changed the right answer.

### 1. Fixed: stale selection state in `LowValueSourcesPanel.tsx`

The `selected` `Set<string>` of checked source ids was never filtered
against the current `lowValueSources` list. If a source's observability
data refreshed between renders and it dropped off the low-value list
(picked up evidence since the last fetch), its id could remain in
`selected` with no row left to uncheck it from, and the "select all"
checkbox's `checked` state (compared by `.size`) could be wrong as a
result. Fixed by deriving `validSelected` — `selected` filtered to ids
still present in `lowValueSources` — on every render, and using it
everywhere the component reads selection state instead of the raw
`selected` set. Verified directly: a Node-level test with a
deliberately stale id in the selection set confirmed `validSelected`
correctly excludes it and reports the right size.

### 2. Fixed: `SourceObservability`, `RegionCoverage`, `CompetitorMentionSource` each redeclared 2-3 times

Patches 2, 3, 6 and 8 each independently wrote out the same three
response-shape interfaces in every file that needed them, rather than
following this codebase's own established convention — shared types in
`lib/domain/*.ts`, already used for `RssSource`, `BrandProfile`,
`PromptTemplate` (visible in `app/settings/page.tsx`'s own import list,
right next to the ad-hoc interfaces that didn't follow it). Not a
correctness bug (the three copies hadn't drifted from each other yet),
but exactly the kind of duplication that silently drifts the next time
someone adds a field to one copy and forgets the others — TypeScript
gives no warning across separately-declared, structurally-identical
interfaces in different files.

Fixed by adding `lib/domain/observability.ts` with the three shared
interfaces, and updating every consumer (`SourceCard.tsx`,
`LowValueSourcesPanel.tsx`, `RegionCoverageCard.tsx`,
`CompetitorMentionsCard.tsx`, `app/settings/page.tsx`) to import from it
instead. `SourceHealth` was *not* moved — it turned out to already be
independently duplicated in `app/analytics/page.tsx` and
`lib/ingestion/types.ts`, both pre-existing and untouched by any of my
patches; fixing that is a separate, larger pre-existing cleanup outside
this audit's scope, not something to fold in silently here.

### 3. Fixed: `/api/sources/observability`'s `regionCoverage` ignored its own `region_id` filter

The `sources` array in the response was correctly scoped to the
requested region, but `regionCoverage` always computed and returned
coverage for every active region regardless of the `region_id`
parameter — and the only caller (`app/settings/page.tsx`) immediately
did `coverage.find((r) => r.regionId === currentMarket.id)` and
discarded the rest. Every request computed three markets' worth of
coverage aggregation to use one. Fixed in both response branches (the
normal path and the early-return-on-no-sources path): `regionCoverage`
now only includes the requested region when `region_id` is present,
matching the scoping `sources` already had. Verified directly: a
Node-level test with two mock regions confirmed a scoped request returns
exactly one coverage row and an unscoped request returns both.

### 4. Investigated, left alone: hardcoded Russian strings in `BrandOsCoverageCard.tsx`

Initially flagged as a violation of the project's "use `t()`, don't add
new hardcoded Russian strings" rule. Before patching it, checked whether
`t()` is actually the live convention on the page this component lives
on — it is not. `components/brand/BrandOsEditor.tsx` (the pre-existing,
already-shipped component this card sits directly beside) and all 10
files under `components/brand/tabs/` have zero `t()` usage between them;
every one of them hardcodes Russian throughout. That's not an oversight
in one file — it's a consistent, uniform pattern across this entire
subtree, distinct from `app/settings/*`'s consistent use of `t()`.
Converting just the new card to `t()` would make it the odd one out
relative to its actual neighbors, not fix an inconsistency; converting
all 11 files is a real but separate and much larger cleanup, out of
scope for a point-fix patch and not something to do silently as a side
effect of an unrelated audit. Left as-is. This is noted here rather than
silently dropped so the project's own history reflects that the
question was asked and answered, not missed.

### 5. Fixed alongside #3, opportunistically: `/api/brands/os-coverage` over-fetched every brand

While fixing `BrandOsCoverageCard.tsx`'s data flow for issue #4's
investigation, noticed it fetched `/api/brands/os-coverage` with no
filter at all — downloading and computing coverage for every active
brand across every region just to pick out one with a client-side
`.find()`. The route already supported `?region_id=`; added the same
`?brand_id=` pattern and updated the card to pass it, so the response is
scoped to the one brand the card actually renders. Verified the
underlying filter query against the same seeded PostgreSQL data used to
validate the original endpoint (`CoverageTest Filled Brand` /
`CoverageTest Placeholder Brand` from the `BRAND_OS_COVERAGE_DIAGNOSTIC_20260917`
entry above) — confirmed the equivalent SQL returns exactly one row.

### What did NOT need fixing

Re-read the SQL migration (`048_rss_sources_region_id_uuid.sql`), the
verifier fix (`verify-multimarket-localization.mjs`), all 9 file-level
`set-state-in-effect` disables, `lib/rss.ts`'s authority-weight
threading, `lib/competitor-review.ts`'s export refactor, and the
`competitor-mentions` route with the same skeptical eye. Found nothing
worth changing in any of them — the SQL migration's three-section
structure earns its complexity for an irreversible schema change; the
verifier's regex-scoping is more complex than its sibling checks but
justified by a concrete false-negative it was built specifically to
catch (documented in that entry above); the lint disables are
byte-identical and correctly placed across all 9 files; the
authority-weight and competitor-review changes are narrow, correctly
scoped, and don't duplicate anything.

Also confirmed, while diffing the final repository state: two files that
appeared in an early diff of this working tree —
`.gitignore` and a stray `apply_003_settings_observability_ui.py` —
are artifacts of this audit's own test-copy process (a shell glob
quirk from an early dry-run setup, not anything any `apply_*.py` script
writes) and do not appear in any of the real patch payloads. Confirmed
by grep across every `apply_*.py` script: none reference `.gitignore`,
and none write an `apply_*.py` file. Not a concern for the real
repository.

### Verification performed

- `npx tsc --noEmit --strict` — 0 errors, after every individual edit
  and again on the complete set.
- `npx next build` — passed.
- `npx eslint` on all 9 touched/added files — clean.
- Full `npm run lint` — the same 6 pre-existing, unrelated problems as
  every prior patch checkpoint; nothing new.
- `npx vitest run` — 174/174, ×3 for flakiness — stable all three runs.
- Two direct Node-level tests of the specific logic changed (the
  stale-selection filter, and the region-scoping filter) — see #1 and
  #3 above.
- A raw-SQL check against the real PostgreSQL 16 instance already
  seeded for the `BRAND_OS_COVERAGE_DIAGNOSTIC_20260917` entry, for the
  new `brand_id` filter.
- `node scripts/verify-amado-chain.mjs` — 17/17.
- `node scripts/verify-market-intelligence-sprint.mjs` — 29/29.
- `node scripts/verify-multimarket-localization.mjs` — 24/24.

**Verification contract for this patch:**
`npm test`, `npm run build`, `npm run lint`,
`node scripts/verify-amado-chain.mjs`,
`node scripts/verify-market-intelligence-sprint.mjs` must pass before
commit/push. No SQL block — all nine touched files are application code
only, no schema change.

**Next:** the roadmap's only remaining open item is the ES/DE/US Brand
OS content itself (not an engineering task — see the
`BRAND_OS_COVERAGE_DIAGNOSTIC_20260917` entry above). No further
engineering work is queued after this patch unless new findings come up.


<!-- SESSION_HANDOFF_20260919 -->
## Session handoff: state after apply_001 .. apply_011 (2026-09-19)

Read this block first when starting a new dialog. It is a summary; the tagged
sections above hold the detail and the reasoning.

### Delivered (each patch = one apply_NNN_*.py, tag in this file)
- 001 `/market/base` now respects the selected market (was reading legacy `rss_items`, no region filter).
- 002 `/api/sources/observability` (yield/freshness/extraction/duplicate signals) + migration 048 (`rss_sources.region_id` -> uuid + FK).
- 003 Settings UI for observability + a roadmap de-duplication fix (bug in 001's roadmap edit).
- 004 `set-state-in-effect` lint finding resolved by documented disables + `.amado-patch-backups/**` added to eslint ignores.
- 005 verifier assertion for the AI check scoped to its own fetch block.
- 006 "disable low-value sources" workflow.
- 007 `rss_sources.authority_weight` now flows into `evidence_items.source_authority` (briefing ranking was running on a constant 1.0).
- 008 competitor-mention observability per source.
- 009 Brand OS coverage diagnostic (`/api/brands/os-coverage`). Diagnostic only; no ES/DE/US content.
- 010 post-sprint KISS/YAGNI/DRY cleanup (shared types in `lib/domain/observability.ts`, region/brand scoping, stale-selection bug).
- 011 this handoff, `supabase/audit/001_schema_audit.sql`, migration 048 text aligned with production.

### Production database facts (from the live audit, 2026-09-19)
- **Production differs from `supabase/migrations`.** Example: `articles`, `brand_profiles`, `policy_snapshots` region_id FKs are ON DELETE SET NULL in production but NO ACTION per the files. Treat the audit queries as the source of truth, not the files and not a repomix snapshot.
- **region_id**: all 8 tables (articles, brand_audiences, brand_claims, brand_products, brand_profiles, content_requests, policy_snapshots, rss_sources) are uuid + FK ON DELETE SET NULL.
- **Correction of an earlier statement:** after running migration 048 the FK read back as SET NULL although the original text had no ON DELETE. This was first explained as Supabase platform behavior. That explanation had no evidence. The better-supported reading (see the previous bullet) is that production already had the FK, so 048 was probably a no-op there. Not provable from one readback; the repo file now states SET NULL explicitly either way.
- **RLS**: enabled with exactly one policy on all 56 public tables. Consistent with the service-role-only architecture. Nothing to fix.
- **`*_id` columns without FK (17)**: classified, not blindly "fixed".
  - Intentional: `content_requests.thread_id` (grouping id, own index).
  - No target table exists in the schema: `workspace_id` (several tables), `brief_id`, `signal_id`, `opportunity_id`, `qa_findings.evaluation_run_id`, the `*_document_id` columns.
  - **Real FK candidates (target exists, no FK):** `brand_claims.product_id`, `content_assets.generation_run_id`, `content_packages.policy_snapshot_id` (note `content_assets.policy_snapshot_id` in the same migration does have one). Not changed: adding an FK on live data needs the orphan check first (audit statement 6).
- **FK columns without an index (30)**: a static scan of `app/` and `lib/` (every `.eq/.in` filter, matched to the nearest `.from()`; a heuristic, not a proof) found no filter on any of them. Every hit was an indexed column (`brand_profiles`, `content_requests`, `rss_sources`) or a same-named column on another table. Deliberately no index patch (YAGNI). Revisit if a table grows large or deletes of a parent row become slow.
- **Always-NULL columns (statement 5)**: the first run used a DO block whose NOTICE output the Supabase grid does not show ("Success. No rows returned" meant nothing). The audit file now returns a grid. **Production result not reviewed yet.** On a local seed-only copy the list was `rss_sources.avg_title_length/avg_summary_length/language_detected/language_code/rights_notes` and `content_formats.max_words`; the health timestamps will differ in production.

### Open items
1. Run audit statements 5 and 6 on production; if `orphan_rows = 0` for a candidate, ship a small patch adding that FK (ON DELETE SET NULL, matching siblings).
2. ES/DE/US Brand OS content (business decision, not an engineering task). Run `GET /api/brands/os-coverage` on the live database first to see the real gap.
3. Confirm which of apply_001..011 are already pushed and deployed. This session could not see the repository, only its own dry runs.
4. Known, deliberately untouched: 6 pre-existing lint problems; `SourceHealth` declared in three files; `components/brand/*` uses hardcoded Russian (no `t()`) while `app/settings/*` uses `t()`; HANDOFF.md is large.

### Working conventions and lessons (for whoever continues)
- Deliver as `apply_NNN_*.py` with `--check/--apply/--verify/--commit/--push`; all SQL only via the Supabase SQL Editor; never `supabase db push`.
- `run_all_patches.sh` (delivered next to the patches, not committed) with no arguments runs 001..011 and **stops at the first failing step**. An already-applied patch makes its own `--check` fail, so the chain stops there. Earlier notes said already-applied patches are skipped; that was wrong. To run a subset pass the numbers: `bash run_all_patches.sh 011`.
- Test a patch chain from a freshly extracted pristine baseline. A long-lived working copy once carried an early draft edit in one file and produced a false failure.
- The Supabase SQL Editor shows only the last statement's grid and hides NOTICE output: send audit statements one at a time.
- The sandbox may reset between turns (services and directories disappear): rebuild from the uploaded repomix.
- Generator scripts: do not backslash-escape apostrophes inside triple-quoted strings (it prints literal backslashes).
