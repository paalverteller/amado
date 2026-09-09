# Amado — roadmap

Last consolidated: 2026-09-09.

This file contains only remaining work. Completed implementation history belongs in Git, `HANDOFF.md`, and `docs/fable-review.md`.

## Immediate next work

### 1. Fable Phase 5 — market-context first-render correctness

Goal: eliminate wrong-market requests and race conditions during initial client hydration.

- Replace the fake `br-fallback` region with `null` while market state is unresolved.
- Expose a `ready` state that becomes true only after the market cookie has been read and active regions have loaded.
- Prevent market-dependent consumers from fetching until `ready` is true.
- Validate the stored market code against the loaded active regions; reset to the default market and rewrite the cookie when it is stale or unknown.
- Add a focus/visibility cookie re-read only if server-side cookie use makes cross-tab drift observable.
- Memoize the market-context value.
- Add regression coverage for first render, stale cookie, valid non-BR cookie, and market switching.

Acceptance: opening the app with an ES/DE/US cookie must never issue an initial BR/fake-region request, and an invalid cookie must never produce an unfiltered cross-market fetch.

### 2. Fable Phase 6 — competitors correctness and accessibility

Goal: make competitor CRUD market-correct, failure-visible, race-safe, and keyboard/screen-reader accessible.

- Confirm and fix market-aware brand/region resolution in `/api/competitors` POST and `/api/rss` POST.
- Check `res.ok` for add source, add competitor, archive/restore and surface actionable errors.
- Render the competitors list load-error state instead of an empty screen.
- Distinguish source-load failure from a genuine empty-source state.
- Add latest-request cancellation/guarding for region-keyed competitor fetches.
- Convert the card expand control to a real button with `aria-expanded`.
- Add accessible names to source type and form inputs.
- Announce review/mutation errors with semantic alert styling.
- Give source health a text alternative and explicit failed/error mappings.
- Label archive/restore actions with the competitor name.
- Move remaining hardcoded Russian strings through `t()`.
- Remove remaining inline semantic-color styles in favor of existing August/Tailwind semantic utilities.

Acceptance: changing market cannot leave competitor data from another market on screen; failed mutations never look successful; the main competitor workflow is keyboard-operable.

## Product priorities after Fable remediation

### 3. Source quality and observability

- Measure useful yield per source, duplicate rate, hydration success and downstream evidence use.
- Remove consistently empty, stale or low-value sources.
- Keep each regional source set intentionally small and useful.
- Compare source authority with actual use in briefing and generation.

### 4. Brand OS depth by market

- Replace placeholder/minimal ES/DE/US profiles with approved local positioning, voice, claims, examples and constraints.
- Keep Brand OS genuinely market-specific; never mechanically translate the Brazil profile.

### 5. Content performance loop

- Use normalized platform metrics and separate useful engagement from vanity metrics.
- Connect content to qualified traffic, trial/demo, MQL/PQL and assisted pipeline where data exists.
- Convert repeated evidence-backed findings into explicit hypotheses, not autonomous rules.

### 6. Social experimentation

- One experiment = one main variable.
- Record hypothesis, primary metric, guardrail and evaluation window.
- Preserve reply/community behavior as part of the treatment.
- Amplify paid only after useful organic evidence.

### 7. End-to-end regression coverage

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

Fable remediation Phases 0–4 are complete as of 2026-09-09. Do not reopen them without a regression or new evidence. Full findings and historical remediation detail remain in `docs/fable-review.md` and `HANDOFF.md`.
