# Remaining manual follow-ups from the Deep Code Review

`apply_review_fixes.py` now also handles splitting `lib/supabase.ts` and
documenting the AI cooldown map's statefulness. The items below still
require design decisions the script deliberately does not automate.
Recommended order:

1. **Introduce a repository layer** for `content_requests` and `articles`,
   and refactor `app/api/generate/route.ts` around it so the route becomes
   validate → call service → respond, with the 3-step persistence workflow
   (create → generate → complete/fail) wrapped in one testable function.
   This is now easier since `lib/supabase/client.ts` and `lib/domain/*.ts`
   are already separated out. (Review §2.7, §2.8)

2. **Build `lib/api-client/*`** (one typed client module per REST resource)
   and migrate the raw `fetch()` calls in `app/settings/page.tsx`,
   `app/market/page.tsx`, `app/generate/page.tsx`, `app/history/page.tsx`,
   and `app/ideas/page.tsx` onto it. This also fixes the current gap where
   failed requests (non-2xx) are parsed as JSON and silently become empty
   arrays instead of surfacing an error. (Review §2.10)

3. **Extract the Quick Create widget** out of `components/Layout.tsx` into
   its own component + hook, shared with (or replacing the duplicate logic
   in) `app/generate/page.tsx`. (Review §2.11)

4. **Merge the two text sanitizers** — `lib/text-cleanup.ts`'s
   `cleanPlainTextOutput` and the local `nws`/`stripThinkBlocks` in
   `app/api/market/refresh/route.ts`. Not automated because
   `cleanPlainTextOutput` also strips markdown/meta-commentary patterns that
   may not be safe to apply inside `parseBlock()`'s title/summary parsing —
   verify behavior before merging. (Review §2.3)

5. Audit the `select('*')` call sites once the repository layer exists and
   replace with explicit column lists per method.
