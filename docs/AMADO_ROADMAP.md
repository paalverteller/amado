# Amado — Lean AI-first roadmap (sprint tracker)

Source plan: `AMADO_LEAN_AI_FIRST_IMPLEMENTATION_PLAN_EN.md` (9 phases) +
`design.md` (target visual system). This file is the living cross-session
handoff for that plan — update the checkboxes as sprints land, the way
`HANDOFF.md` tracked the repository-layer refactor on the previous
workstream.

## Architecture decision (read this first)

The current schema (see `docs/SCHEMA.md`) is **more complex** than the lean
plan's target — it already contains a guideline compiler, policy-conflict
graph, and learning tables the plan explicitly says to defer. Decision:
**strangler-fig, not rewrite.** Existing Brand OS / QA / playbooks / learning
machinery stays as-is; new lean-plan modules (Overview, Knowledge-v2,
Competitors, manual Performance) are built fresh alongside it. Revisit this
decision explicitly before any sprint that would delete existing tables.

## Sprint status

- [x] **Sprint 1 — Russian workspace shell (foundation)**
  Russian i18n dictionary (`lib/i18n/config.ts`, `ru` now default),
  nav restructured to Обзор / Рынок / Генерация / База знаний / Бренд /
  Конкуренты (+ utility row: Идеи / Переписать / История / Настройки),
  `/overview` `/knowledge` `/competitors` route shells, post-login redirect
  → `/overview`, vitest + a real Russian-parity regression test,
  `docs/SCHEMA.md` schema audit. No deletions, no data migrations.

- [x] **Sprint 2 — Design system migration**
  Decision made: left sidebar (240px, design.md §3), structural rewrite of
  `components/Layout.tsx`. Fixed a Sprint-1 bug along the way — the --v2-
  tokens had been written to `styles/design-tokens.css`, which nothing
  imports; moved into `app/globals.css` (live) and deleted the dead file.
  Inter was already the active `--font-sans` pre-Sprint-1, no font work
  needed. Deliberately NOT done: recoloring the M3 tokens
  (`--color-primary` etc.) that every pre-Sprint-1 page still uses via
  `m3-card`/`m3-button-*`, and no separate desktop topbar row (logout
  lives in the sidebar footer instead). Both are fair follow-ups, not gaps.

- [x] **Sprint 3 — Text-first knowledge library (Phase 2)**
  `knowledge_assets`/`knowledge_chunks` + pgvector + match_knowledge_chunks
  RPC (migration 038, additive — books/book_chunks untouched, existing
  books migrated in as 'pending'). Chunking/language-detection logic was
  executed and tested, not just written. Embeddings gated behind the
  pre-existing `hybridSearchEnabled` flag — keyword search works even
  without OPENAI_API_KEY configured. `/knowledge` now has a real upload/
  search/list UI. Wired into `/generate` in Sprint 8.
  ⚠️ pgvector migration needs verification against a real Supabase
  instance — it's the one part of this sprint that couldn't be executed
  locally.

- [x] **Sprint 4 — Editable Brand workspace (Phase 3) — done**
  Actual tab count is 10, not 9. Part 1: fixed two real bugs
  (`overview` route and `playbooks/generate` route both queried a
  `brands` table that has never existed — `brand_profiles` is real;
  the Overview tab 404'd on every load until this fix), added the
  missing `GET /api/brands` list endpoint (brand selector was
  hardcoded to one option), added rule-set publish/restore
  (`POST .../rule-sets/[id]/publish` — previously impossible through
  either the API or UI, confirmed by reading the route), wrapped
  `/brand` in `<Layout>` (it never was, invisible to the sidebar nav
  even after Sprint 1 added it to NAV_PRIMARY), translated the shell
  + Overview + Versions tabs to Russian.
  Part 2: the remaining **8** tabs (AudiencePains, ProductsClaims,
  VoiceVocabulary, ContentPillars, PlatformPlaybooks, Examples,
  Compliance, GuidelineImport) translated to Russian — previous entry
  in this file undercounted at 7, GuidelineImportTab was missed.
  Write-capability audit (grepped for POST/PATCH/PUT/DELETE fetch
  calls across all 8): only GuidelineImportTab writes anything
  (guideline import + publish-approved-rules); the other 7 are
  read-only display, confirmed by absence of any write call, same
  as Versions was pre-Sprint-4. Enum values that were rendered raw
  (riskLevel, claimType, policy, severity, status) now go through a
  label map, same pattern OverviewTab already used for ruleSetStatus.
  UI-chrome dates switched `pt-BR` → `ru-RU` locale to match
  VersionsTab precedent (generated marketing content stays pt-BR
  project-wide — this only affects interface chrome).
  Tab consolidation decision (10 vs the plan's 9 named sections):
  **decided — keep the current 10, translate only, no restructuring.**
  Two known gaps intentionally left as-is, not fixed inside this
  translation-only pass: `Pillar.defaultProductExplicitness` and
  `Product.productRole` are free-text `string` fields with no known
  enumerated value list in this codebase snapshot, so their badges
  stay untranslated pass-through rather than risk mistranslating a
  value never seen yet; and several tabs (e.g. ContentPillars) render
  nothing for zero-rows rather than an empty-state message — pre-existing
  in the Portuguese version too, not introduced here.
  Still open: brand_documents / brand-vs-knowledge-base linking (plan
  §8.2) — doesn't exist yet, natural pairing with Sprint 3's
  knowledge_assets now that it exists. Not blocking Sprint 5.

- [x] **Sprint 4B — Migration hygiene (infra, done alongside Sprint 4)**
  Found `supabase/migrations/clean_history.sql` — an unprefixed,
  unguarded `DELETE FROM articles;` that sorts *after* all 38 numbered
  migrations on any filename-order replay (fresh `supabase db reset`,
  new preview branch, disaster recovery). Archived this plus 14 other
  undated pre-numbered-scheme files (`add_rss_sources.sql`, `ensure_*`,
  `final_rebuild.sql`, `fix_*`, `seed_*`, `sprint1/2/3_00X_*`) to
  `supabase/migrations_archive/legacy/` — not deleted, excluded from
  future replay. Did not touch the duplicate-prefixed `022_*`/`023_*`
  pairs (both legitimate, already-applied, documented migrations —
  cosmetic numbering collision only, renumbering risks desyncing
  Supabase's migration tracking table).

- [x] **Sprint 5 — Safer source ingestion hardening (Phase 4) — done**
  Part A: `/api/sources/health` now surfaces `lastErrorMessage` /
  `lastResponseTimeMs` (already recorded in `source_health_events`, never
  exposed before); `SourceCard` shows a health badge + last error + a
  "Проверить" button wired to the pre-existing but previously unused
  `POST /api/sources/[id]/test`; translated `SourceCard.tsx` to Russian
  (was 100% pt-BR, not covered by the `t()` i18n system). Manual sources
  actually work now: `fetchAndSaveRss` used to silently run `manual`-type
  sources through the RSS-parser → HTML-scraper fallback (no branch for
  `manual` existed) — now it's a real no-op, and `saveManualItem` +
  `POST /api/rss/[id]/manual-item` + a paste-text form on `SourceCard`
  let a person add a title + full text (+ optional URL) directly, no
  fetch involved. Doubles as newsletter ingestion via manual-forward.
  Migration `039_evidence_full_text.sql` added `evidence_items.full_text`
  (plain column — `full_text_storage_ref` from migration 024 pointed at
  an external store that was never built and nothing ever wrote to
  either column). Found and removed a real security-relevant piece of
  dead code: `app/api/scrape/route.ts` was an unauthenticated POST
  endpoint doing a server-side fetch of any URL in the request body
  (SSRF-shaped), zero callers anywhere in the app. Deleted, along with
  its only consumer `lib/firecrawl.ts`. `lib/web-reader.ts` (the one
  actually used, in the RSS→HTML fallback path) was already gated off
  by default — kept, untouched.
  Part B: decision made — hydration runs **automatically in cron for
  every active source, every run**, accepting the real per-call API cost
  once a key is configured. `saveRows()` now calls `readUrlAsText()` per
  item and saves the result as `evidence_items.full_text`, gated by
  `INGESTION_CONFIG.hydrationEnabled` (env `AMADO_HYDRATION_ENABLED`,
  kill switch, no redeploy needed) and a shared per-run budget
  (`AMADO_MAX_HYDRATION_PER_RUN`, default 40, resets once per cron/collect/
  test invocation via `resetHydrationBudget()`). Runs concurrently per
  source (`Promise.allSettled`, rows already capped ≤6/≤15 upstream) so
  hydration can't multiply the outer per-source loop's wall-clock time.
  Fixed a pre-existing double-fetch along the way: `html_index` sources
  already called `readUrlAsText()` once per article to build a
  description — that result is now reused instead of fetched twice.
  Also wired up `maxItemsPerSource`/`maxSnippetChars`/`sourceTimeoutMs`,
  which `amado-config.ts` already declared as env-configurable but
  `lib/rss.ts` silently ignored in favor of hardcoded local constants.
  `GET /api/market?q=<term>` — full-content search over `evidence_items`
  (title/summary/full_text), three `ilike()` queries merged in JS rather
  than a raw `.or()` filter string, to avoid the search term needing
  escaping against PostgREST's own filter syntax. No UI wired to it yet
  — `/market` is a legacy pre-lean-plan page and its future (possibly
  superseded by Sprint 6's Overview) is a separate open question, not
  part of this decision.
  **Post-delivery hotfix**: `/api/market/refresh` (the route Vercel's
  cron actually schedules — `/api/cron/rss` and `/api/rss/collect` are
  NOT in `vercel.json`) had its own independent concurrent-fetch
  implementation that was missed when `resetHydrationBudget()` was
  added elsewhere — on a warm serverless container this would have
  silently starved hydration after the first run, no error, no log.
  Also found (separately, during a script-clobbering repair): part A and
  part B's delivery scripts both independently rewrote `lib/rss.ts` in
  full, so applying them out of order silently dropped whichever ran
  first — root-caused and fixed with one consolidated script covering
  the full union of both, tested against the exact reported broken state
  before redelivery.

- [x] **Sprint 6 — Overview and briefing (Phase 5) — done, unverified against §2.1–2.3**
  `AMADO_LEAN_AI_FIRST_IMPLEMENTATION_PLAN_EN.md` isn't in this repo
  snapshot, so §2.1–2.3's exact "task modes" spec wasn't available —
  built from this entry's own feature description instead (ranked items
  + why it matters + useful/irrelevant + send-to-generation) plus what
  already existed in the codebase. **Flag if this doesn't match the
  actual plan.** Migration `040_briefing.sql`: `briefing_runs` (one row
  per calendar day, idempotent — re-running a `ready`/`empty` day is a
  no-op; a `failed`/stuck row is retried via an atomically-claimed status
  transition, closing a race where two near-simultaneous invocations
  could otherwise both regenerate and corrupt each other's items) +
  `briefing_items` (rank, AI-written `why_it_matters`, `feedback`,
  `sent_to_generation_at`), linked to Sprint 5's `evidence_items` rather
  than duplicating its data. `lib/briefing.ts` — "one agent, task modes"
  interpreted as one sequential pass, two stages, **one** AI call total
  (not one call per item — that's N× the cost for no ranking benefit):
  Stage 1 heuristic DB select (last 48h, ordered by `source_authority`
  then recency, no AI, free) → Stage 2 a single
  `generateArticleWithFallback` call that ranks the shortlist AND writes
  `why_it_matters` for each item together, parsed defensively (malformed
  entries dropped, not fatal). `GET /api/cron/briefing` (scheduled
  10:00 UTC in `vercel.json`, one hour after `market-refresh`),
  `GET /api/briefing`, `PATCH /api/briefing/items/[id]`.
  `app/overview/page.tsx` rewritten: ranked list, feedback toggle, send-
  to-generation wired to `/generate`'s existing `topic`/`context` query
  params (checked the actual page code before wiring, not assumed).
  Replaces the Sprint-1 empty state, which still shows for a not-yet-run
  or empty day.
  **Bug found and fixed in Sprint 7**: `why_it_matters` was being
  generated in Portuguese — wrong convention. It's UI-facing analysis
  text for the Russian-speaking team reading the Overview page, not
  generated marketing content for the Brazilian audience (two different
  language conventions in this project; the wrong one was applied here).
  Fixed to request Russian output; source material (titles/content from
  evidence_items) stays pt-BR since that's genuinely what the sources say.
  Not built: admin UI for briefing history / manual re-trigger from the
  app — didn't want to guess where that should live.

- [x] **Sprint 7 — Competitor intelligence (Phase 6) — done**
  `competitors` table (name/website/notes/status, scoped to `brand_profiles`).
  Confirmed the roadmap's own note in practice: competitor content sources
  are ordinary `rss_sources` rows tagged via a new `competitor_id` column
  (`source_category = 'competitor'`) — RSS/newsletter/changelog/manual all
  already worked since Sprint 5, nothing new built for ingestion itself.
  AI reviews reuse Sprint 3's knowledge library the same way: a new
  `competitor_id` column on `knowledge_assets`, `content_type =
  'competitor_note'` (that check value was already sitting unused in
  migration 038 — clearly anticipated, never wired up until now), written
  via `generateArticleWithFallback` from 30 days of the competitor's
  evidence (longer window than the daily briefing's 48h — positioning
  shifts show up over weeks) and saved through the existing knowledge
  repository + `processKnowledgeAsset()`, so reviews are chunked/embedded/
  searchable for free. `GET/POST /api/competitors`,
  `GET/PATCH/DELETE /api/competitors/[id]` (detail bundles sources + latest
  review in one response), `POST /api/competitors/[id]/review` — on-demand
  only, no cron. Review cadence wasn't specified in the roadmap and felt
  like a genuine product question (unlike Sprint 6's hydration trigger,
  which was asked explicitly) rather than something to default into a
  recurring-cost cron unasked. `app/api/rss/route.ts` extended to accept
  `competitor_id`/`source_category` — same creation endpoint Settings
  already uses, no parallel path. `app/competitors/page.tsx` rewritten,
  replacing the Sprint-1 stub.
  Also fixed two issues found in Sprint 6 while building this:
  `lib/briefing.ts`'s `why_it_matters` was being generated in Portuguese —
  wrong convention (it's UI-facing analysis for the Russian-speaking team,
  not generated marketing content for the Brazilian audience); switched to
  Russian output while evidence source material stays pt-BR. And
  `app/overview/page.tsx` referenced a CSS token, `--v2-color-error`, that
  doesn't exist in `globals.css` (`--v2-color-danger` is the real one) —
  had a hardcoded fallback so it wasn't visibly broken, fixed anyway.

- [x] **Sprint 8 — Generation workspace unification (Phase 7) — done**
  Investigated the actual `/generate` pipeline before writing anything:
  `lib/content-generation/generate-article.ts` already had a real
  `content_requests` + `evidence_items` pipeline (migration 025), just
  with two gaps — `buildBrandVoiceLayer` only read the old 5-field
  `brand_profiles` text columns, never Sprint 4's structured Brand OS
  tables; and `knowledge_chunks` (Sprint 3) / competitor reviews
  (Sprint 7) were never queried at all.
  New `lib/brand-snapshot.ts` compiles `brand_audiences`,
  `brand_pain_points`, `brand_products`, `brand_claims`, `brand_terms`,
  `brand_content_pillars`, and active `brand_rules`
  (`hard_block`/`forbidden`/`required` only) into the prompt, plus a flat
  fact list for the transparency UI. Deliberately not included:
  `format_playbooks`/`approved_examples` — format-to-platform matching
  added real scope, kept this pass to voice/audience/compliance. Falls
  back to legacy `voice_description` text for brands with no structured
  data yet.
  New `buildKnowledgeContext` in `lib/prompts.ts` calls the same search
  repository `/api/knowledge/search` uses, no `retrievalMode` filter —
  which means Sprint 7's competitor reviews surface in the same
  retrieval as general knowledge documents, since they're already the
  same table. One call covers both "Knowledge retrieval" and "Competitor
  context" from this line.
  Migration 042: `thread_id`/`parent_request_id` (refinement chain) +
  `knowledge_chunk_ids`/`brand_snapshot_summary` (what was actually used)
  on `content_requests`. Refining a generation pulls the parent's
  `generated_content` into the prompt as "revise this, don't restart".
  `usedContext` (Cyrillic brand-fact labels) travels back to the client
  via a stream metadata line (`m:`), not a response header — headers
  can't safely carry non-ASCII text. `/generate` gained a collapsible
  "Использованный контекст" panel, a "Уточнить версию" refine box, and a
  version-history list within the thread — added in Russian per site
  convention; the page's existing Portuguese UI text was left untouched
  (a full translation of `/generate` is a separate, larger task this
  sprint didn't ask for).
  Not done: `app/api/generate/batch/route.ts` (bulk generation) still
  uses the old `buildBrandVoiceLayer` — didn't want to duplicate the
  same upgrade across two independent files without being able to test
  both against a live DB.

- [x] **Sprint 9 — Manual performance & feedback (Phase 8) — done**
  Found this was mostly a bridging + repair job, not new infra:
  `performance_snapshots`/`content_pattern_usage`/`preference_profiles`
  already existed (migration 036, an earlier sprint) with a genuinely
  well-designed metrics shape — but `performance_snapshots.asset_id`
  pointed only at `content_assets` (the separate `content_packages`
  system), which nothing in the real generation pipeline
  (`articles`/`content_requests`, used since Sprint 1) ever creates rows
  in. Structurally unreachable from actual generated content.
  Worse: `app/api/brands/[brandId]/learning/route.ts` — the only code
  touching these tables — referenced columns that exist on none of them
  (`performance_snapshots.metrics`/`period_start`/`format`,
  `content_pattern_usage.usage_count`/`pattern_key`,
  `preference_profiles.preference_type`/`weight`). Every call would have
  500'd. Grepped for callers: zero — never actually exercised. Rewrote
  it against the real schema rather than altering the tables to match
  the broken route.
  Migration 043: `asset_id` relaxed to nullable, `article_id`/`brand_id`
  added (the actual bridge), `ai_hypothesis`/`ai_hypothesis_model`/
  `ai_hypothesis_generated_at` kept as separate columns from the metrics
  themselves — a stored number can't be confused with an AI guess by
  construction. `lib/performance-hypothesis.ts` generates one hypothesis
  per snapshot on demand (not automatic), prompted explicitly for
  hedged/falsifiable language ("возможно", "похоже, что"), never a
  causal claim; surfaced in `/history/[id]` as "Предположение ИИ" with an
  explicit not-a-fact qualifier next to it, not just a label.
  `POST/GET /api/articles/[id]/performance` — manual entry, tied to a
  real article; recording a snapshot flips the article to `published`.
  Learning-loop constraint (plan §11.4, no automatic Brand OS rewrites)
  held **by construction**, not just convention: the rewritten learning
  route's POST records exactly one thing — an explicit, human-typed
  preference signal (`profileType`/`patternKey`/`patternValue`, "this
  worked, remember it") — and nothing anywhere in this delivery writes
  to `brand_claims`/`brand_terms`/`brand_rules`/any governance table
  automatically.
  Caught by the sandbox test, not assumed correct:
  `lib/performance-hypothesis.ts` had a real syntax error — a JSDoc
  comment containing the literal text `api/*/preference-signal`
  accidentally closed itself early at the embedded `*/`, cascading into
  several unrelated-looking parser errors below it.
  Not done: `content_pattern_usage` (hook_type/structure_pattern/etc. —
  richer content categorization) isn't wired up — needs a content-tagging
  UI/taxonomy this sprint doesn't have yet.

- [x] **Sprint 10 — Hardening (Phase 9) — done, last sprint on the roadmap**
  Auth was the real finding here: `app/api/auth/route.ts` already set a
  password cookie with a comment saying "so middleware can verify it" —
  but no `middleware.ts` existed anywhere in the codebase. **First
  attempt at this got it wrong**: added `middleware.ts`, missing that
  this project already had `proxy.ts` (Next.js 16 renamed the
  middleware convention) with a complete, working implementation
  predating every sprint of this engagement. Next 16 refuses to build
  with both files present — caught from the real `next build` error,
  fixed by deleting `middleware.ts` and adding the one genuinely new
  piece (a `CRON_SECRET` bearer-token bypass, needed because
  `cron/market-refresh`'s internal fetch to `/api/market/refresh` has no
  way to pass the cookie check) to the real `proxy.ts` instead. Lesson:
  should have searched for "next.js 16 middleware rename" or grepped for
  *any* file matching `proxy.ts`/`middleware.ts` before concluding
  nothing existed — searched only for the name I assumed was current.
  Workspace separation: **not built** — no user/session model exists
  anywhere (one shared password, not per-user), and inventing
  multi-tenancy unasked inside a hardening pass isn't right; flagged as
  a product decision. RLS: reviewed, not deepened — confirmed zero
  client-side Supabase usage anywhere, so 100% of data access goes
  through the service-role key server-side, which bypasses RLS
  regardless of policy content. `proxy.ts` is the real access boundary;
  tightening `allow_all` policies with no per-user session to key them
  off of would be theater, not hardening.
  Retry logic / model fallback: reviewed, judged adequate — multi-model,
  multi-provider fallback with quota-cooldown tracking already existed
  (`lib/ai.ts`); `maxRetries: 0` on the SDK call is deliberate (fail
  fast to the next model rather than burn function time retrying a
  degraded provider). No code changes needed there.
  Cost limits: new — migration 044's `ai_usage_log` +
  `lib/ai-usage.ts`. `recordAiUsage()` wired into every AI-calling
  feature (generate, briefing, competitor reviews, performance
  hypotheses, the legacy auto-generate cron). `checkDailyAiBudget()` (a
  24h rolling call-count cap) wired only into `lib/briefing.ts`
  (cron-triggered, safe to skip a day) — deliberately not into
  `/api/generate` or on-demand competitor reviews, where a silent budget
  block would be a confusing product regression for a human-initiated
  action, not a safety win.
  Scheduled task logs: new, additive — `ingestion_runs`/`briefing_runs`
  already logged their own domains in real detail; `cron_runs` +
  `lib/cron-log.ts` is a thin generic "did it run" layer wired into all
  5 cron routes on top of those, not instead of them.
  E2E test: scaffolded, **not executed** — no Playwright existed in this
  project and no live dev server/Supabase/AI keys were available to test
  against. Added `@playwright/test`, `playwright.config.ts`,
  `e2e/core-journey.spec.ts` covering this line's own journey (Overview →
  Market → Knowledge → Generation → Review → Manual Performance), every
  selector checked against real page source rather than guessed — but
  "matches the code" and "passes against a live stack" are different
  claims, only the first is made.
  **Post-delivery hotfix**: real `next build` output caught the
  middleware/proxy conflict above, plus two real TS errors —
  `result.usage.promptTokens`/`completionTokens` don't exist on AI SDK
  v6's `LanguageModelUsage` (renamed to `inputTokens`/`outputTokens`;
  this project is on `ai@^6`), and `BriefingRunResult` (a named
  interface, no index signature) isn't structurally assignable to
  `finishCronRun`'s `Record<string, unknown>` param even with matching
  fields — fixed by spreading into a plain object at the call site. Also
  fixed a real (self-introduced) `exhaustive-deps` warning on
  `loadSnapshots` in `app/history/[id]/page.tsx`.

## Open questions awaiting a decision (not blocking, but don't forget)

- **`/api/cron/auto-generate`** (found during Sprint 6 prep): scheduled
  daily 06:00 UTC in `vercel.json`, still active. Pulls a random chunk
  from `book_chunks` (leftover from the pre-pivot psychology-book
  product) and auto-inserts a generated draft article into `articles`.
  Unrelated to the current Brazil-marketing product — if this is
  deployed, a stray article lands in the DB every day. Not disabled
  pending an explicit go-ahead (strangler-fig: don't remove active
  behavior without a decision, even for legacy-looking code).
- **`handsoff.md`** (found in the initial repo audit, before Sprint 4):
  a separate handoff document written for ChatGPT sessions, not this
  one. Describes a "Sprint 5 — grounded generation" as implemented
  (migration `039_grounded_generation.sql`, `knowledge_chunk_ids` /
  `generation_context` / `brand_snapshot` columns on `content_requests`)
  that was verified NOT to exist anywhere in the actual codebase at the
  time — likely aspirational or from a diverged session that was never
  merged. Left untouched (not this file's job to edit), but if anyone
  opens a new ChatGPT session from its stored prompt, it will assume
  functionality that doesn't match `main`. Worth reconciling or
  retiring at some point.
- **Doc-commit discipline** (found while writing `HANDOFF.md`, after
  Sprint 10): this file's own updates were delivered to the person as a
  raw artifact each sprint ("overwrite `docs/AMADO_ROADMAP.md`") but
  were only actually committed in the delivery sandbox when a
  *later* sprint's script happened to run `git add -A` and sweep up the
  still-uncommitted edit. Sprint 10 had no following sprint to do that
  sweep, so its update — and, it turned out, Sprints 4/5/6's updates and
  this very section — were sitting uncommitted and got silently
  discarded by an unrelated `git reset --hard` during hotfix testing.
  Rebuilt from the original authored text and verified against `git
  show` this time. If a future session finds this file looking
  suspiciously terse for a sprint that was clearly described as done in
  conversation, this is why — check the actual commit, not just the
  working tree.

## Explicitly deferred (plan §15 — do not build without a product conversation)

Twelve-agent architecture · DOCX/PDF/PPTX/OCR parsing · automatic policy
conflict graph beyond what already exists · page-snapshot diff for
competitors · protected social scraping · automatic social analytics ·
direct social publishing · automatic Brand OS learning · autonomous
campaign decisions.