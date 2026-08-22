# Amado — HANDOFF.md

Read this first in a new conversation, then read `docs/AMADO_ROADMAP.md` for full sprint-by-sprint detail and `docs/SCHEMA.md` for the database.

## What this is

Amado — B2B-маркетинг AI-платформа для команды, продвигающей бренд на бразильском рынке.

- **UI-язык:** русский (интерфейс, аналитика, внутренние выводы ИИ — например "почему это важно" в брифинге, гипотезы по перформансу)
- **Язык контента:** pt-BR (сгенерированные статьи/посты для бразильской аудитории — это не то же самое, что UI-язык; не путать)
- **Стек:** Next.js 16 (App Router), React 19, TypeScript strict, Supabase (pgvector), Tailwind 4, Vercel AI SDK v6, Vitest, Playwright (не запускался)
- **AI-провайдеры:** Google Gemini → Groq → OpenAI → DeepSeek, фолбэк-цепочка с quota-cooldown (`lib/ai.ts`)
- **Репозиторий:** `paalverteller/amado`, ветка `main`, прямые коммиты (без PR)

## Текущее состояние

**Все 10 спринтов лин-плана пройдены** (`docs/AMADO_ROADMAP.md`, каждый отмечен `[x]` с деталями что реально сделано / что нет), плюс Sprint 4B и несколько пост-деливери хотфиксов, плюс раунд чистки мёртвого кода (см. ниже).

Если этот файл открыт в новой беседе — **сначала прочитай `docs/AMADO_ROADMAP.md` целиком**, не пересказывай его здесь заново. Ниже — только то, что не попадает в формат «спринт → что сделано».

## После десятого спринта: деплой + чистка

- **Supabase:** обнаружилось, что рабочая база к моменту деплоя была почти пустой (только `articles`/`brand_profiles`/`prompt_templates`/`rss_items`/`rss_sources` — таблицы из самых первых миграций 000/001, ни `content_requests`, ни Brand OS, ни `knowledge_assets`). Решили не распутывать историю, а поднять **новый чистый проект Supabase**. Собран `full_schema.sql` — все 36 файлов из `supabase/migrations/` в проверенном порядке (не по алфавиту: историческая пара `022_pivot_phase1_cleanup_and_seed` должна идти **до** `022_amado_baseline`, хотя по имени файла наоборот). При сборке нашёл и поправил: `articles` создаётся дважды в истории (`000` и `001`) с разными CHECK-constraint'ами на `content_type` — версия из `000` обязана победить (её ограничение реально соответствует тому, что пишет код), но тогда колонка `book_source` (есть только в `001`) молча теряется — она была явно добавлена отдельным `ALTER TABLE` в собранный файл, с комментарием прямо в SQL.
  **Не подтверждено, реально ли выполнен `full_schema.sql`** на новой базе — если новая сессия начинается с деплоя, проверить это первым делом, не полагаться на то, что уже сделано.
  **Исправлено Sprint 11:** migration 045 расширяет `articles.content_type` CHECK и разрешает `telegram_post`.
- **Чистка мёртвого кода** (после деплоя): удалено 14 файлов приложения (2 сиротских React-компонента, 12 API-роутов с нулём вызовов И подтверждённой рабочей заменой — не просто "не найдено использований", а именно "есть живой аналог") + `@ai-sdk/react` из зависимостей (ноль импортов). **База данных не тронута** — собственное архитектурное решение проекта (strangler-fig, см. `docs/AMADO_ROADMAP.md`) требует явного отдельного решения перед удалением таблиц; убрать роут — обратимо, уронить таблицу — нет. `full_schema.sql` от этой чистки не меняется.
  Флагнуто, но **не удалено** намеренно: `app/analytics` + `/api/analytics/pipeline` — рабочая страница, просто без ссылки в навигации `Layout.tsx` (добавить ссылку или удалить — отдельное решение, не путать с мёртвым кодом); `/api/content-requests`(+`/process`) — рабочий альтернативный путь генерации через очередь, просто не подключён в `vercel.json` cron.
  Известные оставшиеся кандидаты в `lib/` (не удалялись, не проверялись так же строго как API-роуты): `lib/api/errors.ts`, `lib/brand-os/precedence.ts`, `lib/domain/region.ts`, `lib/domain/content-request.ts` — ноль импортов при грепе, не факт что действительно мертвы (могут быть типами для будущего использования), не трогал без такой же тщательной проверки, как для роутов.

## Sprint 11 — Marketer Control Center (2026-08-14)

- `/overview` теперь настоящий home screen: Today, Needs attention, кампании, ближайший контент, последние показатели, market opportunities и объяснимая Content intelligence.
- Миграция `045_marketer_control_center.sql`: `marketing_campaigns`, `articles.scheduled_for`, связи кампаний с `articles/content_requests`, bridge `content_pattern_usage` к реальным `articles`, исправление `telegram_post` CHECK.
- Аналитика hooks/topics/content pillars/CTA/length/formats/platforms строится только по реальным performance snapshots. Классификация детерминированная с `analysis_evidence`; fatigue/recommendations не меняют Brand OS автоматически.
- Исправлена цепочка данных: market feed теперь выдаёт `evidence_items.id`; single/batch generation сохраняют exact evidence lineage; direct competitor evidence + competitor reviews/RAG попадают в генерацию; `knowledge_chunk_ids` хранит chunk IDs; stream возвращает exact `articleId`.
- Single/batch API теперь сами выбирают active/default brand, если клиент не передал его — Brand OS и competitor context не исчезают на first-use. `/generate` переведён с legacy UI values (`social_post`/`thread`/`carousel`) на canonical content formats — это был реальный несовместимый контракт с `/api/generate`. Batch generation теперь использует тот же canonical orchestrator.
- Добавлен `scripts/verify-amado-chain.mjs` + unit/regression tests. Полный `--verify` по правилам проекта должен выполняться в рабочем clone с установленными dependencies.

## Как здесь ведётся разработка (важно для новой сессии)

- **Формат поставки:** Python-скрипт с `--check/--apply/--verify/--commit/--push`, содержимое файлов зашито внутри скрипта целиком (полная перезапись, не патчи).
- **Все команды — через `&&`**, не построчно: упавший `--verify` должен реально блокировать `--commit`.
- **Перед доставкой — реальный тест-цикл в песочнице**: сбросить к чистой базе, `--apply → --verify → --apply снова (идемпотентность) → --commit → --commit снова`. Несколько реальных багов (ниже — proxy.ts/middleware.ts, ложные срабатывания грепа) пойманы именно так, не убеждением, что код "выглядит правильно".
- **Один спринт/задача — один консолидированный скрипт**, не несколько с пересекающимися файлами. Однажды два скрипта Sprint 5 независимо переписывали `lib/rss.ts` целиком — какой применился последним, тот и победил, второй потерялся молча.
- **Обновления `docs/AMADO_ROADMAP.md` — коммить explicit'но**, отдельной командой, не полагаясь на то, что следующий скрипт подхватит через `git add -A`. Уже один раз привело к потере обновлений за 4 спринта — восстановлены и перепроверены через `git show` 2026-08-11.
- **`.gitignore` матчит `apply_*.py`** (расширено с `apply_sprint*.py` — новый скрипт для чистки кода чуть не попал в коммит той же самой командой, для которой существует правило). Если появляется новый паттерн имени скрипта — проверить, что gitignore его тоже ловит, **до** коммита, не после.
- **Next.js 16: файл называется `proxy.ts`, не `middleware.ts`.** В проекте уже был готовый `proxy.ts` с рабочей авторизацией до начала всей этой работы — не заметил его в Sprint 10, создал конфликтующий `middleware.ts`, сломал сборку. `npm run build` — часть `--verify`, не только `tsc --noEmit` — именно сборка ловит такие конфликты, тайпчек их не видит.
- **Грепом на "используется/не используется" нужно проверять точный паттерн вызова, не подстроку.** Дважды ловил ложные срабатывания в собственных проверках: слово "prompts" совпадало и с удалённым роутом `/api/prompts`, и с повсеместно используемым `lib/prompts.ts`; аналогично с путями вида `/api/brands/[brandId]/...` — соседние роуты с общим префиксом путаются, если не сверять по каждому файлу отдельно.

## Что осознанно не сделано (не забыть, не блокирует)

- **`/api/cron/auto-generate`** — легаси-крон из до-пивотного психологического продукта, активен в `vercel.json` (06:00 UTC), пишет случайную статью в `articles` ежедневно. Ждёт решения — выключать или нет.
- **`handsoff.md`** в корне репо — отдельный документ для ChatGPT-сессий, описывает нереализованный "Sprint 5 — grounded generation", которого нет в реальном коде. Не трогал.
- **Реальное разделение workspace/пользователей** — нет модели сессий, один общий пароль (`ACCESS_PASSWORD`).
- **E2E-тест** (`e2e/core-journey.spec.ts`) — написан по реальным селекторам, ни разу не запускался.

## Деплой (Vercel)

Обязательные переменные: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_PASSWORD`, `CRON_SECRET`, плюс хотя бы один ключ ИИ-провайдера (`GOOGLE_GENERATIVE_AI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`). Полный список опциональных флагов — в `lib/amado-config.ts`, у каждого есть безопасное значение по умолчанию.

## Где что искать

- `docs/AMADO_ROADMAP.md` — полная история спринтов, архитектурные решения
- `docs/SCHEMA.md` — схема БД (сгенерирована для Sprint 1, устарела — миграции 024–044 добавили много нового, сверяйся с `supabase/migrations/`, не только с этим документом)
- `CLAUDE.md` — правила работы в этом репо
- `lib/amado-config.ts` — все env-флаги и их значения по умолчанию

<!-- AUGUST_GUI_HANDOFF_START -->
## August GUI / PWA baseline — 2026-08-14

August Design System v1.0 is the canonical Amado UI contract.

- Do not reintroduce the retired cornflower/orange visual identity or Playfair.
- Semantic anchors: Ink `#171927`, Canvas `#F7F8FC`, Surface `#FFFFFF`, Accent `#6E5CF6`, Accent Dark `#5140DC`, Growth Lime `#D7FF61`, Navy `#15172A`.
- `app/globals.css` owns the August tokens plus compatibility mappings for legacy `m3-*` and `--v2-*` contracts. New UI should use `aug-*` primitives instead of adding another design layer.
- Desktop navigation is the dark 280/230px sidebar. Mobile/PWA has exactly five top-level destinations: Overview, Market, Create, History, More.
- Standard feedback lives in `components/ui/AugustFeedback.tsx`; use `toast.*` and `confirmAction(...)` instead of new `alert()`/`window.confirm()` call sites.
- Standard modal geometry lives in `components/ui/AugustDialog.tsx`.
- PWA identity is Amado and starts at `/overview`; manifest/theme/cache names must not regress to Kupala.
- `scripts/verify-august-ui.mjs` is mandatory in GUI verification.
<!-- AUGUST_GUI_HANDOFF_END -->

<!-- AMADO_MVP_RUNTIME_REPAIR_V1 -->
## MVP runtime repair — Supabase + Brazil SaaS + Google AI Studio

Production logs on 2026-08-14 showed the same `Invalid path specified in request URL`
failure across Market, Brands, Templates, Knowledge, Competitors and article
persistence. The common dependency is Supabase Data API access, not the individual
routes. `lib/supabase/client.ts` now normalizes a mistakenly pasted Supabase service
endpoint (`.../rest/v1`, `.../auth/v1`, etc.) back to the project origin and rejects
other non-origin paths with an actionable error. `/api/admin/runtime-health` checks
database connectivity and AI configuration without returning secrets.

MVP AI default is Google AI Studio. `GEMINI_API_KEY` and
`GOOGLE_GENERATIVE_AI_API_KEY` are both accepted. Generation starts with
`AMADO_GOOGLE_MODEL_PRIMARY` (default `gemini-3-flash-preview`) and falls back
through `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, and
`gemini-3.5-flash-lite`, with the existing per-model quota cooldown/fail-fast
mechanism retained.

`supabase/seeds/002_mvp_brazil_saas.sql` is the additive production seed for the
MVP market workspace: Brazil market sources plus Salesforce, monday.com and Slack
as tracked competitors using the existing `rss_sources -> evidence_items ->
competitor review -> Knowledge/RAG` pipeline.

The legacy pre-pivot `/api/cron/auto-generate` schedule is removed from
`vercel.json`; the route itself is left intact for history/surgical scope.
Do not run historical `supabase db push` merely to apply this seed: the current DB
was established from the manually consolidated clean baseline. Use SQL Editor for
the additive seed.

<!-- AMADO_FINAL_WORKSPACES_V1 -->
## Final workspace sprint — localization, prompt library, SEO, market analysis, Brand OS editing

Canonical workspaces added:
- `/localize`: source-language copy -> natural pt-BR, with context modes and Brand OS.
- Settings now contains Prompt Library. Prompt text is data in `prompt_templates`;
  X/Facebook/Instagram/LinkedIn/SEO/localization/market-analysis profiles can be edited
  without deployment, and custom profiles can be created.
- `/generate/seo`: grounded SEO article workspace using the normal generation/persistence
  pipeline and up to 10 recent evidence items.
- `/market/analysis`: strict 60-day SME Brazil report. The model receives only collected
  evidence, must cite supplied evidence IDs, and is told explicitly not to invent live
  web facts. Successful reports are saved/indexed into Knowledge when possible.
- Brand page exposes a wide Brand OS editor for core profile fields plus existing content
  pillars and vocabulary terms. It writes the same tables consumed by BrandSnapshot.
- `proxy.ts` treats static asset extensions as public. This fixes the August mark/favicon
  on the unauthenticated password screen; previously `/amado-icon.svg` was redirected.

Database activation is additive seed `supabase/seeds/003_final_workspaces.sql`.
It uses `ON CONFLICT (name) DO NOTHING` for prompts on purpose: future re-runs never
overwrite human edits made in Settings. Do not use historical `supabase db push` merely
to install this seed; the production DB still follows the manually consolidated baseline.

<!-- AMADO_MULTI_MARKET_V1 -->
## Sprint 12 — Multi-market support (in progress, phased delivery)

Goal: a market switcher (top-right dropdown, Brazil default, Spain added next)
that changes prompts, output language, and localization end-to-end when
switched. Explicitly requested to ship **phased**, one small verified patch
per turn, not one large sprint script — each phase gets its own
`apply_*.py` + Supabase SQL block.

**Scope decision (made by Claude, flagged for confirmation, not yet
challenged):** switching market **filters** existing brands/competitors by
region rather than creating a fully parallel workspace. Reasoning: every
region touchpoint already built (`brand_profiles.region_id`,
`rss_sources.region_id`, `articles.region_id`) is a nullable FK, not a
partition key — building on that shape is far lower-risk than introducing
RLS/scoping rewrites across API routes for a parallel-workspace model. Revisit
explicitly if real workspace isolation is needed later (e.g. a customer wants
separate seats/teams per market, not just separate content).

**Phase 1 (this delivery) — schema + prompt-layer scaffolding, no UI yet:**
- `supabase/seeds/005_spain_region.sql`: inserts and activates `ES` in
  `regions` (es-ES, EUR, Europe/Madrid). It was never seeded before —
  migration 023 only seeded `BR` (active) and `MX`/`IT` (inactive
  placeholders), not `ES` at all.
- `lib/prompts.ts`: added an `ES` entry to `buildRegionContextLayer`'s
  `culturalNotes` map (tú/usted register, Bizum, Spanish holidays, European
  vs Latin American Spanish). This layer is separate from and does **not**
  fix `buildUserPrompt`, which still hardcodes Portuguese/Brazil directly in
  every content-format template — that hardcoding is the real blocker for
  actual Spanish output and is explicitly Phase 2+, not touched here.
- `lib/locale.ts`: added `REGION_LOCALES` + `resolveRegionLocale()` as a
  synchronous region-code → {locale, currency, timezone} lookup, purely
  additive (new exports only). Existing Brazil-specific helpers
  (`formatCpfCnpj`, `formatPhoneBR`, `hasEuropeanPortugueseMarkers`,
  `looksLikePtBr`) are untouched — deciding what their Spain equivalents
  should be (IBAN? DNI/NIF? a European-Spanish-vs-LatAm detector?) is a
  product decision for a later phase, not guessed at here.

**What Phase 1 deliberately does NOT do:** no dropdown UI (there is currently
no top-right header region in `Layout.tsx` at all — desktop is sidebar-only,
mobile is bottom-nav-only, so that's new UI surface, not a tweak); no
selected-market state (cookie/session/`user_preferences` — table exists,
unused by any route today, still needs a decision on read/write pattern); no
fix to `buildUserPrompt`'s hardcoded Portuguese; no Spain-market RSS/brand
seed (would mirror `supabase/seeds/001_brazil_sources.sql`'s pattern once a
Spanish brand/vertical is confirmed).

**Planned remaining phases** (order not fixed, revisit per conversation):
1. Wire selected-market state (decide storage: cookie vs `user_preferences`)
   + build the header UI region + dropdown component.
2. Fix `buildUserPrompt` to read region instead of hardcoding pt-BR (the
   6 template branches listed in the file's own comment).
3. Filter brand/competitor/market-feed queries by selected region across
   the relevant API routes.
4. Seed Spain market sources + at least one Spain brand profile, mirroring
   the Brazil seed pattern.

### Phase 2 (this delivery) — selected-market state + header dropdown UI

- New `lib/market-context.tsx`: client-only module, deliberately separate
  from `lib/i18n/config.ts`'s `Locale`/`t()` system (that's UI language --
  ru/pt-BR/en labels; this is which market/region the workspace is scoped
  to -- never conflate the two, per existing project convention).
  - Storage: a plain cookie (`amado_market`), not `user_preferences`.
    Reasoning: there is no per-user session model in this app (single
    shared `ACCESS_PASSWORD`, see `proxy.ts`) -- there is no user row to
    key a `user_preferences` record against today. If real accounts land
    later, migrating is isolated to `getStoredMarketCode`/
    `setStoredMarketCode` in this one file.
  - `MarketProvider` fetches `GET /api/regions` (already existed, already
    filters `active=true` -- Spain shows up automatically now that Phase 1
    activated it) and exposes `{ marketCode, regions, setMarketCode }` via
    a small React Context.
- New `components/MarketSwitcher.tsx`: the dropdown itself -- flag + name +
  chevron trigger, click-outside/Escape to close, checkmark on the active
  option. Reused inside both the new desktop top bar and the existing dark
  mobile header (compact variant, flag + chevron only, no label).
- `components/Layout.tsx`: wraps the whole shell in `MarketProvider`. Added
  a new `.aug-topbar` strip (desktop only, `>780px`) above
  `.aug-workspace__main` holding the switcher top-right, and slotted the
  compact switcher into the existing mobile header next to the Create
  button. No existing nav/routing logic touched.
- `app/globals.css`: new `.aug-topbar` / `.aug-market-switcher*` rules only,
  appended after the existing `AUGUST_SYSTEM_V1_END` content block. Reused
  existing tokens (`--aug-border`, `--color-primary`, `--color-primary-container`,
  `aug-fade` keyframe) -- no new design tokens introduced.

**What Phase 2 deliberately does NOT do:** the dropdown changes
`marketCode` in React state + the cookie and nothing else yet. No API route
reads it, `buildUserPrompt` still hardcodes Portuguese/Brazil, brand/
competitor/market-feed queries are not filtered by it. Selecting "España"
today only changes what the switcher itself displays -- that's expected and
matches the phase plan; Phase 3 is what makes the selection actually do
something.

### Phase 3 (this delivery) — buildUserPrompt reads region instead of hardcoding pt-BR

- `lib/prompts.ts`:
  - New `resolveRegionProfile(regionId)`: resolves a regionId to
    `{ code, name, locale, languageName }`. Deliberately separate from
    `buildRegionContextLayer`, whose `Promise<string>` return is
    interpolated directly into system prompts at both call sites -- changing
    its shape would have silently broken those. Falls back to the Brazil
    profile for a missing/inactive/unknown region, so every call site that
    doesn't pass a `regionId` keeps generating byte-identical output to
    before this phase.
  - New `resolveLanguageProfile()` internal helper picks
    `{ languageName, marketAdjective, marketLabel, seasonalityExample }`
    from `spec.regionContext`. Currently branches Brazil vs. Spain
    explicitly (checked by `locale === 'es-ES'`, not by fuzzy name
    matching) and falls through to a generic "use the resolved name"
    branch for any other region added later without market-specific
    copy written yet.
  - `buildUserPrompt`: every hardcoded "Portuguese (Brazil)" / "Brazilian
    market" / "Brazilian dates" string across all 4 branches (quick_note,
    x_thread, instagram_carousel, long-form) now reads from the resolved
    language profile. No regionContext passed -> identical Brazil wording
    as before (verified in `lib/prompts.test.ts`, new file).
  - `buildLocalizationNotesPrompt`: gained an optional 4th `regionProfile`
    param, defaults to Brazil when omitted -- existing 3-arg call sites
    unaffected.
- `lib/content-generation/generate-article.ts` (`generateAndPersistArticle`,
  the canonical pipeline both `/api/generate` and `/api/generate/batch`
  already delegate to -- confirmed by reading both routes, neither has its
  own hardcoded-Portuguese copy of this logic):
  - Resolves `regionProfile` via `resolveRegionProfile(input.regionId)` and
    threads it into `contentSpec.regionContext` so `buildUserPrompt`
    actually receives it (it didn't before -- `contentSpec` only carried
    `topic/format/seoMode/brandProfileId`).
  - `"BRAZILIAN MARKET SIGNALS:"` section label -> `${regionProfile.name.toUpperCase()} MARKET SIGNALS:`.
  - Both `locale: 'pt-BR'` hardcodes (content_requests record + article
    create) -> `regionProfile.locale`.
  - Localization-notes system prompt ("Respond in Portuguese (Brazil)")
    and `buildLocalizationNotesPrompt` call -> both now pass/use
    `regionProfile`.
  - **Caught and fixed while editing:** an early `str_replace` pass briefly
    dropped `seo_mode: seoMode` from the `content_requests.record()` call
    when disambiguating two similar-looking `locale:` lines in the same
    file. Caught immediately by re-reading the diff before packaging this
    delivery -- verified `seo_mode` is present in the final file and
    covered by the existing test's implicit shape check.
- `lib/content-generation/generate-article.test.ts`: the existing
  `vi.mock('@/lib/prompts', ...)` didn't include `resolveRegionProfile` --
  since Vitest module mocks replace the entire module, this would have
  failed with "resolveRegionProfile is not a function" the moment the code
  under test called it. Added the mock, added a `locale` assertion to the
  existing Brazil test, and added a new second test that overrides the
  mock to return a Spain profile and asserts `es-ES` reaches both the
  `content_requests` record and the `articles` create payload.
- `lib/prompts.test.ts` (**new file**): direct, unmocked tests of
  `buildUserPrompt`'s branching -- `buildUserPrompt` has no async
  dependencies, so no Supabase mocking is needed. Pins both the
  no-regionContext-equals-old-Brazil-output guarantee and the
  Spain-regionContext-swaps-everlanguage-not-just-one-spot behavior,
  across all 4 format branches (quick_note, x_thread, instagram_carousel,
  long-form).

**What Phase 3 deliberately does NOT do:** nothing currently sends a
non-null `regionId` in any real request -- no frontend page reads the
Phase 2 market-switcher cookie and puts it in a generate request body yet.
So today, in production, every real generation still resolves to the
Brazil profile and produces identical output to before this phase; the
new branching is exercised only by tests until Phase 4 wires the cookie
into `/api/generate` (and friends) request bodies, and Phase 5 filters
brand/competitor/source data by the selected region. This is intentional
sequencing, not an oversight.

### Phase 4 (this delivery) — region actually flows: brand-derived + read filtering

Key design call: **`regionId` is derived from the selected brand, not
tracked as a second independent field the caller must keep in sync.** A
brand already belongs to exactly one region (`brand_profiles.region_id`,
since migration 023). Requiring every caller to separately pass a matching
`regionId` risked the two silently drifting apart -- e.g. a UI bug sending
a Spain `brandProfileId` with a stale cached Brazil `regionId`. Deriving it
from the brand makes that class of bug structurally impossible instead of
something to remember to test for.

- `lib/brand-snapshot.ts`: new `resolveBrandRegionId(brandId)`, same shape
  and error-handling style as the existing `resolveDefaultBrandProfileId`
  in the same file. Returns `null` for a brand with no region set (every
  pre-Sprint-12 brand) or no `brandId` at all.
- `lib/content-generation/generate-article.ts`:
  `effectiveRegionId = input.regionId ?? await resolveBrandRegionId(input.brandProfileId)`.
  An explicit `input.regionId` always wins and skips the brand lookup
  entirely (confirmed `??` short-circuits the `await` on its right side --
  verified in a Node REPL before relying on it, not assumed). Both
  persisted `region_id` fields (`content_requests`, `articles`) now use
  `effectiveRegionId` so what's stored matches what was actually used to
  generate, not just what the caller happened to pass.
- `app/api/market/route.ts`: `region_id` added to the source select in
  both the main-feed and search queries; a source belonging to a
  *different* region than the one requested is filtered out post-fetch
  (same pattern the existing `source_category === 'competitor'` exclusion
  already used -- Supabase's nested-embed select doesn't reliably support
  filtering by an embedded table's column via `.eq()`). A source with no
  `region_id` stays visible in every market rather than being hidden
  everywhere, so this can't silently empty the feed for any row that
  predates region tagging.
- `app/api/competitors/route.ts` + `app/api/competitors/summary/route.ts`:
  both gained `?region_id=` support. `competitors` has no `region_id`
  column of its own (only `brand_id` -- confirmed by reading the actual
  `CREATE TABLE competitors` statement before writing this, not assumed
  from the brand_profiles pattern). So `region_id` resolves to the set of
  `brand_profiles.id` in that region first, then competitors are filtered
  `brand_id IN (...)`. An explicit `brand_id` param still takes precedence
  over `region_id` when both are passed, matching the explicit-wins
  precedence used everywhere else in this sprint.
- `app/generate/page.tsx`: the brand dropdown now fetches
  `/api/brand-profiles?region_id=` from `useMarket()`'s resolved region id,
  re-fetching whenever the market switcher changes selection. **Bug fixed
  while wiring this, not just a nice-to-have:** the previous fallback logic
  (`if (fallback) setBrandProfileId(fallback.id)`) left a stale
  `brandProfileId` in place when no fallback matched -- switching to a
  region with zero brands would keep silently sending the previous
  region's brand id in the next generate request. Now explicitly clears to
  `''` (which the existing `brandProfileId || undefined` send-path already
  handled correctly) when nothing in the new region matches.
- `app/market/page.tsx`: wired `useMarket()` into both the market-feed
  fetch and the competitor-summary fetch (`currentRegionId` in both
  effects' dependency arrays). Also added `setInitialLoading(true)` and
  `clearSelection()` at the top of the items-load effect -- without these,
  switching markets would silently keep showing the previous market's
  stale feed/selection state while the new one loaded in the background.
- `lib/content-generation/generate-article.test.ts`: same missing-mock
  failure class caught in Phase 3, this time for `resolveBrandRegionId` --
  added it, plus two new tests (region derived from brand when no explicit
  `regionId`; explicit `regionId` skips the brand lookup entirely). **Caught
  a real test-isolation bug while writing these**, not just a code bug:
  the "explicit wins" test initially asserted `resolveBrandRegionId` was
  never called, but Vitest mocks share call history across tests in the
  same file -- earlier tests' calls were still on the mock's history,
  failing the assertion for the wrong reason. Fixed with a local
  `spy.mockClear()` rather than adding a file-wide `afterEach` reset,
  since only this one test actually needs clean call-count isolation and
  a global reset risked changing behavior for the untouched existing
  tests. Full suite (10 tests across both files) run 3x in a row against
  the real, unmocked business logic (isolated Vitest harness, stubbed only
  Supabase/AI-SDK-level externals) to rule out order-dependent flakiness --
  stable every time.

**What Phase 4 deliberately does NOT do:** `POST /api/market/refresh` still
refreshes every active source regardless of region -- collection stays
global by design; only the read/display layer filters. The standalone
`/competitors` management page's own UI does not force region filtering by
default (the backend now supports `?region_id=` there too, for future use,
but hiding competitors from a management view without being asked felt
like scope creep beyond "filter... API routes"). No Spain brand or
competitor data exists yet to actually exercise any of this end-to-end in
production -- that's Phase 5.

### Phase 5 (this delivery) — Spain market sources + first Spain brand profile

**This is the last planned phase of Sprint 12.** Mirrors
`supabase/seeds/001_brazil_sources.sql`'s exact pattern for a new file
`supabase/seeds/006_spain_market_and_brand.sql`.

- **5 Spain RSS/source rows**, region-linked to `ES` (activated in Phase 1):
  Cinco Días — El País (`rss`, confirmed live feed, business), El
  Economista — Empresas (`html_index`, business), Marketing Directo
  (`html_index`, marketing), IAB Spain (`html_index`, marketing), 
  Hipertextual — Tecnología (`html_index`, technology). Every URL was
  verified live via web search immediately before writing the file --
  same discipline as the earlier Brazil business-source seed. `html_index`
  used everywhere an RSS endpoint wasn't independently confirmed, matching
  the project's own stated convention ("less brittle than assuming an
  undocumented RSS endpoint exists forever").
- **One Spain brand profile — deliberately a minimal placeholder, not a
  finished brand voice.** The existing Bitrix24 Brasil brand carries an
  extensive, hand-authored template/prompt library
  (`supabase/seeds/003_final_workspaces.sql`) built up over many sprints.
  Reproducing that depth for Spain via find-replace would fabricate a
  brand voice nobody actually decided on -- out of scope for a
  schema-seeding phase. The placeholder row is clearly labeled
  (`brand_name = 'Marca España (placeholder)'`, `voice_description`
  explicitly says "completar en Configuración → Brand OS"), region-linked
  to `ES`, `is_active = true`, and **`is_default = false` on purpose** --
  `resolveDefaultBrandProfileId()` in `lib/brand-snapshot.ts` picks the
  global default brand with no region filter of its own, so a
  Spain-default brand could otherwise compete with the existing
  Brazil-default brand for that fallback slot. Idempotent via
  `WHERE NOT EXISTS (... WHERE region_id = v_region_id)`, matching seed
  002's own guard pattern for competitors (no natural unique key like
  `url` exists for brand rows).

**What this phase enables end-to-end for the first time:** switching the
market-switcher (Phase 2 UI) to España now has real data behind it --
`/generate`'s brand dropdown will show the Spain placeholder brand,
selecting it flows through Phase 4's `resolveBrandRegionId` ->
Phase 3's `buildUserPrompt` Spanish-language branch, and `/market`'s feed
will show the 5 Spain sources once `/api/market/refresh` has pulled from
them at least once.

**What remains deliberately unfinished, for the person to do in Settings,
not guessed at here:** the Spain brand's actual voice, positioning,
forbidden words, example posts, target audience, and competitors are all
empty or placeholder text. No Spain competitors are seeded (no real
competitor set was given). No `AMADO_MULTI_MARKET_V1`-tagged template
library exists for Spain the way it does for Brazil -- generation will
work and produce Spanish output (Phase 3 covers that), but without the
brand-specific prompt depth Bitrix24 Brasil has accumulated.

**This closes the originally planned Sprint 12 phase list (1-5).** Further
multi-market work (a second Spain brand, actual Spain competitors, a
Spain-specific template library, a decision on whether `/competitors`'
UI should also filter by region by default) would be a new sprint, not a
continuation of this numbered list.

