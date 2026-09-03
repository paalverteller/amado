# Amado — roadmap

Last consolidated: 2026-08-24.

This document tracks current product direction. It intentionally does not preserve the old patch-by-patch delivery diary; Git history is the source for historical implementation detail.

## Product objective

Build a practical AI-first marketing operating system that turns market evidence, Brand OS and performance feedback into better content and marketing decisions.

The core loop is:

market signals → evidence → brand/market context → content → review → performance → retained learning

## Foundations completed

### Product shell

- Russian-only interface.
- August design system.
- Desktop + PWA navigation.
- Shared feedback/dialog primitives.

### Brand OS

- Editable brand profile.
- Audiences and pain points.
- Products and claims.
- Voice and vocabulary.
- Content pillars.
- Examples.
- Compliance.
- Versioned rule sets.
- Platform playbooks.
- Guideline import.

### Knowledge and evidence

- Evidence layer.
- Source health and ingestion runs.
- Full-text hydration.
- Knowledge assets/chunks.
- Keyword + semantic retrieval.
- Competitor evidence pipeline.
- Market briefing.

### Generation

- Canonical content-generation pipeline.
- Grounded evidence context.
- Brand snapshot.
- Region-aware locale prompts.
- SEO workspace.
- Localization workspace.
- Rewrite workspace.
- AI text review.
- Persistence/history.

### Multi-market

Active market model:

- Brazil — `pt-BR`
- Spain — `es-ES`
- Germany — `de-DE`
- United States — `en-US`

UI stays Russian.

Market selection should control:

- content locale;
- Brand OS;
- sources/evidence;
- competitor scope;
- localization target;
- rewrite target;
- SEO generation;
- deep market analysis.

### Social content

The 2026-08-24 social-media brief is integrated into Brand OS platform playbooks and canonical generation.

Current social platforms:

- LinkedIn
- Instagram
- Facebook
- X
- Threads

The system treats cadence, length and hashtag guidance as testable operating ranges, not algorithm laws.

Primary optimization principle:

business value > vanity engagement

### Market intelligence quality

General market evidence is now explicitly focused on business/SaaS-relevant information.

Exclude from general market intelligence:

- electoral / party politics;
- geopolitical conflict;
- sport;
- entertainment and celebrity noise.

Retain business-relevant:

- SMB activity;
- SaaS;
- enterprise technology;
- AI adoption;
- ecommerce;
- customer behavior;
- payments/fintech;
- productivity/work;
- privacy/regulation/tax/labour when materially relevant to businesses.

## Current priorities

### 1. Source quality and observability

- Measure yield per source.
- Remove consistently empty or low-value sources.
- Track duplicate rate and hydration success.
- Compare source authority with actual downstream use in briefing/generation.
- Keep regional source sets intentionally small and useful.

### 2. Brand OS depth by market

- Replace placeholder/minimal regional profiles with real approved positioning, voice, claims and examples.
- Keep local Brand OS distinct by market; never translate the Brazil profile mechanically.

### 3. Content performance loop

- Use normalized platform metrics.
- Separate useful engagement from vanity metrics.
- Connect content to qualified traffic, trial/demo, MQL/PQL and assisted pipeline where data exists.
- Turn repeated evidence-backed findings into explicit hypotheses, not automatic autonomous rules.

### 4. Social experimentation

- One experiment = one main variable.
- Record hypothesis, primary metric, guardrail and evaluation window.
- Preserve reply/community behavior as part of the treatment.
- Amplify paid only after useful organic evidence.

### 5. End-to-end regression coverage

- Keep multimarket flows tested.
- Add E2E coverage for market switching → Brand OS → Generate.
- Add E2E coverage for localization and rewrite market changes.
- Add source ingestion → market feed → generation evidence coverage.

## Explicitly deferred

Do not implement without a product decision:

- direct automatic social publishing;
- private/protected social scraping;
- autonomous campaign-budget decisions;
- automatic Brand OS mutation from performance;
- uncontrolled person-level social profiling;
- large multi-agent orchestration;
- unrelated document/OCR processing.

## Engineering principles

- Strangler-fig evolution, not schema rewrite.
- Preserve working migrations and production compatibility.
- One consolidated patch per task.
- Structural edits over brittle text anchors.
- Verification is part of delivery.
- Repository root stays clean of one-off patch scripts.

<!-- DATA_SOURCES_DE_US_SEED_20260825 -->

### Source coverage — Germany + US (2026-08-25)

Prior state: DE and US regions were `active = true` with placeholder brand
profiles but **zero** rss_sources — the single biggest gap in "Source
quality and observability" (see priority above).

Delivered: `supabase/seeds/008_de_us_sources.sql` — 6 DE + 5 US sources,
all live-verified (fetched real RSS/Atom XML, confirmed recent publication
dates) rather than guessed from directory listings. Categories: marketing,
business, technology, business_technology — matching the existing
BR/ES source taxonomy. New rows are seeded with `health_status = 'healthy'`
and a `source_health_events` row, since verification happened at seed time.

Still open: BR has ~15 sources, ES has ~5, DE now has 6, US now has 5.
Consider a follow-up phase to bring ES and US closer to BR's depth once
more live-verified candidates are found. Retail Dive, RetailWire, and
Ad Age were evaluated and explicitly excluded (see HANDOFF.md tag
`DATA_SOURCES_DE_US_SEED_20260825` for why).

<!-- GUIDELINE_IMPORT_SCHEMA_FIX_20260829 -->

### Brand OS depth -- guideline import pipeline fixed end to end (2026-08-29)

Investigated Priority #2 (DE/US/ES Brand OS all still placeholders).
Found the intended unblock path -- guideline import via `POST
/api/brands/[brandId]/guidelines/import` plus publish via `PATCH
.../import/[runId]` -- was silently broken at both the insert step and
the publish step, due to several schema mismatches against
`guideline_rule_candidates`, `policy_conflicts`, and `brand_rules`. Fixed
in one pass; see HANDOFF.md tag `GUIDELINE_IMPORT_SCHEMA_FIX_20260829`
for full detail, including why two earlier delivery attempts safely
no-opped instead of applying (a stale anchor from an outdated repomix
export, not a database issue).

This does not fill in DE/US/ES Brand OS content -- that still needs Paal
or each market owner to supply a real brand book through the now-working
import flow.

<!-- GUI_AUDIT_PHASE1_20260831 -->

## Priority 6 — GUI audit and modernization (added 2026-08-31)

Added as a new roadmap priority at Paal's request: audit the product UI
for defects and legacy/dead styling layers, and bring every page onto
the August design token system.

**Audit findings (full detail in HANDOFF.md under this same tag):**

| Area | Issue | Status |
|---|---|---|
| `+` button defect | Literal `+` character hardcoded into translated/hardcoded button text in two places (`lib/i18n/config.ts` RU_DICT.competitors.add_source, `components/settings/SourceCard.tsx`) instead of an SVG icon | Fixed — Phase 1 |
| `app/analytics/page.tsx` | Not wrapped in `<Layout>` (navigation dead-end), Cyrillic function identifier, mixed pt-BR strings in Russian UI, 100% raw Tailwind, no August tokens | Fixed — Phase 1 |
| `components/settings/SourceCard.tsx` | `HEALTH_COLOR` map used raw Tailwind color pairs instead of August status tokens (worked only via an implicit legacy CSS override) | Fixed — Phase 1 |
| `app/competitors/page.tsx` | 100% inline `v2-color-*` styles, no `m3-card`/`aug-button`/`aug-field` | Open — Phase 2 |
| `app/knowledge/page.tsx` | 100% inline `v2-color-*` styles, one fully hardcoded off-token color pair (`#DBEAFE`/`#1E40AF`) | Open — Phase 3 |
| 8 brand-tab components (Audience, Compliance, Voice, Versions, Pillars, Examples, Overview, ProductsClaims, GuidelineImport) | Raw Tailwind (`bg-blue-600`, `bg-gray-100`, etc.) instead of August tokens | Open — Phase 4 |
| `app/globals.css` — August token definitions | Confirmed in good shape: tokens complete, `prefers-reduced-motion` and `forced-colors` support present, no legacy Playfair font reference | No action needed |
| `app/globals.css` — `.aug-app-shell` legacy-Tailwind override block | Load-bearing compatibility shim mapping a narrow set of raw Tailwind color classes to August tokens for older pages. Fragile (silently breaks on any class-name edit) but still required until Phases 2-4 land | Remove after Phase 4 |

**Plan:**
1. ~~Phase 1: critical `app/analytics/page.tsx` navigation fix + `+` button defect in both locations~~ — done 2026-08-31.
2. Phase 2: `app/competitors/page.tsx` → August tokens.
3. Phase 3: `app/knowledge/page.tsx` → August tokens.
4. Phase 4: 8 brand-tab components → August tokens (`GuidelineImportTab` first, since it's the pipeline unblocked for Priority 2).
5. Follow-up: remove the now-unused `.aug-app-shell` legacy-Tailwind override block from `app/globals.css` once nothing depends on it.

<!-- GUI_AUDIT_PHASE2_20260901 -->

## Priority 6 — GUI audit and modernization: Phase 2 complete (2026-09-01)

`app/competitors/page.tsx` migrated from 100% inline `v2-color-*` legacy
styles to August design tokens (`m3-card`, `aug-button` + modifiers,
`aug-field`, `m3-chip`). Pure visual/structural change — verified no
state/effect/handler logic changed. Full detail in HANDOFF.md under this
tag.

**Updated status table:**

| Area | Status |
|---|---|
| `+` button defect (both locations) | Fixed — Phase 1 |
| `app/analytics/page.tsx` | Fixed — Phase 1 |
| `components/settings/SourceCard.tsx` | Fixed — Phase 1 |
| `app/competitors/page.tsx` | Fixed — Phase 2 |
| `app/knowledge/page.tsx` | Open — Phase 3 |
| 8 brand-tab components | Open — Phase 4 |
| `.aug-app-shell` legacy-Tailwind override block in `app/globals.css` | Still load-bearing for Phases 3-4; remove after Phase 4 |

<!-- GUI_AUDIT_PHASE3_20260901 -->

## Priority 6 — GUI audit and modernization: Phase 3 complete (2026-09-01)

`app/knowledge/page.tsx` migrated from 100% inline `v2-color-*` legacy
styles (plus one fully hardcoded off-token hex color pair on the
search-mode badge) to August design tokens (`m3-card`, `aug-button` +
modifiers, `aug-field`, `m3-chip`). Pure visual/structural change —
verified no state/effect/handler logic changed. Full detail in
HANDOFF.md under this tag.

**Updated status table:**

| Area | Status |
|---|---|
| `+` button defect (both locations) | Fixed — Phase 1 |
| `app/analytics/page.tsx` | Fixed — Phase 1 |
| `components/settings/SourceCard.tsx` | Fixed — Phase 1 |
| `app/competitors/page.tsx` | Fixed — Phase 2 |
| `app/knowledge/page.tsx` (incl. hardcoded `#DBEAFE`/`#1E40AF` badge) | Fixed — Phase 3 |
| 8 brand-tab components | Open — Phase 4 |
| `.aug-app-shell` legacy-Tailwind override block in `app/globals.css` | Still load-bearing for Phase 4; remove after |
