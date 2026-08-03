# Amado — project handoff

**Repository:** `paalverteller/amado`  
**Working branch:** only `main`  
**Product:** AI-first workspace for a digital marketing manager working with the Brazilian market  
**UI language:** Russian  
**Generated marketing content:** primarily Brazilian Portuguese (`pt-BR`)  
**Last updated:** 2026-08-03

---

## 1. Purpose of this document

This file is the starting context for a new ChatGPT dialogue.

The previous dialogue became too large. Do not reconstruct the project from memory or from old assumptions. Start from:

1. this file;
2. the current `main` branch;
3. a fresh Repomix export;
4. actual Supabase schema verification;
5. current build/test output.

The repository is the source of truth. This document describes intended state and known risks, but runtime and database state must still be verified.

---

## 2. Product direction

Amado should become a lean AI-first marketing workspace with one sequential AI workflow, not a network of many specialized agents.

Core product flow:

```text
Market and evidence
        +
Brand rules and positioning
        +
Private knowledge fragments
        ↓
Grounded generation
        ↓
Review, history and later performance feedback
```

The product should help a marketing manager:

- understand current market signals;
- maintain editable Brand OS rules;
- store internal books, reports, notes and guidelines;
- generate platform-specific content;
- know exactly which market sources, brand version and knowledge fragments were used;
- review and refine content without silently changing brand rules;
- later record performance manually.

Do not turn Amado into a generic AI copywriter or a complex multi-agent platform.

---

## 3. Operational rules

### Git

- Work only in `main`.
- Push directly to `origin/main`.
- Before every change:
  - `git status --short`
  - confirm branch is `main`;
  - confirm no unrelated local changes.
- Prefer one self-contained Python patch script per sprint.
- Patch scripts should support:
  - `--check`
  - `--apply`
  - `--verify`
  - `--commit`
  - `--push`
- Remove temporary patch scripts after use.
- Never commit:
  - `repomix-output*.xml`;
  - `tsconfig.tsbuildinfo`;
  - `.next/`;
  - temporary `fix*.sh`;
  - `apply_sprint*.py`;
  - secrets or `.env` files.

### Engineering

- Make surgical changes.
- Do not refactor unrelated working code.
- Preserve the existing working generation flow.
- Validate every sprint with:

```bash
git diff --check
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

- Do not claim a feature works merely because TypeScript compiles.
- Any feature touching Supabase needs runtime verification against the real database.
- Do not add more schema layers until current migrations and runtime schema are reconciled.

### Product constraints

- Russian UI.
- Brazilian Portuguese output and market context.
- One sequential AI workflow.
- No direct social publishing in the MVP.
- No automatic rewriting of Brand OS based on performance.
- No broad competitor scraping.
- Prefer RSS, public APIs, newsletters and manually supplied text.
- Uploaded knowledge is text-first: paste, TXT and Markdown.
- Keep graceful fallback behavior when embeddings or a new database migration are unavailable.

---

## 4. Completed repository work

### Review remediation

The previous repository review remediation was merged into `main`.

Important foundations already present:

- split Supabase client;
- repository layer for articles and content requests;
- centralized API error helpers;
- unified AI fallback logic;
- source health and ingestion infrastructure;
- content request processing;
- production build and lint remediation.

### Sprint 1 — Russian workspace shell

Implemented:

- Russian default UI dictionary;
- Russian navigation;
- `/overview`;
- `/knowledge`;
- `/competitors`;
- post-login redirect to `/overview`;
- Vitest configuration;
- initial roadmap and schema audit documentation.

### Sprint 2 — sidebar and design tokens

Implemented:

- fixed 240px desktop sidebar;
- retained mobile top bar and mobile bottom navigation;
- moved `--v2-*` design tokens into live `app/globals.css`;
- removed unused `styles/design-tokens.css`.

The old M3 components still exist on older pages. Do not attempt a global visual rewrite together with a functional sprint.

### Sprint 3 — text-first Knowledge Library

Implemented:

- migration `038_knowledge_library.sql`;
- `knowledge_assets`;
- `knowledge_chunks`;
- pgvector extension;
- `match_knowledge_chunks` RPC;
- additive migration of legacy books into pending knowledge assets;
- text normalization;
- language detection;
- chunking;
- optional OpenAI embeddings;
- keyword fallback;
- Knowledge repository;
- Knowledge API:
  - list/create;
  - get/update/delete;
  - reindex;
  - search;
- Russian `/knowledge` UI;
- TXT/Markdown/paste input;
- activation, deletion and reindex controls;
- chunk search and selection UI;
- chunking regression tests.

Known limitation:

- processing is synchronous;
- maximum text size is 300,000 characters;
- semantic search requires both:
  - `AMADO_HYBRID_SEARCH_ENABLED=1`;
  - `OPENAI_API_KEY`;
- without them, keyword search should still work.

### Sprint 4 part 1 — Brand workspace repairs

Implemented:

- fixed invalid queries against nonexistent `brands` table;
- Brand overview now uses `brand_profiles`;
- corrected region locale field;
- corrected active rule-set and rule counts;
- fixed brand loading in playbook generation;
- added `GET /api/brands`;
- replaced hardcoded brand selector;
- added publish/restore endpoint for Brand rule-set versions;
- added publish/restore controls;
- wrapped `/brand` in the common Layout;
- translated Brand shell, Overview and Versions areas to Russian;
- normalized the Brand Versions API contract.

Still incomplete:

- remaining Brand tabs are not fully translated;
- several Brand tabs are read-only;
- tab structure has not yet been consolidated;
- Brand documents are not yet managed as a dedicated relationship;
- advanced Brand packages, QA and learning code must not be assumed reliable without schema review.

### Sprint 5 — grounded generation vertical slice

Intended/implemented by `apply_sprint5_grounded_generation.py`:

- migration `039_grounded_generation.sql`;
- canonical generation format normalization;
- safe support for legacy format names;
- Russian Generation workspace;
- explicit platform/content format;
- explicit generation objective;
- active brand selector;
- region and generation profile selectors;
- Knowledge search from Generation;
- selection of up to four exact knowledge chunks;
- exact knowledge chunk IDs passed to generation;
- Brand snapshot compiler using:
  - brand profile;
  - active rule set;
  - approved rules;
  - brand terms;
  - claims;
  - active platform playbook;
- Market/evidence context combined with Brand and Knowledge context;
- exact article ID returned by generation;
- provenance saved to content requests and article history;
- compatibility fallback if migration 039 has not yet been applied;
- format regression tests;
- Russian application metadata and login cleanup;
- Google Fonts import warning cleanup.

Verify this against the current repository. Do not assume Sprint 5 is complete solely from this document.

---

## 5. Supabase state

### Migrations that must exist

```text
038_knowledge_library.sql
039_grounded_generation.sql
```

Correct application order:

```text
038 → 039
```

### Migration 038 creates

- extension `vector`;
- table `knowledge_assets`;
- table `knowledge_chunks`;
- vector index;
- function `match_knowledge_chunks`;
- initial migration of legacy `books` content.

### Migration 039 adds

To `content_requests`:

- `knowledge_chunk_ids`;
- `generation_context`;
- `brand_snapshot`.

To `articles`:

- `generation_context`.

It also updates `match_knowledge_chunks` so brand-scoped searches can include:

- assets attached to the chosen brand;
- global assets where `brand_id IS NULL`.

### Important database warning

Do not run a blind global:

```bash
supabase db push
```

The repository historically contained duplicate migration prefixes, including `022` and `023`, plus several repair/seed migrations. Local migration history and the actual production schema need reconciliation first.

Before creating migration 040, verify:

```sql
select extname, extversion
from pg_extension
where extname = 'vector';

select to_regclass('public.knowledge_assets');
select to_regclass('public.knowledge_chunks');

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'match_knowledge_chunks';

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'content_requests'
      and column_name in (
        'knowledge_chunk_ids',
        'generation_context',
        'brand_snapshot'
      ))
    or
    (table_name = 'articles'
      and column_name = 'generation_context')
  )
order by table_name, column_name;
```

Also verify that the actual Brand tables and columns match code before modifying Brand APIs.

### RLS warning

Knowledge tables currently use permissive MVP policies consistent with older repository patterns. This is not acceptable for a multi-user product.

Do not tighten RLS casually before deciding:

- authentication model;
- workspace model;
- ownership fields;
- service-role boundaries.

This belongs to the hardening phase.

---

## 6. Environment variables

Expected existing variables include Supabase and AI provider credentials.

For semantic Knowledge search:

```text
AMADO_HYBRID_SEARCH_ENABLED=1
OPENAI_API_KEY=...
```

The application should still provide keyword search if semantic search is disabled or unavailable.

Never commit environment values.

---

## 7. Required runtime acceptance test

Before starting the next feature sprint, validate the current vertical flow end to end.

### A. Knowledge Library

1. Open `/knowledge`.
2. Add a short TXT, Markdown or pasted note.
3. Confirm:
   - asset is created;
   - status becomes `ready`;
   - chunks are created;
   - keyword search finds a phrase from the text.
4. With semantic search enabled:
   - search using a related phrase not copied verbatim;
   - verify `semantic` mode;
   - inspect similarity results.
5. Deactivate the asset and confirm it is excluded from search.
6. Reindex and confirm chunks are replaced cleanly.
7. Delete and confirm cascading chunk deletion.

### B. Brand workspace

1. Open `/brand`.
2. Confirm brand selector loads real UUIDs.
3. Confirm Overview loads without 404.
4. Confirm active rule-set counts.
5. Open Versions.
6. Publish a draft or restore an archived version.
7. Confirm only one version remains active.
8. Confirm the Generation workspace reports the active version after generation.

### C. Grounded Generation

1. Open `/generate`.
2. Select a brand.
3. Select a platform/format and objective.
4. Search Knowledge.
5. Select one to four chunks.
6. Generate content.
7. Confirm:
   - output is `pt-BR`;
   - output follows the selected format;
   - internal source labels and chunk IDs are not exposed;
   - exact article ID is returned;
   - history opens the generated article;
   - the content request stores exact chunk IDs;
   - `generation_context` is populated;
   - `brand_snapshot` is populated;
   - the article stores generation context;
   - Brand version is visible.
8. Generate another version after adding a refinement.
9. Rate the article.
10. Run the existing editorial AI check.

### D. Compatibility fallback

In a non-production test environment, confirm application behavior when migration 039 columns are unavailable:

- generation should continue;
- repository should log a compatibility warning;
- data should save using the legacy schema;
- Knowledge selection should still affect the prompt even if provenance columns cannot be saved.

---

## 8. Known technical risks

### Migration history

Duplicate and repair migrations remain the largest structural risk.

Do not add migration 040 until producing:

- actual remote schema dump;
- local migration inventory;
- applied migration list;
- reconciliation decision.

### Schema drift in advanced Brand OS

The original repository audit found probable mismatches in:

- guideline import;
- guideline conflicts;
- packages;
- assets;
- advanced QA;
- learning/performance APIs.

Do not reuse these APIs blindly. Compare every field with actual migrations and the real database.

### Market source of truth

RSS ingestion and evidence ingestion coexist.

The application still needs one clear source of truth for:

- Market list;
- source provenance;
- hydration status;
- relevance;
- briefing generation.

Prefer `evidence_items` as the long-term canonical layer, but migrate deliberately and preserve existing RSS behavior until runtime-tested.

### Overview is still mostly a shell

The real persisted daily briefing does not yet exist.

Do not build the briefing UI before defining:

- persisted briefing entity;
- signal entity;
- ranking logic;
- feedback lifecycle;
- evidence links;
- knowledge links;
- send-to-generation action.

### Competitors are still a shell

No real competitor entity and workflow is complete.

Avoid broad scraping. Start with:

- competitor profile;
- RSS;
- changelog;
- newsletter;
- manual note;
- review queue;
- send-to-generation.

### Security

Current product is an MVP with a password gate, not a complete multi-user workspace.

Still missing:

- real user authentication;
- workspace tenancy;
- strict RLS;
- audit log;
- rate limiting;
- secrets governance;
- queue/dead-letter handling.

---

## 9. Next work plan

### Priority 0 — fresh repository audit

Before writing new code:

1. Create a fresh Repomix export excluding generated files.
2. Review current `main`.
3. Inspect Git log since Sprint 5.
4. Verify build and tests.
5. Verify Supabase 038 and 039.
6. Compare current APIs to actual database schema.
7. Update this file if repository reality differs.

Recommended Repomix command:

```bash
npx repomix \
  --ignore "node_modules/**,.next/**,tsconfig.tsbuildinfo,repomix-output*.xml,coverage/**"
```

### Priority 1 — runtime remediation sprint

Fix only problems discovered during the end-to-end acceptance test.

Examples:

- incorrect Supabase column name;
- RLS failure;
- generation format mismatch;
- malformed streamed response;
- missing article ID;
- Knowledge search filter bug;
- Brand snapshot compilation failure;
- history rendering issue.

Do not mix new features into this remediation sprint.

Definition of done:

- Knowledge upload/search works;
- Brand overview/versioning works;
- selected chunks affect generation;
- provenance is saved;
- history opens exact article;
- full verification passes.

### Priority 2 — Brand workspace part 2

After the vertical flow works:

1. Translate remaining tabs.
2. Audit each tab against actual schema.
3. Add editing for:
   - Brand foundation;
   - audience;
   - products;
   - tone and style;
   - approved claims;
   - forbidden claims;
   - preferred and forbidden vocabulary;
   - platform rules;
   - examples;
   - compliance.
4. Decide whether to preserve 10 tabs or consolidate into a smaller product structure.
5. Add clear draft/review/publish lifecycle.
6. Add a read-only compiled Brand Snapshot preview.
7. Link brand-source Knowledge assets explicitly.

Do not write a new parallel Brand schema.

### Priority 3 — persisted Overview and daily briefing

Build only after Market, Brand, Knowledge and Generation are stable.

Proposed minimal entities:

- `daily_briefings`;
- `market_signals`;
- `signal_feedback`.

Minimal flow:

1. ingest evidence;
2. cluster or deduplicate;
3. rank for selected brand;
4. generate 5–7 signals;
5. explain why each matters;
6. attach evidence;
7. attach relevant private knowledge;
8. allow useful/not relevant feedback;
9. send a signal to Generation.

Do not generate a new briefing on every page load. Persist it.

### Priority 4 — source ingestion completion

Add:

- manual URL source;
- pasted article;
- approved newsletter sender;
- email-to-text ingestion;
- source allowlist;
- better hydration;
- deduplication;
- canonical evidence linkage.

Move Market reads toward the evidence layer without breaking existing RSS workflows.

### Priority 5 — simple competitor intelligence

Add:

- competitor entity;
- profile page;
- RSS/newsletter/manual-note sources;
- change detection;
- human review;
- send-to-generation.

No unrestricted competitor scraping.

### Priority 6 — manual performance

Add manual performance entry:

- platform;
- format;
- publication date;
- impressions;
- reach;
- clicks;
- saves;
- shares;
- comments/replies;
- leads;
- revenue if manually known;
- qualitative note.

AI may summarize patterns, but must:

- distinguish observation from causal inference;
- avoid claiming direct social-platform access;
- never auto-edit Brand OS;
- propose changes for human approval only.

### Priority 7 — hardening

After product validation:

- real auth;
- workspace tenancy;
- RLS;
- audit trail;
- background processing;
- retries;
- dead-letter handling;
- rate limits;
- observability;
- backup and restore;
- integration tests.

---

## 10. Recommended next sprint

The next sprint should be:

```text
Runtime acceptance and schema remediation
```

Not:

- Daily Briefing;
- competitors;
- performance learning;
- another schema expansion.

The next coding agent should first test the current grounded generation slice against the actual Supabase database, collect concrete failures, and create one surgical remediation patch.

Expected deliverable:

```text
apply_sprint6_runtime_remediation.py
```

It should support:

```text
--check
--apply
--verify
--commit
--push
```

It must not add a new migration unless runtime evidence proves one is required and migration history has first been reconciled.

---

## 11. Prompt for the next ChatGPT dialogue

Use this as the first message in the new dialogue:

```text
Мы продолжаем проект Amado.

Работаем только в main и пушим прямо в origin/main.
UI приложения — русский, генерируемый маркетинговый контент — pt-BR.
Нельзя ломать существующую генерацию, рефакторить несвязанный код или добавлять новую параллельную схему.

Сначала прочитай handsoff.md и свежий repomix-output.xml.
Затем проверь фактическое состояние репозитория после Sprint 5 и сопоставь его с handsoff.md.
Отдельно проверь контракты Supabase migrations 038 и 039.
Не начинай новый feature sprint, пока не составишь список конкретных runtime/schema рисков.

Следующая задача: подготовить apply_sprint6_runtime_remediation.py.
Он должен исправлять только подтверждённые проблемы текущего вертикального сценария:
Brand + Knowledge + Market/Evidence → Generation → History/provenance.

Скрипт должен поддерживать:
--check
--apply
--verify
--commit
--push

Перед кодированием дай краткий аудит:
1. что реально реализовано;
2. какие контракты не совпадают;
3. что нужно проверить в реальном Supabase;
4. какие изменения войдут в Sprint 6;
5. что сознательно не войдёт.
```

---

## 12. Final principle

The next milestone is not “more pages”.

It is a reliable and inspectable end-to-end workflow:

```text
Selected market evidence
        +
Published Brand version
        +
Selected private Knowledge chunks
        ↓
Generated content
        ↓
Exact provenance in history
```

Do not proceed to Overview, competitors or learning until this path works consistently in production.
