# КОНТЕКСТ ПРОЕКТА: КОНТЕНТ-ФАБРИКА «ЯНКА КУПАЛА»

## 1. Технический стек и Окружение (2026)
- **Framework**: Next.js 16.2.6 (App Router, Turbopack)
- **Runtime**: Node.js / React 19.2.4 / Vercel Serverless Functions
- **Limit Parameters**: maxDuration = 60s (Strict Vercel Hobby Limit)
- **DB & Storage**: Supabase Free Tier (Postgres, Storage). Access via custom Singletons (no JS Proxy magic to preserve 'this' context).
- **Styling**: Tailwind CSS v4, Material Design 3 Guidelines (Tokens).

## 2. Искусственный Интеллект и Балансировщик
Все AI-запросы изолированы от контроллеров и реализованы через stateless пайплайны (`lib/ai-utils.ts` & `lib/ai.ts`).
**Модели из ветки OpenAI Data Sharing (2026)** работают совместно с новыми моделями **Google** и **Groq**.

### 2.1 Самовосстановление и Защита от лимитов (Self-Healing):
- Вызов происходит с динамическим расчётом `budgetMs = min(modelBudget, Remaining Vercel Deadline - Margin)`.
- Если у первой модели ошибка квоты или баланса `insufficient_quota`, она отстраняется (cooldown 24h) и запрос мгновенно передается запасной, чтобы функция не превысила Vercel-deadline (60 секунд).

### 2.2 Пайплайны (Model Fallback Arrays):
1. **Article Generation (Heavy):** Взвешенная очередь через hash. `gpt-5.5-2026-04-23` / `gpt-5.4` / `o3` от OpenAI + `gemini-3.5-flash` + Groq's `gpt-oss-120b`.
2. **Background / Translating (Fast Free-Tier):** Зачищен от OpenAI. Используются исключительно: `gemini-3.5-flash`, `llama-4-scout-17b`, `gemini-3.1-flash-lite`, `groq/compound`.
3. Промпты оснащены защитой от Китайских галлюцинаций `!hasChinese()` на уровне бэкенда.

## 3. Архитектура работы с рынком и источниками (Data Ingestion)
- Мощный блэклист `lib/rss.ts` (~50 слов), жестко отклоняющий: публикации о поиске вакансий (job/hiring), редакционную этику (policy/ethics), обучение/конференции (workshop/conference) и архивы номеров. Отсев по Regex в Заголовках, Summary и URL-путях.
- Маскировка сканера: кастомные Chrome Headers и Accept-Language помогают прошибать мягкие стенки `Cloudflare`. Для жестко блокируемых ресурсов найдены региональные (латиноамериканские, японские, английские) прямые открытые ленты в БД.

### Автоматизация (Cron):
1. `/api/cron/ping`: Анти-сон (раз в 5 дней) делает легковесный Select в БД. Не дает проекту заснуть на Free Tier Supabase.
2. `/api/market/refresh`: Раз в 72 часа, ночью, самостоятельно парсит ~10+ журналов. Включает транкацию описаний до 300 символов, пробрасывает через ИИ (быстрые переводы Gemini+Llama). Результат складывает в `rss_items`. На UI жесткий блок 14 дней старости и пустого title_ru.

## 4. Supabase DB: Текущие Таблицы
*В коде инициализируются через getter 'getSupabaseAdmin()' (bypasses RLS with SUPABASE_SERVICE_ROLE_KEY).*
* `books`, `book_chunks`: .txt-based Knowledge Base с индексацией абзацев. Принимает RAG fallback поиск на уровне БД (`match_book_chunks` заменена быстрыми keywords query ради MVP 1.0)
* `rss_sources`: id, name, url, country, active, source_type, last_fetched_at
* `rss_items`: link (UNIQUE constraint), title, title_ru, description, summary_ru, published_at. Стейт на уровне БД: `DELETE FROM rss_items WHERE title_ru IS NULL`.
* `articles`: generation output tables with constraints mapping template ID, word & char counting logic. 

## 5. Требования к разработке
- Никаких случайных изменений или отката версий AI Models 2026 года!
- Для расширений применять Принцип `Brzoza Occama` + SoC. Патчятся модули utils, а Route остается прозрачным I/O.