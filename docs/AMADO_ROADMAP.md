# Amado — roadmap

Last consolidated: 2026-09-10.

This file contains only remaining work. Completed implementation history belongs in Git, `HANDOFF.md`, and `docs/fable-review.md`.

## Immediate next work

### 0. Repo-wide `react-hooks/set-state-in-effect` cleanup (closed 2026-09-12)

- `npm run lint` reported this error on 9 files that all shared the same
  early-return guard-clause shape in a market-scoped `useEffect`
  (`app/market/page.tsx`, `app/market/base/page.tsx`, `app/ideas/page.tsx`,
  `app/brand/page.tsx`, `app/competitors/page.tsx`,
  `app/generate/seo/page.tsx`, `app/localize/page.tsx`,
  `app/settings/page.tsx`, `components/MarketSwitcher.tsx`), plus one more
  file with a different shape (`components/brand/tabs/PlatformPlaybooksTab.tsx`,
  calling a memoized async loader from an effect).
- Resolved with the same convention already established elsewhere in this
  codebase (`app/generate/page.tsx`'s file-level disable;
  `components/brand/tabs/ExamplesTab.tsx` and siblings' per-line disable):
  a documented `eslint-disable` — file-level for the 9 guard-clause files,
  per-line for `PlatformPlaybooksTab.tsx` matching its sibling brand-tab
  files — each citing
  [facebook/react#34743](https://github.com/facebook/react/issues/34743).
  Not a code restructure: React's own team has not shipped a
  non-"code smell" pattern for "reset state and abort when a required
  prerequisite (market/brand) isn't ready yet" as of `eslint-plugin-react-hooks@7.1.1`;
  the documented alternatives on the rule's own page
  (`startTransition`/`setTimeout` wrapping) are explicitly called a "code
  smell" in that same GitHub thread.
- Confirmed via a full lint diff that no other finding changed — the same
  8 pre-existing, unrelated warnings/errors remain exactly as they were
  (`app/analytics/page.tsx`, `app/api/prompts/route.ts`,
  `app/api/rss/route.ts`, `components/ui/AugustDialog.tsx`,
  `lib/i18n/config.ts`, and one `react-hooks/exhaustive-deps` warning on
  `app/market/page.tsx` unrelated to this rule).

### 0b. Loosen the brittle "AI check follows selected market" verifier assertion (closed 2026-09-13)

- `scripts/verify-multimarket-localization.mjs` string-matched
  `generatePage.includes('regionId: currentRegionId || undefined')`
  against the whole file. The actual call site passes
  `regionId: currentRegionId` (no `|| undefined`), functionally
  correct — `app/api/ai-check/route.ts` is properly region-aware via
  `resolveRegionProfile(body.regionId)`.
- Fixed to check behavior instead of exact source text: the route
  resolves the region from the request body and feeds the resolved
  profile's own fields into the judge prompt (never hardcodes a single
  market), and the caller-side check is scoped with a regex to the
  specific `fetch('/api/ai-check', ...)` block rather than the whole
  file — `app/generate/page.tsx` has a second, unrelated
  `regionId: currentRegionId` call site (the main generation request),
  so a file-wide check would stay green even if the ai-check call itself
  regressed. Verified both directions: passes on the correct code, and a
  deliberately-injected regression scoped to just the ai-check call
  (changing its `regionId` to a hardcoded string) correctly fails it.

### 0c. `rss_sources.region_id` had no foreign key (fixed 2026-09-10)

- Found while building source observability (item 1 below):
  `022_amado_baseline.sql` created `rss_sources.region_id` as `TEXT`;
  `023_regions_brands_i18n.sql`'s later `ADD COLUMN IF NOT EXISTS region_id
  UUID REFERENCES regions(id)` silently no-op'd because the column already
  existed. `articles.region_id` and `brand_profiles.region_id` got the
  correct `UUID` + FK treatment directly in `023` since those columns
  didn't already exist — `rss_sources` was the one column left as untyped
  text with no referential integrity.
- Fixed by `supabase/migrations/048_rss_sources_region_id_uuid.sql`
  (idempotent, defensive — nulls any row that wouldn't survive the cast
  instead of aborting). Validated against a real PostgreSQL 16 instance
  built from the actual migration files, including a deliberately-injected
  garbage-data path. See HANDOFF.md.
- Data itself was never actually wrong (every write path already stored
  real region UUIDs as strings) — this was a type/integrity gap, not a
  data corruption.

### 1. Source quality and observability

**Backend (2026-09-10) + Settings UI (2026-09-10):**
`GET /api/sources/observability` (optional `?region_id=`) computes, per
source over a trailing 30-day window: evidence yield, freshness (days
since last evidence), extraction success rate
(`hydration_status = 'full_text'` share), a re-fetch rate (same canonical
URL seen again), and a fingerprint-duplicate count (same title+summary
fingerprint under different URLs — a fuzzy same-story signal, not a hard
duplicate, since `evidence_items.duplicate_of` is not populated by any
write path). Also returns a per-region coverage rollup (source counts,
healthy count, 30-day evidence yield). `SourceCard.tsx` now shows these
metrics per source; a new `RegionCoverageCard.tsx` shows the per-region
rollup at the top of the Sources section in Settings. See HANDOFF.md for
what each metric actually means and its known limitations.

**"Disable low-value sources" workflow (2026-09-14):**
`components/settings/LowValueSourcesPanel.tsx` — a panel above the
Sources list that surfaces active sources with zero evidence yield over
the observability window (see item 1's backend section), with checkboxes
and a bulk "disable selected" action (`PATCH /api/rss/{id}` with
`active: false`, called once per selected source — not a new bulk
endpoint, matching this codebase's existing client-orchestrated
multi-call convention). Deliberately narrow threshold: active AND zero
yield, nothing else — extraction/duplicate rates are a quality-of-output
signal, not a did-anything-arrive-at-all signal, and mixing them would
make the threshold fuzzy. A source with no observability data yet (still
loading, or the endpoint failed) is never flagged, to avoid false
positives. Disabling never deletes — sources can be re-enabled from their
existing `SourceCard` toggle.

**Source authority vs. actual use (fixed 2026-09-15):** the prior
characterization of `rss_sources.authority_weight` as "dead, never
written" (see the 2026-09-10 HANDOFF.md entry) was wrong in one important
respect: it was correctly identified as never *read*, but it is in fact
written — every seed file (BR, ES, DE/US, competitor sources) populates
it with real, deliberately-differentiated per-source values (1.0–1.4).
The actual gap was one step downstream: `evidence_items.source_authority`
(a separate column, correctly wired into `lib/briefing.ts`'s candidate
ranking via `.order('source_authority', ...)`) was always written as the
hardcoded default `1.0` for every single evidence item, because
`lib/rss.ts`'s two `saveEvidence()` call sites never passed
`sourceAuthority`. The ranking machinery ran on every briefing but
silently operated on a constant instead of the real seeded values.
Fixed by threading `rss_sources.authority_weight` through both call
sites. Verified against a real PostgreSQL instance that a
higher-authority source now sorts first in the exact query
`selectCandidates()` uses. See HANDOFF.md.

**Competitor-mention source observability (2026-09-16):**
`GET /api/sources/competitor-mentions?region_id=` — for each active,
non-competitor market source in a region, counts how many evidence items
(30-day window, matching the review window `generateCompetitorReview()`
uses) mention any of that region's active competitors, and how many
distinct competitors each source has surfaced at least once. Reuses the
exact alias-generation and text-matching logic already used by
`generateCompetitorReview()` (`competitorAliases()`, `mentionsCompetitor()`,
now exported from `lib/competitor-review.ts` rather than duplicated) —
this is a standing, source-attributed view of a signal that previously
only existed as an ephemeral per-review-run computation with no
persisted breakdown of which sources actually produced it. Surfaced in
Settings via `components/settings/CompetitorMentionsCard.tsx`, showing
the top 5 sources by mention count. Verified end-to-end against a real
PostgreSQL instance (brands → competitors → alias generation → evidence
scan → aggregation), not just structurally.

### 2. Brand OS depth by market

**Diagnostic tooling delivered (2026-09-17); the actual content work is
still open and is not something an engineering patch can do on its
own** — real positioning, voice and claims for ES/DE/US are business
decisions, not something to fabricate. See below.

`GET /api/brands/os-coverage` (optional `?region_id=`) reports, per
active brand: how many of the 16 free-text `brand_profiles` fields are
non-empty, and row counts across every structured table
`buildBrandSnapshot()` (`lib/brand-snapshot.ts`) actually reads at
generation time — `brand_audiences`, `brand_pain_points`,
`brand_products`, `brand_claims`, `brand_terms`,
`brand_content_pillars` — plus whether the brand has an active
`brand_rule_sets` row. This mirrors exactly what generation reads, not a
separately-invented checklist. Surfaced via
`components/brand/BrandOsCoverageCard.tsx` on the Brand page, next to the
existing `BrandOsEditor` — visible only when a brand actually has gaps.

**What this confirmed, concretely:** the ES/DE/US seed files
(`006_spain_market_and_brand.sql`, `007_germany_us_locales.sql`) were
already honestly labeled as deliberate placeholders when written — only
`voice_description` and `target_audience` carry a short provisional
description; `positioning`, `value_propositions`, `strategic_themes`,
`product_facts`, `proof_points`, `cta_library`, `legal_disclaimers`,
`glossary`, `sensitive_topics`, `default_platform_rules`, `competitors`,
`forbidden_words`, `example_posts` are all empty in every seed file,
for every market including Brazil — none of the seeds populate the
newer structured Brand OS tables either. Since `buildBrandSnapshot()`
conditionally omits any block with zero rows rather than erroring, this
means: unless someone has since filled these in live through
`BrandOsEditor` (this repository snapshot cannot see current production
data), ES/DE/US generation likely runs today with no compliance rules,
no approved/forbidden claims, and no forbidden-term enforcement — only
the placeholder voice description. That's a real, previously
unquantified gap, not a vague "needs more content" note.

**Still open — needs Paal's input, not fabricated content:**
- Real positioning, voice, claims, forbidden terms, content pillars and
  an active rule set for ES, DE and US, entered through the existing
  `BrandOsEditor` UI (already fully functional — this is a content gap,
  not a tooling gap).
- Whichever market's content gets prioritized first should be a
  deliberate choice, not an assumption.

### 2b. Supabase live-schema audit (2026-09-19)

Reusable audit: `supabase/audit/001_schema_audit.sql` (read-only; run each
numbered statement separately). Results and decisions are recorded in the
`SESSION_HANDOFF_20260919` block of HANDOFF.md. Summary: region_id and RLS are
consistent in production; three `*_id` columns look like missing FKs
(`brand_claims.product_id`, `content_assets.generation_run_id`,
`content_packages.policy_snapshot_id`); no index patch (YAGNI).

**Audit run on production (2026-09-19), see AUDIT_RESULTS_20260919 in HANDOFF.md.**
`orphan_rows = 0` for all three FK candidates (not yet applied). The biggest finding is
`evidence_items.full_text` NULL in every row (404/404) although hydration is enabled by default.

**Still open:**
- Investigate why no evidence has full text (Vercel env flag vs failing fetches).
- Optional: apply the three FKs (re-run statement 6 first).

## Product priorities after Fable remediation

### 3. Content performance loop

- Use normalized platform metrics and separate useful engagement from vanity metrics.
- Connect content to qualified traffic, trial/demo, MQL/PQL and assisted pipeline where data exists.
- Convert repeated evidence-backed findings into explicit hypotheses, not autonomous rules.

### 4. Social experimentation

- One experiment = one main variable.
- Record hypothesis, primary metric, guardrail and evaluation window.
- Preserve reply/community behavior as part of the treatment.
- Amplify paid only after useful organic evidence.

### 5. End-to-end regression coverage

- Market switch → Brand OS → Generate.
- Localization/rewrite across market changes.
- Source ingestion → market feed → generation evidence.
- Keep Phase 5/6 race and market-isolation regressions permanently covered.

## Operational follow-up

- Monitor `/api/admin/runtime-health` for stale processing rows after Phase 3B.
- Keep the existing `/api/cron/ping` scheduler daily, with its deterministic UTC five-day gate before any Supabase request; do not add a duplicate keepalive job.
- Production generation fallback remains Google-only unless deliberately changed; Groq/OpenAI/DeepSeek adapters are not an active fallback chain.

## Deferred pending product decision

Do not implement autonomously:

- direct automatic social publishing;
- private/protected social scraping;
- autonomous campaign-budget decisions;
- automatic Brand OS mutation from performance;
- uncontrolled person-level social profiling;
- large multi-agent orchestration;
- unrelated document/OCR pipelines.

## Completed boundary

Fable remediation Phases 0–6 are complete as of 2026-09-09. Phase 5 removed fake-region first-render behavior across market-scoped workspaces. Phase 6 made competitor CRUD/load states race-safe and accessible, then extended competitor intelligence with shared official sources plus independent regional mentions. Do not reopen them without a regression or new evidence. Full findings and historical remediation detail remain in `docs/fable-review.md` and `HANDOFF.md`.
<!-- MARKET_INTELLIGENCE_POST_SPRINT_20260909 -->

## Next work after Market Intelligence sprint

### Source quality and observability
- Add source-health scoring that separates availability, freshness, extraction success, duplicate rate, and evidence yield.
- Add per-region source coverage diagnostics for BR, ES, DE, and US.
- Surface stale/dead/low-yield sources in Settings with actionable remediation instead of silent degradation.
- Add source-level collection metrics and trend history so weak sources can be replaced based on evidence.
- Review curated sources periodically for relevance to B2B software, CRM, task/project management, ERP, real estate, accounting/finance, AI, SMEs/Mittelstand, marketing, and digital business.

### Competitor intelligence depth
- Add a competitor activity timeline that merges official company updates with independent regional mentions.
- Add review history comparison so AI can identify what changed since the previous competitor review.
- Add structured competitor signals for product, AI, pricing, partnerships, positioning, GTM, hiring, and market expansion.
- Add explicit source provenance in competitor-review UI so users can distinguish company-owned claims from independent evidence.
- Add source coverage for competitors that currently rely only on independent market mentions and do not yet have an official source.

### Brand OS / market context
- Deepen Brand OS market-specific context so generation can consume region-aware competitor, source, positioning, and evidence signals consistently.
- Add observability for unresolved/stale market cookies and region-switch race conditions.
- Consider focus/visibility re-read of market context only if real production evidence shows stale-tab issues.

### Product / UX follow-up
- Run one full production UI pass after deployment for Quick Create, Market, Competitors, Settings, Localization, Rewrite, Brand, Generate, SEO Generate, Ideas, and Market Analysis across all four regions.
- Add targeted E2E coverage for market switching during in-flight requests and Quick Create region safety.
- Add E2E coverage for competitor creation, source linking, review generation, and failure-visible states.