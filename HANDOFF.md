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
