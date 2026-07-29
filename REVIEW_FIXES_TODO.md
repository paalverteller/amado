# Remaining manual follow-ups from the Deep Code Review

The rest of this list requires design decisions that `apply_review_fixes.py`
deliberately did not automate. Recommended order:

1. **Split `lib/supabase.ts`** into `lib/supabase/client.ts` (client
   bootstrapping only) and one file per domain type under `lib/domain/`
   (Article, BrandProfile, RssSource, RssItem, PromptTemplate, Region,
   ContentRequest). Update imports across the codebase. (Review §2.9)

2. **Introduce a repository layer** for `content_requests` and `articles`,
   and refactor `app/api/generate/route.ts` around it so the route becomes
   validate → call service → respond, with the 3-step persistence workflow
   (create → generate → complete/fail) wrapped in one testable function.
   (Review §2.7, §2.8)

3. **Build `lib/api-client/*`** (one typed client module per REST resource)
   and migrate the raw `fetch()` calls in `app/settings/page.tsx`,
   `app/market/page.tsx`, `app/generate/page.tsx`, `app/history/page.tsx`,
   and `app/ideas/page.tsx` onto it. This also fixes the current gap where
   failed requests (non-2xx) are parsed as JSON and silently become empty
   arrays instead of surfacing an error. (Review §2.10)

4. **Extract the Quick Create widget** out of `components/Layout.tsx` into
   its own component + hook, shared with (or replacing the duplicate logic
   in) `app/generate/page.tsx`. (Review §2.11)

5. **Merge the two text sanitizers** — `lib/text-cleanup.ts`'s
   `cleanPlainTextOutput` and the local `nws`/`stripThinkBlocks` in
   `app/api/market/refresh/route.ts`. Not automated because
   `cleanPlainTextOutput` also strips markdown/meta-commentary patterns that
   may not be safe to apply inside `parseBlock()`'s title/summary parsing —
   verify behavior before merging. (Review §2.3)

6. Optional hygiene: document the module-level singletons in
   `lib/supabase.ts` (`_client`/`_admin`) and the cooldown `Map` in
   `lib/ai-utils.ts` so their statefulness (and its limits in a serverless
   environment) is visible at the definition site, not just inferred.
   (Review §2.14)

7. Audit the `select('*')` call sites once the repository layer exists and
   replace with explicit column lists per method.
