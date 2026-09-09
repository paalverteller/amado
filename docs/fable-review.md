# Fable review — findings, triage, and remediation plan

Source: external code review performed by Claude Fable 5.1 on 9 files
(`lib/content-generation/generate-article.ts`, `lib/prompts.ts`,
`lib/brand-os/precedence.ts`, `lib/brand-os/guideline-extractor.ts`,
`app/api/brands/[brandId]/guidelines/import/route.ts`, `lib/ai.ts`,
`lib/brand-snapshot.ts`, `lib/market-context.tsx`,
`app/competitors/page.tsx`), requested 2026-09-04, delivered as a PDF
export and pasted into chat as document text. This file preserves the
review verbatim in full below, then adds this project's triage and a
phased remediation plan. **This plan takes priority over the "Current
priorities" list in `docs/AMADO_ROADMAP.md` until closed out** — see
the roadmap file for the pointer.

Status legend used in the plan tables: `TODO`, `IN PROGRESS`, `DONE`,
`WON'T FIX` (with reason), `NEEDS PRODUCT DECISION`.

---

## Triage notes (this project's analysis, not Fable's)

Before planning phases, four of the review's "can't confirm without
file X" notes were closed by checking files the reviewer's 9-file
bundle didn't include but this project's repomix snapshot does:

1. **`guideline_rule_candidates.source_anchor` is nullable** (migration
   `033_guideline_compiler.sql`) — no `NOT NULL`. So a quote-less
   candidate does *not* fail insertion at the DB layer. The review's
   §4 worry about this was reasonable to flag but does not apply as
   stated; downgraded.

2. **`brand_rules` has no unique constraint on `(rule_set_id,
   rule_key)`** (migration `030_brand_os_core.sql`) — confirmed. §3's
   "Critical — pending confirmation" finding is real: duplicate
   `rule_key` values from import are not rejected by the DB, so
   `compileRules()`'s in-memory `Map`-based dedup is the *only* thing
   deciding which of N duplicate rules survives, silently, per
   request evaluation, not at write time.

3. **`brand_rule_sets` has only a non-unique partial index** on
   `(brand_id, status) WHERE status = 'active'` (same migration) — not
   a unique index. Two active rule sets per brand can coexist today.
   Confirms the review's §7 `.maybeSingle()` "multiple rows" risk in
   `brand-snapshot.ts`.

4. **The actual candidate → `brand_rules` write path was not in the
   reviewer's bundle** (`app/api/brands/[brandId]/guidelines/import/
   [runId]/route.ts`, the `PATCH` handler's `publish` branch — distinct
   from `.../rule-sets/[ruleSetId]/publish/route.ts`, which only flips
   `brand_rule_sets.status` and never touches `brand_rules`). Reading
   it closes the review's biggest open question definitively:
   - `scope_json: candidate.scope_json` is copied byte-for-byte from
     `guideline_rule_candidates` into `brand_rules`. The import route
     writes `scope_json: { scope: rule.scope, target: rule.scopeTarget
     }` — a shape with **no field in common** with `RuleScope`
     (`lib/brand-os/types.ts`: `{ workspace, brand, region, language,
     platform, format, pillar, product, campaign, objective, audience,
     risk }`). `scopeMatches()` in `precedence.ts` reads exactly those
     `RuleScope` keys. Every rule ever imported through this pipeline
     therefore scope-matches as fully global — a "LinkedIn-only" rule
     applies to email, a DE-only rule applies to BR. **This is a live,
     confirmed bug, not a risk**, for every brand that has ever run a
     guideline import and published it.
   - `rule_key: candidate.rule_key` is copied unchanged, with the same
     `${ruleType}_${scope}` collision shape as finding (2) above.
   - Insert failures are per-row `console.warn`-only, inside a `for`
     loop with no counting (`app/api/brands/[brandId]/guidelines/
     import/[runId]/route.ts`, `publish` branch) — the same
     silent-partial-failure shape the review flagged in the *import*
     route, independently present in the *publish* route too.
   - The response's `published: N` count is taken from
     `candidateDecisions` in the *request body just PATCHed*, not from
     `approvedCandidates.length`, and never from actual `brand_rules`
     insert successes. A publish-only call with `candidateDecisions`
     omitted reports "Published 0 rules" regardless of how many rows
     were actually written (or attempted).

These four points sharpen — and in point 4's case, escalate — the
review's own severity ratings. They're folded into the phase plan
below under Phase 1.

No other findings were downgraded. Everything else in the review was
either directly confirmed by reading the referenced file, or left as
originally rated where the referenced file wasn't part of this
project's context either (e.g. `content-request-repository.ts`'s
`record()` swallowing behaviour was confirmed available and is folded
into Phase 1; `ai-utils.ts`'s `withTimeout`/cooldown internals were
available and are folded into Phase 3).

---

## Phased remediation plan

Ordered by expected damage-per-effort, per the review's own closing
recommendation, with the two newly-confirmed critical items (brand
rule scope-shape mismatch, publish-route silent failure) pulled
forward into Phase 1 alongside it.

### Phase 1 — Brand OS integrity (highest currently-live risk)

Everything here can silently produce content that violates a brand's
own hard rules today, for any brand that has completed a guideline
import — which per `HANDOFF.md` includes the Bitrix24 Brazil policy
seed and is the intended path for DE/US/ES real brand books.

- [ ] `brand-snapshot.ts`: check `error` on every one of the 9
      `Promise.all` queries plus the `brand_rules` follow-up query;
      return a `degraded: string[]` field on `BrandSnapshotResult` so
      callers/UI can distinguish "no data" from "query failed".
- [ ] `brand-snapshot.ts`: add deterministic `ORDER BY` to every
      `LIMIT`-ed query on forbidden/hard-constraint data
      (`brand_claims`, `brand_terms`, `brand_rules`), and log when a
      truncation actually drops rows (`count() > limit`).
- [ ] `brand-snapshot.ts`: route `brand_rules` through
      `compileRules()`/`scopeMatches()` (`lib/brand-os/precedence.ts`)
      instead of reading raw rows with no scope filtering.
- [ ] `brand_rule_sets`: add a real unique partial index on
      `(brand_id) WHERE status = 'active'` (SQL migration + Supabase
      SQL Editor block) so `.maybeSingle()` call sites can't silently
      drop all compliance rules on a data-integrity violation that the
      schema currently allows.
- [ ] `brand_rules`: add a unique constraint on `(rule_set_id,
      rule_key)` so duplicate-key imports fail loudly at insert
      instead of being silently arbitrated by `compileRules()`'s
      in-memory dedup at read time.
- [ ] Fix the `RuleScope` shape mismatch end-to-end: the import route
      (`app/api/brands/[brandId]/guidelines/import/route.ts`) must
      write `scope_json` in the actual `RuleScope` shape, not `{
      scope, target }`. Decide and document what `rule.scope` /
      `rule.scopeTarget` (extractor output) map onto which `RuleScope`
      keys.
- [ ] Fix `rule_key` collisions at the source: extractor/import route
      must produce a `rule_key` unique enough to not collide across
      every tone rule in one brand book (e.g. include an index or a
      content hash), or the import route must deduplicate/merge before
      insert.
- [ ] `app/api/brands/[brandId]/guidelines/import/[runId]/route.ts`
      (`publish` branch): make `brand_rules` inserts all-or-nothing
      (batched `.insert([...]).select('id')`) or explicitly count
      inserted vs failed and report both; stop reporting a count taken
      from request-body `candidateDecisions` as the published count.
- [ ] `app/api/brands/[brandId]/guidelines/import/route.ts`: same
      all-or-nothing / counted-insert treatment for
      `guideline_rule_candidates`; if `inserted === 0 && total > 0`,
      mark the run `failed` with `error_summary` instead of `review`
      with HTTP 201.
- [ ] `generate-article.ts`: fix `contentRequests.record()` failure
      being silently treated as "no id" (`?.` swallows a null
      response) — surface it instead of proceeding to insert an
      orphaned article.
- [ ] `generate-article.ts`: reorder so the article insert happens
      before the (optional) localization-notes LLM call, so a
      mid-request platform kill can't strand a `content_requests` row
      in `processing` with content generated but no article row.

### Phase 2 — Region resolution: absence vs failure

The review's core cross-cutting finding: "no region → Brazil" is the
documented, correct contract; "region given but unresolvable → Brazil"
is an undocumented, silent failure mode hitting five files.

- [ ] `lib/brand-snapshot.ts` (`resolveBrandRegionId`): throw on a
      genuine DB `error`; only return `null` for "brand not found" or
      "brand has no region set". Do not conflate the three.
- [ ] `lib/prompts.ts` (`resolveRegionProfile`): same split — log (at
      minimum) on DB error / inactive region / unknown id, and stop
      returning the exact same `DEFAULT_REGION_PROFILE` for all three
      plus genuine absence. Check `is_active` explicitly.
- [ ] `lib/content-generation/generate-article.ts`: normalize the
      `input.regionId` boundary — empty string must not silently skip
      brand-derived region resolution (`??` → explicit trim-to-null
      check, not `||` alone since `0`/falsy region ids aren't a
      concern here but empty string is).
- [ ] Add a single `resolveEffectiveRegionId(explicit, brandId)`
      helper that owns precedence + normalization + a log line on
      explicit-vs-brand mismatch, and migrate call sites onto it
      instead of repeating `input.regionId ?? await
      resolveBrandRegionId(...)` inline.
- [ ] `lib/prompts.ts` (`resolveLanguageProfile`): stop deriving
      language from the hand-maintained `LANGUAGE_NAMES` map with a
      Portuguese default; derive from `regions.default_language_code`
      (already selected in `buildRegionContextLayer`) so an
      unmapped/new region code (MX, IT — both present in
      `MARKET_FLAGS`) doesn't silently become "Brazilian".
- [ ] Collapse the four out-of-sync hand-maintained region maps
      (`LANGUAGE_NAMES`, `culturalNotes`, the `resolveLanguageProfile`
      locale-string branches, `MARKET_FLAGS`) onto the `regions` table
      as the single source of truth, or generate them from it.
- [ ] `lib/brand-os/guideline-extractor.ts`: a brand with no
      `region_id` should not silently produce Portuguese-language
      rules for a DE/US/ES brand book import — return a 4xx from the
      import route instead ("brand has no region set — cannot import
      guidelines") rather than defaulting.
- [ ] `lib/prompts.ts` (`buildEvidenceContext`): stop hardcoding
      `toLocaleDateString('pt-BR')`; use the resolved region's locale
      or ISO format.

### Phase 3 — Generation reliability (budgets, fallback, status machines)

- [x] `lib/ai.ts`: fix (or confirm-and-document) the `maxTokens` vs
      SDK v5+ `maxOutputTokens` rename — verify against the installed
      `ai` package version, then grep every `generateText`/
      `streamText` call site in the codebase for the same mistake.
- [x] `lib/ai.ts`: use a fixed (non-shuffled) model order for the
      Google pipeline chain — `rotateGroup` currently defeats the
      documented newest-stable → older → Flash-Lite quality ordering
      during a primary outage.
- [x] `lib/ai.ts` / `lib/ai-utils.ts`: add a short cooldown on
      timeout/5xx, not just quota errors — currently a hanging primary
      is retried on every request.
- [x] `lib/ai.ts`: inspect `finishReason` and fail fast on an
      empty-text response (e.g. Gemini safety block) instead of
      burning the retry budget on models that will block the same
      prompt identically.
- [x] Confirm whether the documented Gemini → Groq → OpenAI → DeepSeek
      multi-provider fallback chain exists in the active code path, or
      only the Google-only chain the review found in `buildPipelines`
      — reconcile documentation with reality either way.
- [x] `generate-article.ts` + `lib/ai.ts`: pass a shared request-scoped
      deadline from the route down through both LLM calls so the
      55s-per-call budget can't compose into an overrun of the route's
      actual `maxDuration`.
- [x] `generate-article.ts`: parallelize the independent
      context-building calls (evidence, system prompt, brand snapshot,
      region layer/profile, knowledge, competitor, playbook) with
      `Promise.all` instead of ~8 serial awaits.
- [x] Add a stale-row detection rule (view or scheduled check) for
      `content_requests` and `guideline_import_runs` stuck in
      `processing` past a reasonable timeout, so stranded rows are
      visible instead of silent. Phase 3B adds a 15-minute policy,
      exposes current stale counts/samples in `/api/admin/runtime-health`,
      and runs an authenticated daily reaper that records its result in
      `cron_runs`. The legacy content-request queue now stamps processing
      start time and moves successful queue rows to `completed`, preventing
      its previous systematic false-stale state.

### Phase 4 — Prompt-injection surface and validation

- [x] Add one shared `promptBlock(tag, text, { maxChars })` helper
      that escapes `<`/`>` in interpolated text and truncates long
      fields; use it everywhere untrusted or semi-trusted text is
      interpolated into a prompt (competitor RSS text, evidence
      summaries, knowledge documents, brand fields, previous drafts,
      refinement notes, customInstructions).
- [x] `lib/brand-os/guideline-extractor.ts`: replace the current
      regex-extraction + manual cast with AI SDK v6 structured output
      (`generateText` + `Output.object`) against a Zod schema, so malformed/partial LLM
      JSON is caught by validation instead of silently producing
      `undefined` fields that later fail a NOT NULL insert.
- [x] `lib/brand-os/guideline-extractor.ts`: verify `sourceQuote`
      against the source text (`sourceText.includes(quote)`) and
      downgrade confidence on a miss, rather than trusting a
      potentially hallucinated quote shown to the human reviewer as
      evidence.
- [x] `lib/brand-os/guideline-extractor.ts`: remove the string-pattern
      template `.replace()` interpolation path that could interpret `$&`,
      `` $` ``, `$'` and `$$` from document text. The extraction prompt is
      now built from fixed instructions plus escaped `promptBlock()` values.
- [x] `app/api/brands/[brandId]/guidelines/import/route.ts`: validate
      unchecked body fields (`documentType`, `platform`, `locale`,
      `sourceType`, `sourceUrl`) instead of casting with `as`; decide
      whether `locale` should be validated against the brand's region
      or dropped as a field entirely (currently the extractor ignores
      it and derives language from the brand's region regardless of
      what's stored). Phase 4 validates it against the resolved brand
      locale and stores that resolved locale as the canonical value.

Phase 4 also reuses the existing authenticated `/api/cron/ping` route as a
Supabase keepalive. Vercel invokes it daily at `0 3 * * *`, while the route gates
all Supabase activity to one deterministic UTC run every five days before any
database call; successful keepalive runs are recorded in `cron_runs`.

### Phase 5 — `market-context.tsx` first-render correctness

- [ ] Fix first render always being `BR` with a fake
      `br-fallback` region id before the cookie/`/api/regions` effects
      resolve — expose a `ready` flag (cookie read *and* regions
      loaded) and have consumers not fetch until ready; use `null`
      instead of a fake id so pages can treat "unknown" as "don't
      query yet".
- [ ] Validate `marketCode` against the loaded `regions` list once
      available; reset to default (and rewrite the cookie) if the
      stored code is stale/unknown, instead of silently falling
      through to an unfiltered fetch.
- [ ] Consider a `visibilitychange`/`focus` cookie re-read for
      cross-tab drift, if any server code also reads the
      `amado_market` cookie (needs confirmation).
- [ ] Wrap the context value in `useMemo` (low effort, avoids
      unnecessary consumer re-renders).

### Phase 6 — `competitors` page correctness and accessibility

- [ ] Confirm whether `/api/competitors` POST and `/api/rss` POST
      derive region from a market-aware default brand or a hardcoded
      one; fix if the latter (competitors created while in the ES
      market silently attaching to a BR default brand, then
      disappearing on region-filtered reload).
- [ ] Check `res.ok` on `addSource`, `addCompetitor`, `toggleArchive`
      and surface a real error message instead of silently clearing
      the form on failure.
- [ ] Render the `loadState === 'error'` branch (currently dead code —
      the page shows nothing on a load failure).
- [ ] Fix `CompetitorCard.load`'s `.catch(() => setLoaded(true))`
      rendering a network error as an empty "no sources" state.
- [ ] Add a latest-request guard / cancellation for the region-keyed
      fetch in `CompetitorsPage.load`.
- [ ] Accessibility: convert the card expand toggle from `<div
      onClick>` to a real focusable button with `aria-expanded`;
      add accessible names to the source-type `<select>` and the
      unlabeled inputs; mark `reviewMessage` errors with
      `role="alert"` and the danger token instead of the muted one;
      give the health-status dot a text alternative and a mapping for
      `error`/`failed` (not just `healthy`); label archive/restore
      buttons with the competitor name.
- [ ] Migrate the remaining inline `style={{ color: 'var(--aug-ink)')
      }}` usages to Tailwind 4 `@theme`-registered semantic utility
      classes, continuing the Priority #6 GUI-audit pattern.
- [ ] Route `'архив'`, `'Архив'`, `'Вручную'`, `'Ошибка…'` and any
      other hardcoded Russian strings on this page through `t()` —
      folds into the already-open i18n-coverage item from the Priority
      #6 close-out.

### Cross-cutting items not tied to one phase

- [ ] Standardize the `{ data, error }` handling pattern project-wide:
      a small `unwrap(result, { table, op })` helper that throws (or
      records into a shared `degradations: string[]`) instead of each
      call site independently deciding to read only `.data`. This is
      the single fix with the widest blast radius across Phases 1 and
      2 — worth landing early, even partially, since later phases can
      then use it instead of hand-rolling error checks per file.
- [ ] Decide (product decision, not a bug fix) whether AI-generated
      "localization notes for head office" should be written in the
      content language or in Russian for the (Russian-speaking)
      review UI — currently generated in content language, which the
      review flags as a likely axis conflation.
- [ ] Decide (product decision) the known `cron/auto-generate` /
      `book_chunks` disable question and the unused `title_ru`/
      `summary_ru` fields — both pre-date this review but sit in the
      same "silent legacy behavior" category; tracked here for
      visibility, not committed to this plan's scope.

---

## Full original review text (verbatim, for reference)

Conventions: severity in brackets; "can't confirm" notes flag where
the reviewer would need a file not in their bundle. Line references
are to function names / nearby anchors since the source PDF didn't
carry line numbers.

### 1. `lib/content-generation/generate-article.ts`

#### Focus-area answers

**Two-step persist — does an article-insert failure roll back / mark
the request failed?**
Partially. The `articleInsertError` branch does `markFailed` + throw,
which is correct. But there are three gaps around it:

- **[High] `contentRequests.record()` failure is silent.** `const
  contentRequestId = requestRecord?.id ?? null` — the `?.` means the
  repository can return null. When it does, the code proceeds to
  insert an orphaned article with `content_request_id: null`,
  `linkEvidence` is skipped, `markCompleted` is skipped, and the
  caller gets a resolved promise with `contentRequestId: null`. No
  throw, no warning. Can't confirm without `content-request-
  repository.ts` whether `record` swallows errors — but the `?.`
  tells me somebody expected it to.
- **[High] Wrong ordering leaves `processing` rows stranded.**
  Sequence is: LLM generate → `record(status: 'processing')` →
  *second LLM call* (localization notes) → `articles.create` →
  `markCompleted`. If the platform kills the function during
  localization notes (see the ai.ts budget analysis — this is
  realistic), you get a `content_requests` row stuck in `processing`
  *with* `generated_content` populated and no article row, and the
  user sees a timeout. Nothing ever transitions it. Move the article
  insert before the localization notes (notes can `UPDATE articles
  SET source_context` afterwards), or drop notes to a separate
  best-effort request.
- **[Medium] `markCompleted` and `linkEvidence` return values are not
  checked.** If either fails, the request stays `processing` while
  the article exists and the caller reports success. Also
  `markFailed` inside the error branch can itself throw and mask the
  original insert error.
- **[Medium] Failed generations leave no trace.** `record()` runs only
  after a successful LLM call, so a provider outage produces zero
  `content_requests` rows. You can't measure failure rate or debug
  from the DB. Consider recording `pending` first, then updating.

**Region resolution — is regionId always correctly derived before
downstream use?**
The ordering is correct (`effectiveRegionId` computed before
evidence/prompt/persist). The *value* can be silently wrong:

- **[Critical] Empty-string `regionId` defeats brand derivation.**
  `input.regionId ?? await resolveBrandRegionId(...)` — `''` is not
  nullish, so a form/client that sends `regionId: ''` skips brand
  derivation entirely, and `resolveRegionProfile('')` returns Brazil.
  A Spanish brand generates Portuguese. I can't see the calling
  route(s) to confirm whether they normalize; treat the input
  boundary as untrusted and use `||` / explicit trim-to-null here.
- **[Critical] Both fallbacks collapse "error" into "Brazil".**
  `resolveBrandRegionId` returns `null` on DB error;
  `resolveRegionProfile` returns `DEFAULT_REGION_PROFILE` on DB
  error, unknown id, or inactive region. In all these cases the row
  is persisted with `locale: 'pt-BR'`, and — worse — with the
  *original* `region_id` when the region is merely inactive, so the
  stored row says "DE region, pt-BR locale". This is the exact
  silent-wrongness class you asked me to prioritize. "No region given
  → Brazil" is the documented contract; "region given but
  unresolvable → Brazil" is not, and should be loud.
- **[Medium] No consistency check between explicit `regionId` and
  brand region.** The contract says explicit wins, fine — but when
  they disagree you get Brazil brand facts / forbidden terms in the
  system prompt with Spanish output instructions, and no log line. At
  minimum warn.
- **[Medium] `getRecentEvidenceContext(topic, 5, effectiveRegionId)`
  with `null` region.** Can't see `lib/evidence.ts`. If null means
  "no filter", a default-Brazil generation pulls DE/ES evidence into
  "BRAZIL MARKET SIGNALS". If null means "only rows with `region_id
  IS NULL`", pre-Sprint-12 rows leak into every market. Either way
  worth a deliberate decision.

**Are context-building calls awaited and isolated?**
All awaited, all sequential. Isolation is inconsistent:

- `buildKnowledgeContext` / `buildCompetitorContext`: try/catch
  internally, log and continue — isolated, visible in logs.
- `buildEvidenceContext`, `buildRegionContextLayer`,
  `resolveRegionProfile`, `buildBrandSnapshot`, `buildSystemPrompt`:
  degrade to empty/default with **no log at all** in most cases
  (details under each file).
- `buildSocialPlaybookContext`, `recordAiUsage`,
  `getRecentEvidenceContext`: not shown; if any of them throws, the
  whole generation fails *after* a paid LLM call (`recordAiUsage` in
  particular is bookkeeping that can abort the request). Wrap the
  non-essential ones.
- **[Medium] Serial awaits eat the function budget.** ~8 sequential
  DB round-trips plus a possible embedding call before the LLM is
  even invoked. `Promise.all` the independent ones (evidence, system
  prompt, brand snapshot, region layer/profile, knowledge, competitor,
  playbook all only depend on inputs already known).

#### Other findings

- **[Medium] Explicit evidence is injected twice.** When
  `selectedEvidenceContext` is set, `rssText === selectedEvidenceContext`,
  so both `"${REGION} MARKET SIGNALS:\n${rssText}"` and
  `"EVIDENCE:\n${selectedEvidenceContext}"` are pushed — same text
  twice. Token waste and over-weighting.
- **[Medium] Stored provenance can lie.** `evidenceIdsUsed =
  input.evidenceItemIds` regardless of whether `buildEvidenceContext`
  actually found/returned them (it returns `''` on error or no rows).
  The row then claims evidence was used that wasn't in the prompt.
- **[Medium] Refinement parent not validated.** `parentRequestId`
  pointing to a missing row → `parent = null` → new thread, but
  `parent_request_id` still persisted (FK failure → silent `record`
  null, see above). Also no check that the parent belongs to the same
  brand/region — a BR draft can be "refined" into an ES brand's
  thread.
- **[Medium] Localization notes language is a product question.** The
  prompt says notes are "for head office", and the UI/reviewers are
  Russian-speaking, yet the notes are generated in the *content*
  language. That looks like an axis conflation (reviewer artefact
  produced in market language). Flag for a decision, not a bug per
  se.
- **[Medium] `seo_mode: true` stored even when the format doesn't
  support SEO** (prompts.ts silently ignores it). Stored flag ≠
  behaviour.

### 2. `lib/prompts.ts`

#### Focus-area answers

**resolveLengthConstraints / buildFormatInstruction — internally
consistent?**
Mostly, with these contradictions:

- **[High] SEO article is self-contradictory.** With `seoMode` on an
  `article`: length 800–1500 words; format rule "3-4 body paragraphs";
  generic `<rules>` "Paragraphs: 3-4 sentences"; SEO rule "descriptive
  H2s every 300-400 words"; system prompt "No Markdown". 3–4
  paragraphs of 3–4 sentences is ~250 words, not 800–1500, and "H2s"
  with "no markdown" is unsatisfiable. The model picks one arbitrarily
  → silently inconsistent SEO output across runs.
- **[Medium] Explicit `charCount` silently discarded in SEO mode**
  (`maxChars = 15000` overrides it). Not reachable from
  `generate-article` today (it never passes word/char counts), but
  the API is a trap.
- **[Medium] Structured formats get a character-length rule that
  doesn't fit.** `x_thread` and `instagram_carousel` return JSON
  arrays; the "Length: approximately N–M characters" line applies
  to… the JSON? Plus per-post/per-slide caps. Can't confirm without
  `content-formats.ts` `maxChars` values whether the totals are even
  reachable.
- `minChars` is computed and never used. `email` wants both "subject
  line in first line" and the generic "Title … first line". Minor.

**resolveLanguageProfile — correct per region, no Brazil defaults
leaking?**
There is a leak:

- **[High] Unknown region codes silently become "Brazilian".**
  `resolveRegionProfile` sets `languageName = LANGUAGE_NAMES[code] ??
  'Portuguese (Brazil)'`. `resolveLanguageProfile`'s generic branch
  then requires `languageName !== 'Portuguese (Brazil)'`, so any code
  not in the map (MX and IT are listed in `MARKET_FLAGS`, so
  presumably exist in `regions`) falls to the Brazil branch:
  `marketAdjective: 'Brazilian'`, seasonality "Carnaval", output
  language Portuguese — while `<region>Mexico (es-MX)</region>` sits
  two lines above. Fix direction: the `regions` table already has
  `default_language_code` (you select it in `buildRegionContextLayer`),
  derive the language from that instead of a hand-maintained map with
  a Portuguese default.
- **[Medium] Locale string matching is brittle.** Branches hardcode
  `'es-ES'`, `'de-DE'`, `'en-US'`; GB and anything else go through
  the generic branch. Works today only because `regions.locale_code`
  happens to match exactly. Four parallel hand-maintained maps
  (`LANGUAGE_NAMES`, `culturalNotes`, the `resolveLanguageProfile`
  branches, `MARKET_FLAGS`) are already out of sync with each other.
- **[Medium] `buildEvidenceContext` hardcodes
  `toLocaleDateString('pt-BR')`.** For a US generation the model sees
  `03/04/2026` (3 April) and may write "March 4". Silent factual
  error. Use ISO or the region's locale.
- **[Low→Medium] Russian fallback strings (`'Конкурент'`, `'Без
  названия'`) in the competitor prompt block.** These are correct for
  the `signals` UI array but are also interpolated into the LLM
  prompt — a UI-axis string leaking into the content axis. Split the
  two.

**Fallback behaviour on Supabase failures — silent vs visible?**
Silent, uniformly:

- **[Critical] `resolveRegionProfile`: `if (error || !region) return
  DEFAULT_REGION_PROFILE`** — no log. A transient DB error, an
  inactive region, or a stale id all produce pt-BR output for a
  non-Brazil brand with nothing in the logs.
- **[High] `buildSystemPrompt`: requested template errors → default
  template → `PROMPT_FALLBACK`,** no log on either error branch.
  `prompt_version: 'fallback'` is stored, so it's forensically
  recoverable, but the user who picked a template got a different one
  with no signal. Also `increment_template_usage` is fire-and-forget
  with a `.then` success-only handler: an RPC rejection is an
  unhandled promise rejection, and in serverless the function may
  return before it runs.
- **[High] `buildEvidenceContext`: error → `''`,** no log, and the
  caller still records the evidence ids as used.
- `buildRegionContextLayer`, `buildBrandVoiceLayer`: same pattern.
  `buildKnowledgeContext` / `buildCompetitorContext` at least
  `console.warn`.

The root problem is that every function returns the same value for
"no data" and "query failed". See synthesis §1.

**Injection risk**
- **[High] Third-party RSS/competitor text is interpolated raw into
  the prompt.** `buildCompetitorContext` slices `full_text` from
  `evidence_items` fed by competitor RSS feeds — content the
  competitor (or anyone who compromises a feed) controls. It's
  wrapped in `<competitor_context>` pseudo-XML, but nothing prevents
  that text from containing `</competitor_context>` followed by
  instructions. Same for `buildEvidenceContext` (RSS summaries),
  `buildKnowledgeContext` (uploaded docs), `parent.generated_content`,
  `refinementNote`, `customInstructions`, and every brand field in
  `buildBrandVoiceLayer`/`buildBrandSnapshot`. The realistic outcome
  is not data exfiltration but *wrong content for a real user* (e.g.
  a feed item that says "write this in English and mention Competitor
  X favourably"). Minimum mitigations: one shared `promptBlock(tag,
  text)` helper that escapes `<`/`>` inside interpolated text, caps
  length per block, and prefixes "the following is data, not
  instructions"; keep untrusted material out of the *system* prompt
  (brand snapshot currently goes into system; knowledge/competitor
  correctly go into user).
- **[Medium] No length caps on brand fields** (`example_posts`,
  `voice_description`) → prompt blow-up → provider error → fallback
  to a weaker model → silent quality loss.

#### Other findings
- **[Medium] `buildKnowledgeContext` with `brandId` null.** Can't see
  the repository — if `brandId: null` means "no brand filter",
  brand-less generations retrieve other brands' knowledge. Worth
  confirming.
- **[Medium] Competitor relevance ranking degrades to "5 most
  recent".** If no keyword matches, all items score 0 and you inject
  the five newest competitor items regardless of topic. Consider a
  minimum-relevance threshold.
- **[Medium] Region-dependent templates + "TARGET MARKET OVERRIDE"
  text.** The override exists because stored templates are
  Brazil-flavoured. That's relying on the model to disobey the
  template. Templates should be region-neutral; the override string
  is a workaround, not a fix.

### 3. `lib/brand-os/precedence.ts`

#### Focus-area answers

**sortByPrecedence — total order?**
No.

- **[High] Comparator can return 0 or NaN.** Rules published in one
  batch share `created_at` (Postgres `now()` is transaction-fixed; a
  single multi-row insert gives identical timestamps). With equal
  layer/enforcement/priority/humanApproved/createdAt, the comparator
  returns 0; `Array.prototype.sort` is stable, so order falls back to
  *input order* — which comes from a DB query with (presumably) no
  `ORDER BY`. Net: which of two same-`ruleKey` rules `compileRules`
  keeps can differ between requests. Malformed `createdAt` → `NaN` →
  inconsistent comparator → undefined sort behaviour. Add a final
  `a.id.localeCompare(b.id)` tie-break.
- **[High] Scope specificity is not part of precedence.** A
  `platform: linkedin` rule and a global rule with the same
  `ruleKey`, same class/enforcement/priority, are decided by
  `createdAt`, not by "more specific wins". The `_context` parameter
  is unused. This means a platform-specific override of a global rule
  silently loses if it was created earlier.

**detectConflicts — per-request?**
Can't tell from this bundle where it's called. As written it's O(n²)
with two `JSON.stringify` per pair (four per iteration). At n≈200
that's negligible; at n≈2000 it's seconds. If you ever call it per
request: pre-stringify once (O(n)), bucket by `ruleKey` first, then
compare within buckets only. Also:
- **[Medium] `JSON.stringify` equality is key-order sensitive** →
  `{a,b}` vs `{b,a}` flagged as contradiction.
- **[Medium] Same key + different value is *always* a contradiction,
  even with disjoint scopes** (LinkedIn tone vs Instagram tone) →
  false positives. Conversely `checkScopeOverlap` returns `false` for
  two fully-global rules (all four keys null), so two identical
  global rules are *not* reported as duplicates. Both inverted from
  what a reviewer expects. `'ambiguity'` / `'scope_overlap'` types
  are declared but never produced.

**scopeMatches — empty array vs null?**
Looked at it carefully: an empty array **cannot** accidentally
trigger "applies everywhere". The failure mode is the opposite and
it's silent:
- **[Medium] `[]` means "applies nowhere".** `[]` is not null →
  `[].includes(x)` is false → rule filtered out. Same for `risk: []`.
  A UI or extraction step that emits an empty array instead of null
  silently disables the rule. Normalize empty arrays to null at write
  time, or decide explicitly that `length === 0` is a wildcard.
- **[Medium] `contextValue === undefined → false`.** A region-scoped
  rule never applies when `context.regionId` is undefined — i.e. for
  every brand with `region_id IS NULL`, exactly the brands that
  currently fall back to Brazil. Region/language rules for those
  brands are silently dropped.

#### Cross-file concern (needs the publish route + `brand_rules` DDL
to confirm)
- **[Critical — pending confirmation] `rule_key` collisions from the
  import route make `compileRules` discard imported rules.** The
  import route builds `rule_key = \`${ruleType}_${scope}\`` (e.g.
  `tone_global`). A brand book yields many tone rules → all share
  `tone_global` → `compileRules` keeps **one** and drops the rest;
  `detectConflicts` flags every pair as a contradiction. If the
  publish step copies `rule_key` unchanged into `brand_rules` (the
  route comment says it passes `rule_class`/`enforcement` through
  unchanged, so likely), and if `brand_rules` has a unique constraint
  on `(rule_set_id, rule_key)`, publish fails on the second rule.
  Either outcome is bad. Separately, the route writes `scope_json: {
  scope, target }` which is **not** the `RuleScope` shape (`{
  platform, format, region, language, … }`) this engine reads —
  unless publish transforms it, `scopeMatches` sees all-null scopes
  and every "LinkedIn-only" rule applies everywhere. I need
  `app/api/brands/[brandId]/guidelines/import/[runId]/route.ts` and
  the `brand_rules` DDL to close this; flagging it now because it's
  the same shape as the bug you already fixed once.

*(This project's triage note: both files were available and this was
closed — see "Triage notes" above. The scope_json mismatch is
confirmed real; the unique-constraint question resolved the other
way — there is no unique constraint on `brand_rules`, so publish does
not fail loudly, it silently accumulates duplicates instead.)*

### 4. `lib/brand-os/guideline-extractor.ts`

#### Focus-area answers

**Does extraction validate/sanitize LLM output?**
No. `JSON.parse` then `result = <whatever>` cast to
`ExtractionResult`. The only normalization is `rules || []` and
`detectedConflicts || []`.
- **[High] No shape validation** → downstream route does
  `rule.instruction`, `rule.ruleType`, etc. on arbitrary objects. Enum
  values (`ruleType`, `scope`, `confidence`) aren't checked: unknown
  `ruleType` → `RULE_CLASS_MAP[x] ?? 'brand_positioning'` (silent
  misclassification); unknown `confidence` → 0.3; `isHardRule:
  "false"` (string) → truthy → `hard_block`. You're on AI SDK v6 —
  `generateObject` / `Output.object` with a zod schema gives you
  validation, retries on invalid JSON, and no regex extraction, for
  free.
- **[Medium] `sourceQuote` isn't verified against `sourceText`.** A
  hallucinated quote is stored as `source_anchor` and shown to the
  human reviewer as evidence. A cheap
  `sourceText.includes(quote)` check → downgrade confidence when it
  fails would materially improve the review step.

**Partial/malformed output — hard failure or silent loss?**
Mixed:
- Unparseable JSON (including *truncated* output from a long brand
  book): the greedy `/\{[\s\S]*\}/` finds no closing brace or grabs
  trailing prose → parse throws → **loud**. Good.
- Parseable but wrong shape: **silent** — rules with missing fields
  get inserted with `raw_text: undefined` → NOT NULL violation →
  route logs and `continue`s (see route).
- **[Medium] `cleanPlainTextOutput` runs on the JSON.**
  `generateArticleWithFallback` cleans the text with the
  article-cleanup function before you regex it. Can't see
  `text-cleanup.ts`; if it strips markdown (`*`, `#`, code fences) or
  normalizes whitespace, it can corrupt JSON string contents (a
  `sourceQuote` with `**bold**`). Using the article path for
  structured extraction is a latent corruption risk regardless.
- **[Medium] `task: 'extraction'` is ignored.**
  `generateArticleWithFallback` always uses the `generation` pipeline
  (see ai.ts), so the extraction budget in `buildPipelines` is dead
  config.
- **[Low, noting once] String-pattern `.replace()` with a string
  replacement interprets `$&`, `` $` ``, `$'`, `$$` in the *document
  text*.** `$$` in a brand book becomes `$`; `$'` splices in the rest
  of the template. Use a function replacer. Also `'{{!}}'` literals
  are left in the prompt when URL/text are absent.

**Schema alignment with `guideline_rule_candidates`**
I can't verify this — the DDL isn't in the bundle. I can only confirm
the route's insert matches the column list the route's own *comment*
claims. Per your convention, the fields I'd check against the real
`CREATE TABLE`: `source_anchor` nullability (it's `rule.sourceQuote`,
which can be undefined → if NOT NULL, every quote-less rule is
silently skipped), `confidence` type (numeric vs text/enum),
`human_decision` allowed values, whether `rule_key` has a uniqueness
constraint per run, `operator` allowed values.

*(This project's triage note: `source_anchor` is nullable — no NOT
NULL in the migration — so this specific worry doesn't apply as
stated. See "Triage notes" above.)*

#### Other findings
- **[High] Region fallback produces Portuguese rules for DE/US/ES
  brands without `region_id`.** `resolveBrandRegionId → null →
  resolveRegionProfile → Brazil`, so the prompt says "Interpret … for
  Brazil" and "Write instruction, rationale, summary in Portuguese
  (Brazil)". You said DE/US/ES Brand OS is mostly placeholder and
  `region_id` is nullable — this is exactly the state in which the
  next real brand-book import happens. Given a *brand* is the unit
  here, "brand has no region" should be a 4xx on import, not a Brazil
  default.
- **[Medium] Reviewer-language question.** Rules/rationales are
  written in the target market language but the review UI is
  Russian-only. Product decision, not a bug — but the
  `title_ru/summary_ru` pattern elsewhere suggests reviewer-facing
  text is expected in Russian.

### 5. `app/api/brands/[brandId]/guidelines/import/route.ts`

#### Focus-area answers

**brandId ownership/region checks before writing**
None. Given the single-shared-password model, "ownership" is moot,
but *existence* and *region* aren't checked either: a nonexistent
`brandId` → region null → Brazil profile → `knowledge_documents`
insert fails (FK) but is only *warned* → `guideline_import_runs`
insert either fails loudly (if FK) or creates a ghost run.
- **[Medium] Body fields are unvalidated:** `documentType`,
  `platform`, `locale`, `sourceType` (unchecked `as` cast,
  interpolated into the prompt), `sourceUrl` all go straight to DB /
  prompt.
- **[High] Body `locale` vs brand region can disagree.** The route
  accepts `locale` from the body and stores it on
  `knowledge_documents`; the extractor ignores it and uses the
  brand's region (or Brazil). A client passing `locale: 'de-DE'` for
  a region-less brand gets Portuguese rules stored under a `de-DE`
  document. Either validate `locale` against the brand's region or
  drop the field.
- **[Medium] No size cap on `content`.** A large brand book →
  oversized prompt → provider errors → all fallbacks fail → 500
  (loud, fine), but only after burning the full 55s and a lot of
  tokens.

**Transaction/ordering — safe if one step fails partway?**
No transaction, and partial failure is the silent path:
- **[Critical] Per-candidate insert failures are logged and skipped,
  then the run is marked `review` and the client gets 201 with
  `stats.total = N` from the *extraction result*, not the DB.** A
  systematic constraint failure (the exact bug class you fixed) would
  today produce: N=20 in the response, 0 candidates in the review
  screen, run status `review`, HTTP 201. That's the previous bug,
  still reachable via a different constraint. Fix: count inserted vs
  failed; put both in `stats` and the response; if `inserted === 0 &&
  total > 0`, mark the run `failed` with `error_summary`. Consider a
  single batched `.insert([...]).select('id')` — all-or-nothing is
  the semantics you actually want here.
- **[High] `knowledge_documents` failure is downgraded to "not
  available".** The message assumes the only failure is a missing
  table. A permanent NOT NULL / FK / CHECK failure means *no import
  ever has a source document* and `source_document_ids: []` forever,
  with only a `console.warn`. Distinguish `42P01` from everything
  else.
- **[High] Platform kill mid-extraction leaves the run in
  `processing` forever.** Extraction of a large document can take
  30–55s inside `generateArticleWithFallback`, on top of the route's
  own DB work. Nothing reaps stale `processing` runs.
- **[Medium] Final `guideline_import_runs` update isn't
  error-checked.** If it fails, the run stays `processing` while the
  client sees `status: 'review'`.
- **[Medium] Conflict resolution by label is ambiguous.** `findIndex`
  on `\`${ruleType}_${scope}\`` returns the *first* match, so with 5
  `tone_global` rules every conflict attaches to rule #0 — and
  `candidate_a_id === candidate_b_id` self-conflicts are possible.
  Have the extractor return per-rule indices or ids.
- **[Medium] Extractor's `precedence` (1–100) is discarded** and
  `operator: 'must'` is hardcoded even for preferences. Loses the one
  signal that could feed `priority` in the precedence engine.

**Error responses — real error or 200-with-empty?**
Extraction failure → 500 with message, run marked `failed` ✔. Outer
catch → 500 ✔. Run-insert failure → 500 ✔. Partial candidate failure
→ **201 with wrong stats** ✘ (above). Document-insert failure → **201,
silently no document** ✘.

Also: `workspace_id: '00000000-…'` hardcoded — fine as debt, but if
`workspaces` gets a FK later this becomes another silent path.

### 6. `lib/ai.ts`

#### Focus-area answers

**Do the budgets compose across the chain without a platform
timeout?**
Within `generateArticleWithFallback` alone, yes, conservatively: 55s
− 3s margin, and each attempt is capped to the remaining time. Across
the *request*, no:

- **[High] The 55s deadline assumes it owns the whole function.** In
  `generate-article`, before this is called there are ~8 serial DB
  round-trips (+ embedding); after it, a second LLM call via
  `generateWithFallback`, which has **no total deadline** — 4 models
  × 15s first-chunk timeout = 60s worst case, plus per-chunk 10s
  timeouts with no cap on chunk count. Worst case per request ≈ 5s +
  52s + 60s. I can't see the route's `maxDuration`; if it's 60s, the
  overrun hits exactly the window where `content_requests` is
  `processing` with no article (file 1). Either pass a shared
  deadline object down from the route, or give `generateWithFallback`
  its own deadline and call it *after* the article is persisted.
- **[Medium] The 4-deep fallback is mostly decorative under slow
  failures.** Primary 32s → remaining 20s → one more attempt at 20s →
  remaining 0 → break. Only fast failures (429/4xx) reach models 3–4.
  Also `Math.max(5000, …)` with the `remaining <= 5000` guard means a
  fresh article attempt can start with a 6s budget, which will
  essentially always time out. Raise the skip threshold for
  `generation` to something like 12–15s.
- **[Medium] Does `withTimeout` abort the underlying request?** Can't
  see `ai-utils.ts`. If it just races a timer, the timed-out
  `generateText` keeps running, consuming provider quota and possibly
  triggering a 429 that then cools down the model you're about to try
  next.

**rotateGroup / uniquePipeline — deterministic enough?**
Deterministic *for an identical prompt* (seed = full user prompt),
which in practice means random per request since prompts include
evidence and timestamps. Logs do record which model succeeded, so
post-hoc reproduction from logs works; reproducing the *order*
doesn't.
- **[High] Rotation defeats the documented quality ordering.** The
  header comment says fallback is intentionally newest-stable → older
  → Flash-Lite last. `rotateGroup` shuffles that list per seed, so
  during a primary outage ~25% of requests go straight to
  Flash-Lite. That's silent quality degradation with no signal beyond
  the model name in the row. Rotation makes sense to spread load
  across *providers with separate quotas*; within one provider's
  quality-ordered family it's counterproductive. Use a fixed order
  for the Google chain.
- **[High] There is no multi-provider fallback in production.**
  `buildPipelines` is Google-only (the file's own comment says so).
  The bundle intro and project context describe Google → Groq →
  OpenAI → DeepSeek; that chain doesn't exist in the active path. A
  Google-wide incident = total generation outage. Loud, so not
  Critical, but the project's mental model is wrong.

**Cooldown — stuck forever, or thundering herd?**
Can't fully answer without `setCooldown` / `retryDelayMs` /
`eligiblePipeline` in `ai-utils.ts`. From what's here:
- Cooldown is set only on quota errors. If it's in-memory (likely),
  it's per-instance: it can't propagate across instances (each
  instance eats one 429 before benching), and it can't get "stuck"
  past a cold start. It *can* get stuck within a warm instance if
  `retryDelayMs` parses a large `Retry-After` (e.g. daily quota →
  86400s) with no cap — cap it.
- **[High] No cooldown on timeouts/5xx.** A hanging primary is
  retried on *every* request, each burning ~32s before falling back.
  During a primary slowdown every generation takes ≥32s and most hit
  the deadline issue above. Add a short (60–120s) cooldown on
  timeout/5xx — that's the circuit breaker this file is missing.
- **[Medium] All-in-cooldown produces an empty error.**
  `eligiblePipeline` returns `[]` → `"All generation models failed.
  "` with nothing after it. Say "all models in cooldown until …".

#### Other findings
- **[High] `maxTokens` is (very likely) silently ignored.** AI SDK
  v5+ renamed it to `maxOutputTokens`; this file already uses the
  v5+ `usage.inputTokens/outputTokens` names, so you're on the new
  API. Because the option is passed via a conditional spread,
  TypeScript's excess-property check doesn't fire. Effect:
  localization notes have no output cap (only the "max 400
  characters" prose), and any caller's `maxTokens` does nothing.
  Verify by hovering the type or grepping `node_modules/ai` for
  `maxOutputTokens`, then grep the codebase for `maxTokens:` in SDK
  calls.
- **[Medium] Empty text is treated as a provider failure.** Gemini
  safety blocks return empty text with `finishReason:
  'content-filter'`; you then retry the same prompt on the next
  Gemini model, which blocks it too, until the deadline. Inspect
  `finishReason` and fail fast. Same masking if `cleanPlainTextOutput`
  strips a valid output (e.g. a JSON array) to nothing.
- **[Medium] `createModel` returning null → `continue` with no entry
  in `errors`** — a misconfigured key produces a shorter error list,
  not a visible "skipped: no credentials".
- **[Medium] `streamFromProbedIterator` mid-stream timeout throws
  into the consumer** after `generateWithFallback` has already
  returned success — no fallback is possible and partial text is
  lost. Fine for best-effort notes; a problem for any caller that
  treats the stream as authoritative.
- `params.task` ignored in `generateArticleWithFallback` (noted under
  extractor).

### 7. `lib/brand-snapshot.ts`

#### Focus-area answers

**resolveBrandRegionId — explicit regionId always wins?**
The function has no precedence logic — it only takes `brandId`.
Precedence is implemented at each *call site* (`input.regionId ??
await resolveBrandRegionId(...)` in generate-article). That's correct
where it's done, but the contract lives in N callers, and the
`''`-not-nullish issue (file 1) shows how it breaks. Suggest a single
`resolveEffectiveRegionId(explicit, brandId)` that owns normalization
+ precedence + logging of mismatches, and make it the only way to get
a region id.
- **[Critical] Returns `null` for three different things:** brand not
  found, brand has no region, DB error. Callers can't distinguish,
  and all three become Brazil downstream. Throw on `error`; return
  null only for a genuinely null `region_id`. Also doesn't check
  `is_active`.

**Brazil/pt-BR leaks?**
None inside this file — no defaults here. Adjacent:
- **[Medium→High depending on callers]
  `resolveDefaultBrandProfileId` isn't market-aware.** "Any active
  brand, `is_default` first" — with the market switcher filtering
  brands by region, a route that falls back to this picks the BR
  default while the user is in ES. Can't see its callers.
- **[Medium] `telegram_post → 'whatsapp'` playbook.** Documented, but
  it's a silent mismatch: WhatsApp-specific tactics injected into
  Telegram content.

**Snapshot caching/staleness?**
Looked for it: there is no caching anywhere in this file — every call
runs ~10 live queries. So staleness after a Brand OS edit can't
originate here. The stored `brand_snapshot_summary` on
`content_requests` is a point-in-time audit record, which is the
right design. Cost is the concern, not staleness.

#### Other findings
- **[Critical] Every query's `error` is ignored.** `Promise.all`
  returns `{data, error}` objects; the code reads only `.data`. If
  `brand_claims` errors (RLS, missing column, a table absent from the
  manually-consolidated prod baseline), `forbidden` claims are simply
  absent from the prompt and the model is free to make prohibited
  claims. Same for `brand_terms` (forbidden words), `brand_rules`
  (compliance hard blocks — `const { data: rules } = …` drops the
  error), `brand_profiles`. This is the identical failure class to
  the guideline-import bug, in the file whose whole job is enforcing
  brand rules. Check every error; at minimum return a `degraded:
  string[]` in `BrandSnapshotResult` so the "visible context" UI can
  say "Brand OS unavailable" instead of showing an empty fact list
  that looks intentional.
- **[Critical] Hard constraints are truncated arbitrarily.**
  `brand_claims .limit(15)`, `brand_terms .limit(20)`, `brand_rules
  .limit(20)` — all with **no `ORDER BY`**. A brand with 30 forbidden
  terms gets an arbitrary 20, and which 20 changes between requests.
  Real brand books routinely exceed these. For `forbidden`
  claims/terms and `hard_block` rules, don't limit (or order by
  priority and log when truncated). The moment real DE/US brand books
  land, this silently produces content that violates the brand's own
  hard rules.
- **[High] `brand_rule_sets … .eq('status','active').maybeSingle()`**
  — two active rule sets → PostgREST "multiple rows" error → `data:
  null` → all compliance rules silently dropped (compounded by the
  ignored-error issue). Needs a unique partial index on `(brand_id)
  WHERE status='active'` or `.order().limit(1)`.
- **[High] The precedence engine is bypassed.** Rules are read raw
  from `brand_rules` with no scope filtering (region/platform/format)
  and no `compileRules`. A LinkedIn-only `hard_block` is injected
  into an email. `precedence.ts` exists but as far as these files
  show it isn't in the generation path at all. Either route this
  through `compileRules(rules, { brandId, regionId, platform,
  format })` or document why not.
- **[Medium] Legacy `voice_description` is included alongside
  structured data** and can contradict it (old free text says "use
  tu", new `brand_terms`/rules say "Sie"). Consider dropping it when
  structured voice data exists.
- **[Medium] Prompt injection surface** — all brand fields go into
  the *system* prompt unescaped (see prompts.ts). Brand-book text is
  semi-trusted, but it's the highest-privilege position in the
  prompt.

### 8. `lib/market-context.tsx`

#### Focus-area answers

**Cookie vs in-memory sync after client-side navigation?**
Within one tab they stay in sync (both written in `setMarketCode`;
state hydrated from cookie once on mount). Two real problems:
- **[High] First render is always `BR` regardless of cookie, and
  `regions` is a fake list.** `marketCode` initializes to
  `DEFAULT_MARKET_CODE`; the cookie is read in a `useEffect`, i.e.
  *after* the first render and after child effects have already
  fired. `regions` initializes to `[{ id: 'br-fallback', … }]`. So
  every consumer's first effect runs with `marketCode === 'BR'` and
  `currentRegionId === 'br-fallback'` — a fake id that pages send to
  the API (`/api/competitors?region_id=br-fallback`). Then the cookie
  effect flips to `ES`, then `/api/regions` resolves and the id
  becomes real → three fetches, no cancellation in the consumers →
  out-of-order responses can leave the **wrong market's data on
  screen** until the next user action. Fix direction: expose a
  `ready` flag (cookie read *and* regions loaded) and have consumers
  not fetch until ready; don't ship a fake region id — use `null` and
  let pages treat null as "unknown, don't query".
- **[Medium] Cross-tab drift.** Tab A changes the cookie; tab B's
  state is stale until reload. Only matters if any *server* code
  reads `amado_market` (can't confirm) — then tab B renders ES while
  its requests are filtered by DE. A `visibilitychange`/`focus`
  re-read of the cookie fixes it cheaply.

**Default/fallback when cookie missing/invalid?**
Missing → `BR`, fine. Invalid is unhandled:
- **[High] An unknown/deactivated code (e.g. stale `MX`, or garbage)
  is accepted as-is.** `regions.find(...)` → undefined →
  `currentRegionId = null` → consumers fetch **unfiltered**
  (`/api/competitors` with no `region_id`) → the page shows all
  markets' data while the switcher shows no selection. After
  `/api/regions` loads, validate `marketCode` against it and reset to
  default (rewriting the cookie) if absent. Also validate in
  `setMarketCode`.

**Context value stability?**
Real but minor: `useMarketState` returns a fresh object every render,
so any re-render of `MarketProvider`'s *parent* re-renders all
consumers even when nothing changed. State-driven re-renders would
happen anyway (value legitimately changed). If the provider sits at
the app-shell root, the parent rarely re-renders; wrap the return in
`useMemo` anyway — it's one line. **[Low]**

Also: `MARKET_FLAGS` lists `MX` and `IT`, which `LANGUAGE_NAMES` in
prompts.ts doesn't know → the "Brazilian" fallback in file 2. (Flag
glyphs are garbled in the PDF; can't verify them.)

### 9. `app/competitors/page.tsx`

#### Correctness first (they matter more than the design questions)

- **[High — pending API] `addCompetitor` sends `{ name, website,
  notes }` with no `brand_id` and no region.** Competitors inherit
  region via `brand_id`, so the server must pick a brand — presumably
  a default that isn't market-aware (file 7). Creating a competitor
  while in the ES market can attach it to the BR default brand, after
  which the region-filtered reload makes it *disappear*. Silent
  wrong-region write. Same shape for `addSource` → `/api/rss` (no
  `region_id`; whether the server derives it from `competitor →
  brand → region` is unknown). Need `/api/competitors` POST and
  `/api/rss` POST to confirm.
- **[High] Mutations don't check `res.ok`.** `addSource`,
  `addCompetitor`, `toggleArchive` ignore the response; on a 4xx/5xx
  the form clears, the list reloads, and nothing changed with no
  message. The review button *does* check `res.ok` — inconsistent.
- **[High] `loadState === 'error'` is never rendered.** The list
  `load` sets `'error'` on failure, but no JSX branches on it — the
  page just shows nothing (the empty-state card only renders for
  `'ready'`). Combined with the first-render bogus `br-fallback`
  fetch from file 8, the sequence "error → ready" or "ready → error"
  (out-of-order) is plausible.
- **[Medium] `CompetitorCard.load` `.catch(() => setLoaded(true))`**
  renders "no sources" on a network error — an error shown as an
  empty state.
- **[Medium] Fetch race in `CompetitorsPage.load`** — no
  cancellation/latest-request guard when `currentRegionId` changes
  quickly (which it does on mount, per file 8).

#### Focus-area answers

**Is the m3-card / aug-button / aug-field / m3-chip pattern worth
standardizing further?**
Yes — and the reason isn't aesthetics, it's that every a11y and
error-handling decision is currently re-made at each call site and is
wrong in the same way each time. Three primitives would fix most of
the findings below once: `<Field label>` (owns the accessible name),
`<Button loading>` (owns `aria-busy`, disabled semantics, the '...'
text), `<InlineMessage tone="error">` (owns `role="alert"` and the
danger token — right now errors render in `--aug-muted`, visually and
semantically indistinguishable from hints).

**Accessibility**
- **[High] The card expand toggle is a `<div onClick>`** — not
  focusable, no `role="button"`, no `aria-expanded`, no key handler.
  Keyboard and screen-reader users cannot expand a competitor.
- **[Medium] Inputs have no accessible name.** `<label
  className="aug-field"><input placeholder=… /></label>` — the label
  has no text; placeholder is not a reliable accessible name and
  disappears on input. The source-type `<select>` has no name at all.
  Add `aria-label` (or visually-hidden label text) — ideally inside
  the `<Field>` primitive.
- **[Medium] `reviewMessage` errors aren't announced** (no
  `role="alert"`/`aria-live`) and are styled as muted, not danger.
- **[Medium] Health dot is colour-only** with no text alternative,
  and `SOURCE_DOT_COLOR` maps only `healthy` — `error`/`failed`
  render identical to `unknown`.
- Archive/restore buttons don't say *which* competitor (`aria-label`
  with the name). '...' loading text has no `aria-busy`. The PDF
  shows `ariahidden="true"` on SVGs — almost certainly a line-wrap
  artefact of `aria-hidden`; if it were literal, React would warn.

**Inline `style={{ color: 'var(--aug-ink)' }}` vs Tailwind utilities**
Move them to utilities. In Tailwind 4, register the semantic tokens
in `@theme` (`--color-ink: var(--aug-ink)`, `--color-muted`,
`--color-accent`, `--color-border`, …) and you get `text-ink`,
`text-muted`, `border-border` for free, with hover/dark/responsive
variants that inline styles can't do. It also makes the Priority-6
close-out grep trivial (any `text-*-N00` is a violation by
construction) and lets you delete the `.aug-app-shell` shim with
confidence. **[Medium]**

Also noted, since you asked for it in passing: `'архив'`, `'Архив'`,
`'Вручную'`, `'Ошибка…'` bypass `t()` — matches your open
i18n-coverage item.

### Cross-file synthesis — systemic patterns worth fixing once

**1. `{ data, error }` collapse: "query failed" is indistinguishable
from "no rows".** brand-snapshot ignores `error` on ~10 queries;
prompts.ts returns `''`/Brazil on error without logging;
`resolveBrandRegionId` returns `null` for error; the import route
`continue`s past per-row failures; the competitors page renders empty
states on fetch errors. Every one of these degrades to a *plausible*
output (Brazil, no brand rules, empty list), which is why they
survive. Fix once: a tiny `unwrap(result, { table, op })` helper that
throws (or records into a `degradations: string[]` array), and make
`generateAndPersistArticle` return + persist that array so the
"visible context" UI can show "brand rules unavailable" instead of an
innocent-looking empty list. This is the same bug class as the
guideline-import incident, in five files.

**2. Brazil as the universal fallback for *failure*, not just for
*absence*.** The contract "no region → pt-BR" is fine. But `''`, DB
errors, inactive regions, unknown codes (MX/IT), and region-less
DE/US brands all *also* land on Brazil, silently, in generate-article,
prompts.ts (twice), brand-snapshot, the extractor, and the import
route. Separate the two: absence → default; unresolvable → throw/4xx.
And collapse the four hand-maintained region maps (`LANGUAGE_NAMES`,
`culturalNotes`, `resolveLanguageProfile` branches, `MARKET_FLAGS`)
onto the `regions` table — `default_language_code` is already there.

**3. Status machines with no owner.** `content_requests` and
`guideline_import_runs` both have a window where a platform kill
strands the row in `processing`, and both windows are widened by the
same cause: LLM budgets that don't compose (`FUNCTION_DEADLINE_MS`
assumes it owns the whole function; `generateWithFallback` has no
deadline; serial DB awaits). Fix once: a request-scoped deadline
passed down from the route, persist-before-optional-LLM ordering, and
a `processed_at`/`started_at`-based stale-row rule (even just a view)
so stuck rows are visible.

**4. No validation at any trust boundary.** LLM JSON (extractor),
route bodies (import route), cookie value (market-context), fetch
responses (page), `regionId` strings (generate-article). Zero zod in
these nine files. Standardize on schemas: `generateObject` for LLM
output, a body schema per route, and a whitelist check on the market
cookie.

**5. Untrusted text interpolated raw into prompts** with pseudo-XML
delimiters — RSS/competitor feeds (third-party controlled), uploaded
knowledge, brand fields, previous drafts, refinement notes. One
`promptBlock(tag, text, { maxChars })` helper that escapes angle
brackets and truncates, used everywhere, closes most of it.

**6. The rule engine and the import pipeline disagree on what a rule
*is*.** `rule_key = ${ruleType}_${scope}` collides; `scope_json =
{ scope, target }` isn't `RuleScope`; `precedence` is dropped;
`buildBrandSnapshot` reads `brand_rules` raw (no scope, no ordering,
`LIMIT 20`) and never calls `compileRules`. Needs the publish route
and `brand_rules` DDL to close, but the design decision — *what does
`rule_key` identify, and who decides scope shape* — should be made
once before more brand books are imported.

*(This project's triage note: closed — see "Triage notes" above.)*

**7. Unordered `LIMIT` queries on hard constraints** (claims 15,
terms 20, rules 20, audiences 3, evidence). Non-deterministic subsets
of *forbidden* things is the single most likely way real brand books
will produce non-compliant content once DE/US import for real.

**8. Serial awaits / N+1** in generate-article (~8 round trips), the
import route (one insert per candidate), and duplicate region lookups
(`resolveRegionProfile` + `buildRegionContextLayer` both hit
`regions`; the import route resolves region and the extractor
resolves it again). Parallelize and batch — and batching the
candidate inserts also gives you the all-or-nothing semantics from §1
for free.

**9. One-off but grep-able:** `maxTokens` → `maxOutputTokens` (SDK
v5+ rename, hidden by spread). Grep every `generateText`/`streamText`
call.

If I had to pick three to patch first, by expected damage-per-effort:
brand-snapshot error handling + unordered limits (§1/§7 — this is
where forbidden claims get dropped), region-failure-≠-Brazil in
`resolveRegionProfile`/`resolveBrandRegionId` (§2), and the import
route's inserted-count truthfulness (§1, the known bug shape).
