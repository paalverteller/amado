# Amado — roadmap

Last consolidated: 2026-09-09.

This file contains only remaining work. Completed implementation history belongs in Git, `HANDOFF.md`, and `docs/fable-review.md`.

## Immediate next work

### 1. Source quality and observability

- Measure useful yield per source, duplicate rate, hydration success and downstream evidence use.
- Remove consistently empty, stale or low-value sources.
- Keep each regional source set intentionally small and useful.
- Compare source authority with actual use in briefing and generation.
- Add source-level observability for independent competitor mentions so the team can see which regional sources actually surface competitive signals.

### 2. Brand OS depth by market

- Replace placeholder/minimal ES/DE/US profiles with approved local positioning, voice, claims, examples and constraints.
- Keep Brand OS genuinely market-specific; never mechanically translate the Brazil profile.

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
