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
  search/list UI. NOT wired into `/generate` yet — that's Sprint 8.
  ⚠️ pgvector migration needs verification against a real Supabase
  instance — it's the one part of this sprint that couldn't be executed
  locally.

- [ ] **Sprint 4 — Editable Brand workspace touch-up (Phase 3)**
  `/brand` already exists (9 tabs) — gap is against the plan's specific
  sections (Основа бренда, Аудитория, Продукт, Тон и стиль, Разрешённые
  утверждения, Запрещённые формулировки, Правила площадок, Источники
  бренда, История изменений) and brand snapshot/version restore UI. Audit
  tab-by-tab against this list before writing code.

- [ ] **Sprint 5 — Safer source ingestion hardening (Phase 4)**
  RSS already exists; add source health surfaced in UI, manual
  URL/pasted-text source, newsletter ingestion (or manual-forward fallback),
  full-content search. Note: `lib/firecrawl.ts` + `web-reader.ts` already
  do broad scraping — plan says scraping should not be the default
  dependency; decide explicitly whether to keep, gate, or deprecate.

- [ ] **Sprint 6 — Overview and briefing (Phase 5)**
  The real payoff sprint: scheduled sequential AI workflow (one agent,
  task modes per §2.1–2.3 of the plan), persisted daily briefing, replaces
  the Sprint-1 `/overview` empty state with actual ranked items +
  "why it matters" + useful/irrelevant feedback + send-to-generation.

- [ ] **Sprint 7 — Competitor intelligence (Phase 6)**
  Competitor entity (reuses `sources` table per plan §10.2), RSS/newsletter/
  changelog/manual sources, AI competitor review, wire real content into
  `/competitors` (replacing the Sprint-1 stub).

- [ ] **Sprint 8 — Generation workspace unification (Phase 7)**
  Connect Knowledge retrieval + Brand snapshot + Market/Competitor context
  into `/generate` in one flow with visible selected chunks, refinement,
  version history.

- [ ] **Sprint 9 — Manual performance & feedback (Phase 8)**
  Manual publication/metrics entry, AI hypothesis analysis labeled as such
  ("Предположение AI"), explicit-signal learning loop (no automatic Brand
  OS rewrites, per plan §11.4).

- [ ] **Sprint 10 — Hardening (Phase 9)**
  Auth/workspace separation/RLS review, retry logic, scheduled task logs,
  model fallback, cost limits, E2E test for the core journey (Overview →
  Market → Knowledge → Generation → Review → Manual Performance).

## Explicitly deferred (plan §15 — do not build without a product conversation)

Twelve-agent architecture · DOCX/PDF/PPTX/OCR parsing · automatic policy
conflict graph beyond what already exists · page-snapshot diff for
competitors · protected social scraping · automatic social analytics ·
direct social publishing · automatic Brand OS learning · autonomous
campaign decisions.
