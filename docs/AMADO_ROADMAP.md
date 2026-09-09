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