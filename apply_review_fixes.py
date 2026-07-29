#!/usr/bin/env python3
"""
apply_review_fixes.py — automated remediation from the Deep Code Review
(Amado content platform).

WHAT THIS SCRIPT DOES
----------------------
It applies the findings from the review that are safe to automate:
mechanical, well-defined, behavior-preserving-or-behavior-FIXING changes with
no design judgment required. Specifically:

  P0 (correctness bugs)
    1. app/api/generate/route.ts — the `articles` insert result was never
       checked, so a failed insert was silently reported as success.
    2. app/api/market/refresh/route.ts — removes the dead `hasCyrillic()`
       function (hardcoded to always return false) and its unreachable
       call site.

  P1 (structural DRY / OCP)
    3. Creates lib/api/error-message.ts + lib/api/errors.ts and sweeps every
       unsafe `(err as Error).message` / `(error as Error).message` cast in
       app/ and lib/ to the safe `getErrorMessage(err)` helper, adding the
       import where needed (client-component-safe: the helper has no
       server-only imports).
    4. Creates lib/api/brand-scoped-list.ts (a factory for the "list rows
       scoped to a brand" GET pattern) and rewrites the 9 duplicated route
       files under app/api/brands/[brandId]/{pillars,products,terms,claims,
       pain-points,rule-sets,qa-findings,playbooks,audiences}/route.ts to
       use it.

  P2 (OCP)
    5. Refactors lib/ai-utils.ts's `createModel`/`modelLabel` from if-chains
       to a small provider registry (Record<Provider, ...>), and updates the
       two call sites + the duplicated provider/cooldown-eligibility check in
       lib/ai.ts to use a new shared `eligiblePipeline()` helper.

WHAT THIS SCRIPT DELIBERATELY DOES NOT DO
-------------------------------------------
Splitting lib/supabase.ts into a client module + domain types, introducing a
repository/service layer for content-requests & articles, building a
lib/api-client/* layer and migrating page components off raw fetch(), and
extracting Layout.tsx's Quick Create widget are all real, valuable fixes from
the review — but they involve genuine design decisions (new abstractions,
call-site rewrites across many files with different assumptions) that
shouldn't be applied blindly by a script. Re-run this script with `--apply`
and then read REVIEW_FIXES_TODO.md, which is generated alongside your
changes and lists these as a prioritized follow-up checklist.

USAGE
-----
    python3 apply_review_fixes.py            # dry run — reports only
    python3 apply_review_fixes.py --apply    # writes changes

Run from the repo root (or pass --root /path/to/repo). Safe to re-run: every
fix checks whether it was already applied and skips if so.
"""

import argparse
import re
import sys
from pathlib import Path


class Report:
    def __init__(self):
        self.applied = []
        self.skipped = []
        self.errors = []
        # Paths written (or, in dry-run mode, that WOULD be written) so far
        # this run — lets later steps check "does my dependency exist yet"
        # correctly even in dry-run mode, where nothing is written to disk.
        self.known_paths: set[Path] = set()

    def ok(self, msg):
        self.applied.append(msg)
        print(f"  [applied] {msg}")

    def skip(self, msg):
        self.skipped.append(msg)
        print(f"  [skip]    {msg}")

    def err(self, msg):
        self.errors.append(msg)
        print(f"  [WARN]    {msg}")


def write(path: Path, content: str, dry_run: bool, report: "Report" = None):
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    if report is not None:
        report.known_paths.add(path)


def exists_or_planned(path: Path, report: "Report") -> bool:
    """True if the file already exists on disk, or was created earlier in
    this same run (relevant in --check/dry-run mode, where nothing is
    actually written to disk yet)."""
    return path.exists() or path in report.known_paths


def rel(root: Path, path: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


# ─────────────────────────────────────────────────────────────────────────
# Fix 1 — silently-swallowed `articles` insert error in the generate route
# ─────────────────────────────────────────────────────────────────────────

def fix_generate_unchecked_insert(root: Path, dry_run: bool, report: Report):
    path = root / "app" / "api" / "generate" / "route.ts"
    if not path.exists():
        report.skip("app/api/generate/route.ts — not found")
        return
    content = path.read_text(encoding="utf-8")

    if "articleInsertError" in content:
        report.skip("app/api/generate/route.ts — insert-error check already present")
        return

    old = """    await getSupabaseAdmin().from('articles').insert({
      topic: trimmedTopic,
      content_type: mapToLegacyContentType(contentType),
      draft_content: cleanText,
      status: 'draft',
      generation_model: generated.model,
      prompt_version: built.version,
      source_context: localizationNotes || null,
      template_id: templateId ?? null,
      brand_profile_id: brandProfileId ?? null,
      word_count: words,
      char_count: cleanText.length,
      content_request_id: contentRequestId || null,
      locale: 'pt-BR',
      region_id: regionId || null,
    })
"""
    if old not in content:
        report.err(
            "app/api/generate/route.ts — expected 'articles' insert block not found "
            "(file may have changed since the review) — skipped, please check manually"
        )
        return

    new = """    const { error: articleInsertError } = await getSupabaseAdmin().from('articles').insert({
      topic: trimmedTopic,
      content_type: mapToLegacyContentType(contentType),
      draft_content: cleanText,
      status: 'draft',
      generation_model: generated.model,
      prompt_version: built.version,
      source_context: localizationNotes || null,
      template_id: templateId ?? null,
      brand_profile_id: brandProfileId ?? null,
      word_count: words,
      char_count: cleanText.length,
      content_request_id: contentRequestId || null,
      locale: 'pt-BR',
      region_id: regionId || null,
    })

    if (articleInsertError) {
      // Persisting the generated article failed — don't silently report
      // success. Mark the content request as failed and surface the error.
      if (contentRequestId) {
        await getSupabaseAdmin()
          .from('content_requests')
          .update({ status: 'failed', error_message: articleInsertError.message })
          .eq('id', contentRequestId)
      }
      throw new Error(`Failed to persist article: ${articleInsertError.message}`)
    }
"""
    content = content.replace(old, new)
    write(path, content, dry_run, report)
    report.ok(
        "app/api/generate/route.ts — now checks the articles insert result "
        "instead of silently ignoring failures (P0 correctness fix)"
    )


# ─────────────────────────────────────────────────────────────────────────
# Fix 2 — dead hasCyrillic() function in market/refresh route
# ─────────────────────────────────────────────────────────────────────────

def fix_dead_cyrillic_branch(root: Path, dry_run: bool, report: Report):
    path = root / "app" / "api" / "market" / "refresh" / "route.ts"
    if not path.exists():
        report.skip("app/api/market/refresh/route.ts — not found")
        return
    content = path.read_text(encoding="utf-8")

    if "hasCyrillic" not in content:
        report.skip("app/api/market/refresh/route.ts — dead hasCyrillic branch already removed")
        return

    fn_old = """function hasCyrillic(text: string): boolean {
  // Stage 2: No longer validating Cyrillic. Source content is displayed directly.
  return false
}

function hasChinese"""
    fn_new = "function hasChinese"

    call_old = """  const srcDesc = trunc(item.description ?? srcTitle, 300)

  if (hasCyrillic(`${srcTitle} ${srcDesc}`)) {
    return { id: item.id, title_ru: trunc(srcTitle, 220), summary_ru: trunc(srcDesc, 500) }
  }

  try {"""
    call_new = """  const srcDesc = trunc(item.description ?? srcTitle, 300)

  // Cyrillic passthrough short-circuit was retired in Stage 2 (source content
  // is now always translated, regardless of input script) — removed here.

  try {"""

    if fn_old not in content or call_old not in content:
        report.err(
            "app/api/market/refresh/route.ts — hasCyrillic anchors not found as expected "
            "(file may have changed) — skipped, please check manually"
        )
        return

    content = content.replace(fn_old, fn_new).replace(call_old, call_new)
    write(path, content, dry_run, report)
    report.ok(
        "app/api/market/refresh/route.ts — removed dead hasCyrillic() (always returned "
        "false) and its unreachable call site (POLA fix)"
    )


# ─────────────────────────────────────────────────────────────────────────
# Fix 3 — shared error-message helper + sweep unsafe `as Error` casts
# ─────────────────────────────────────────────────────────────────────────

ERROR_MESSAGE_TS = """/**
 * Safely extract a human-readable message from an unknown thrown value.
 *
 * Prefer this over an unsafe `(err as Error).message` cast, which silently
 * produces `undefined` when something throws a string, a Supabase
 * PostgrestError, or any other non-Error object.
 *
 * Deliberately has no server-only imports so it's safe to use from both
 * Client and Server Components.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unknown error'
}
"""

ERRORS_TS = """import { NextResponse } from 'next/server'
import { getErrorMessage } from './error-message'

export { getErrorMessage }

/**
 * Standard error envelope for API routes: logs the error server-side and
 * returns a consistent `{ error: string }` JSON response.
 *
 * Server-only (imports next/server) — use `getErrorMessage` from
 * `./error-message` directly in Client Components.
 */
export function apiError(error: unknown, status = 500): NextResponse {
  const message = getErrorMessage(error)
  console.error(`[api:${status}]`, message)
  return NextResponse.json({ error: message }, { status })
}
"""


def fix_create_error_helpers(root: Path, dry_run: bool, report: Report):
    msg_path = root / "lib" / "api" / "error-message.ts"
    err_path = root / "lib" / "api" / "errors.ts"

    if msg_path.exists():
        report.skip(f"{rel(root, msg_path)} — already exists")
    else:
        write(msg_path, ERROR_MESSAGE_TS, dry_run, report)
        report.ok(f"created {rel(root, msg_path)}")

    if err_path.exists():
        report.skip(f"{rel(root, err_path)} — already exists")
    else:
        write(err_path, ERRORS_TS, dry_run, report)
        report.ok(f"created {rel(root, err_path)}")


UNSAFE_CAST_RE = re.compile(r"\((err|error)\s+as\s+Error\)\.message")
EXCLUDED_FROM_SWEEP = {"lib/api/errors.ts", "lib/api/error-message.ts"}


def _insert_import(text: str, import_line: str) -> str:
    """Insert an import statement after the last top-level `import ...` line,
    or — if there are none — after any leading directive/comment lines."""
    import_matches = list(re.finditer(r"^import .+$", text, re.MULTILINE))
    if import_matches:
        insert_at = import_matches[-1].end()
        return text[:insert_at] + "\n" + import_line + text[insert_at:]

    # No imports at all: insert after 'use client'/'use server' directives
    # and any leading // comment / blank lines, so we don't land above a
    # file-header comment banner.
    lines = text.splitlines(keepends=True)
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if (
            stripped.startswith("'use ")
            or stripped.startswith('"use ')
            or stripped.startswith("//")
            or stripped == ""
        ):
            i += 1
            continue
        break
    return "".join(lines[:i]) + import_line + "\n" + "".join(lines[i:])


def fix_sweep_unsafe_casts(root: Path, dry_run: bool, report: Report):
    msg_path = root / "lib" / "api" / "error-message.ts"
    if not exists_or_planned(msg_path, report):
        report.err("lib/api/error-message.ts missing — run fix_create_error_helpers first, skipping sweep")
        return

    candidates = list(root.glob("app/**/*.ts")) + list(root.glob("app/**/*.tsx")) + list(root.glob("lib/**/*.ts"))
    changed = 0
    found = 0

    for f in candidates:
        r = rel(root, f)
        if r in EXCLUDED_FROM_SWEEP:
            continue
        text = f.read_text(encoding="utf-8")
        if not UNSAFE_CAST_RE.search(text):
            continue
        found += 1

        new_text = UNSAFE_CAST_RE.sub(lambda m: f"getErrorMessage({m.group(1)})", text)

        already_imported = bool(re.search(r"import\s*\{[^}]*getErrorMessage[^}]*\}\s*from", new_text))
        if not already_imported:
            import_line = "import { getErrorMessage } from '@/lib/api/error-message'"
            new_text = _insert_import(new_text, import_line)

        if new_text != text:
            write(f, new_text, dry_run, report)
            changed += 1

    if found == 0:
        report.skip("unsafe `(err as Error).message` casts — none found (already swept)")
    else:
        report.ok(
            f"swept unsafe `(err as Error).message` / `(error as Error).message` casts "
            f"in {changed} file(s) → getErrorMessage(...)"
        )


# ─────────────────────────────────────────────────────────────────────────
# Fix 4 — brand-scoped list factory + rewrite the 9 duplicate routes
# ─────────────────────────────────────────────────────────────────────────

BRAND_LIST_FACTORY_TS = """import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export interface BrandListConfig {
  /** Supabase table to query. */
  table: string
  /** Key the results are returned under, e.g. `{ pillars: [...] }`. */
  responseKey: string
  /** Column to order by. */
  orderBy: string
  /** Sort direction for `orderBy`. Defaults to true (ascending). */
  ascending?: boolean
  /** Whether to filter to `active = true` rows only. */
  onlyActive?: boolean
  /** Optional row limit. */
  limit?: number
}

/**
 * Builds a GET handler for the common "list rows scoped to a brand" shape
 * used across the brand sub-resources (pillars, products, terms, claims,
 * pain-points, rule-sets, qa-findings, playbooks, audiences, ...).
 *
 * Adding a new brand-scoped list endpoint is now a config object, not a
 * copy-pasted route file.
 */
export function createBrandListHandler(config: BrandListConfig) {
  return async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ brandId: string }> }
  ): Promise<NextResponse> {
    const { brandId } = await params
    try {
      const supabase = getSupabase()
      let query = supabase.from(config.table).select('*').eq('brand_id', brandId)
      if (config.onlyActive) query = query.eq('active', true)
      query = query.order(config.orderBy, { ascending: config.ascending ?? true })
      if (config.limit) query = query.limit(config.limit)

      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ [config.responseKey]: data ?? [] })
    } catch (error) {
      console.error(`[${config.table}] list error:`, error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
"""

# rel path -> (table, responseKey, orderBy, ascending, onlyActive, limit)
BRAND_LIST_ROUTES = {
    "app/api/brands/[brandId]/pillars/route.ts": dict(
        table="brand_content_pillars", responseKey="pillars", orderBy="sort_order", onlyActive=True
    ),
    "app/api/brands/[brandId]/products/route.ts": dict(
        table="brand_products", responseKey="products", orderBy="created_at", onlyActive=True
    ),
    "app/api/brands/[brandId]/terms/route.ts": dict(
        table="brand_terms", responseKey="terms", orderBy="term", onlyActive=True
    ),
    "app/api/brands/[brandId]/claims/route.ts": dict(
        table="brand_claims", responseKey="claims", orderBy="created_at"
    ),
    "app/api/brands/[brandId]/pain-points/route.ts": dict(
        table="brand_pain_points", responseKey="painPoints", orderBy="sort_order", onlyActive=True
    ),
    "app/api/brands/[brandId]/rule-sets/route.ts": dict(
        table="brand_rule_sets", responseKey="ruleSets", orderBy="created_at", ascending=False
    ),
    "app/api/brands/[brandId]/qa-findings/route.ts": dict(
        table="qa_findings", responseKey="findings", orderBy="created_at", ascending=False, limit=100
    ),
    "app/api/brands/[brandId]/playbooks/route.ts": dict(
        table="platform_playbooks", responseKey="playbooks", orderBy="platform", onlyActive=True
    ),
    "app/api/brands/[brandId]/audiences/route.ts": dict(
        table="brand_audiences", responseKey="audiences", orderBy="created_at", onlyActive=True
    ),
}


def _render_brand_list_route(cfg: dict) -> str:
    lines = [
        "import { createBrandListHandler } from '@/lib/api/brand-scoped-list'",
        "",
        "export const GET = createBrandListHandler({",
        f"  table: '{cfg['table']}',",
        f"  responseKey: '{cfg['responseKey']}',",
        f"  orderBy: '{cfg['orderBy']}',",
    ]
    if cfg.get("ascending") is False:
        lines.append("  ascending: false,")
    if cfg.get("onlyActive"):
        lines.append("  onlyActive: true,")
    if cfg.get("limit"):
        lines.append(f"  limit: {cfg['limit']},")
    lines.append("})")
    return "\n".join(lines) + "\n"


def fix_create_brand_list_factory(root: Path, dry_run: bool, report: Report):
    path = root / "lib" / "api" / "brand-scoped-list.ts"
    if path.exists():
        report.skip(f"{rel(root, path)} — already exists")
        return
    write(path, BRAND_LIST_FACTORY_TS, dry_run, report)
    report.ok(f"created {rel(root, path)}")


def fix_dedupe_brand_list_routes(root: Path, dry_run: bool, report: Report):
    factory_path = root / "lib" / "api" / "brand-scoped-list.ts"
    if not exists_or_planned(factory_path, report):
        report.err("lib/api/brand-scoped-list.ts missing — run fix_create_brand_list_factory first, skipping")
        return

    for rel_path, cfg in BRAND_LIST_ROUTES.items():
        path = root / rel_path
        if not path.exists():
            report.skip(f"{rel_path} — not found")
            continue

        current = path.read_text(encoding="utf-8")
        if "createBrandListHandler" in current:
            report.skip(f"{rel_path} — already refactored")
            continue
        if f"from('{cfg['table']}')" not in current:
            report.err(
                f"{rel_path} — doesn't reference table '{cfg['table']}' as expected "
                f"(may have been customized) — left untouched, please check manually"
            )
            continue

        write(path, _render_brand_list_route(cfg), dry_run, report)
        report.ok(f"rewrote {rel_path} to use createBrandListHandler (was a full duplicated handler)")


# ─────────────────────────────────────────────────────────────────────────
# Fix 5 — provider registry in lib/ai-utils.ts + lib/ai.ts call sites
# ─────────────────────────────────────────────────────────────────────────

def fix_ai_provider_registry(root: Path, dry_run: bool, report: Report):
    utils_path = root / "lib" / "ai-utils.ts"
    ai_path = root / "lib" / "ai.ts"
    if not utils_path.exists() or not ai_path.exists():
        report.skip("lib/ai-utils.ts / lib/ai.ts — not found")
        return

    utils_content = utils_path.read_text(encoding="utf-8")
    ai_content = ai_path.read_text(encoding="utf-8")

    if "eligiblePipeline" in utils_content:
        report.skip("lib/ai-utils.ts — provider registry already applied")
        return

    utils_old = """export function modelLabel(entry: PipelineEntry): string {
  if (entry.provider === 'google') return `Gemini ${entry.model}`
  if (entry.provider === 'groq')   return `Groq ${entry.model}`
  if (entry.provider === 'openai') return `OpenAI ${entry.model}`
  return `DeepSeek ${entry.model}`
}

export function createModel(entry: PipelineEntry, googleKey?: string, groqKey?: string, openaiKey?: string) {
  if (entry.provider === 'google' && googleKey) return createGoogleGenerativeAI({ apiKey: googleKey })(entry.model)
  if (entry.provider === 'groq' && groqKey) return createGroq({ apiKey: groqKey })(entry.model)
  if (entry.provider === 'openai' && openaiKey) return createOpenAI({ apiKey: openaiKey })(entry.model)
  return null
}"""

    if utils_old not in utils_content:
        report.err("lib/ai-utils.ts — createModel/modelLabel anchor not found as expected, skipping this fix")
        return

    utils_new = """const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'Gemini',
  groq: 'Groq',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
}

export function modelLabel(entry: PipelineEntry): string {
  return `${PROVIDER_LABELS[entry.provider]} ${entry.model}`
}

const PROVIDER_ENV_KEYS: Record<Provider, string> = {
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

/** Whether the given provider has an API key configured in the environment. */
export function isProviderConfigured(provider: Provider): boolean {
  return Boolean(process.env[PROVIDER_ENV_KEYS[provider]])
}

/** Filter a pipeline down to entries whose provider is configured and not cooling down. */
export function eligiblePipeline(pipeline: PipelineEntry[]): PipelineEntry[] {
  return pipeline.filter((entry) => isProviderConfigured(entry.provider) && !isCoolingDown(entry))
}

/**
 * Construct an ai-sdk LanguageModel for a pipeline entry using whichever
 * provider key is configured in the environment. Returns null for providers
 * not backed by the ai-sdk (e.g. deepseek, handled via generateDeepSeekText).
 * Adding a new ai-sdk provider only requires adding one entry to
 * PROVIDER_ENV_KEYS/PROVIDER_LABELS plus one line here.
 */
export function createModel(entry: PipelineEntry) {
  const apiKey = process.env[PROVIDER_ENV_KEYS[entry.provider]]
  if (!apiKey) return null
  if (entry.provider === 'google') return createGoogleGenerativeAI({ apiKey })(entry.model)
  if (entry.provider === 'groq') return createGroq({ apiKey })(entry.model)
  if (entry.provider === 'openai') return createOpenAI({ apiKey })(entry.model)
  return null
}"""

    utils_content = utils_content.replace(utils_old, utils_new)
    write(utils_path, utils_content, dry_run, report)
    report.ok("lib/ai-utils.ts — createModel/modelLabel now use a provider registry instead of if-chains (OCP fix)")

    # --- lib/ai.ts: generateWithFallback ---
    ai_old_1 = """export async function generateWithFallback(params: GenerateParams): Promise<GenerateResult> {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const groqKey   = process.env.GROQ_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const task = params.task ?? 'utility'
  
  const seed = params.userPrompt || params.systemPrompt || task
  const pipeline = buildPipelines(seed)[task]
  const errors: string[] = []

  for (const entry of pipeline) {
    if (entry.provider === 'google'   && !googleKey) continue
    if (entry.provider === 'groq'     && !groqKey)   continue
    if (entry.provider === 'openai'   && !openaiKey) continue
    if (entry.provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) continue

    if (isCoolingDown(entry)) continue

    try {"""
    ai_new_1 = """export async function generateWithFallback(params: GenerateParams): Promise<GenerateResult> {
  const task = params.task ?? 'utility'

  const seed = params.userPrompt || params.systemPrompt || task
  const pipeline = buildPipelines(seed)[task]
  const errors: string[] = []

  for (const entry of eligiblePipeline(pipeline)) {
    try {"""

    ai_old_2 = """export async function generateArticleWithFallback(params: GenerateParams): Promise<GenerateAttemptResult> {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const groqKey   = process.env.GROQ_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  
  const pipeline = buildPipelines(params.userPrompt || 'default')['generation']
  const errors: string[] = []
  const startedAt = Date.now()

  for (const entry of pipeline) {
    if (entry.provider === 'google'   && !googleKey) continue
    if (entry.provider === 'groq'     && !groqKey)   continue
    if (entry.provider === 'openai'   && !openaiKey) continue
    if (entry.provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) continue

    if (isCoolingDown(entry)) continue

    const elapsed = Date.now() - startedAt"""
    ai_new_2 = """export async function generateArticleWithFallback(params: GenerateParams): Promise<GenerateAttemptResult> {
  const pipeline = buildPipelines(params.userPrompt || 'default')['generation']
  const errors: string[] = []
  const startedAt = Date.now()

  for (const entry of eligiblePipeline(pipeline)) {
    const elapsed = Date.now() - startedAt"""

    if ai_old_1 not in ai_content or ai_old_2 not in ai_content:
        report.err(
            "lib/ai.ts — generateWithFallback/generateArticleWithFallback anchors not found as "
            "expected — lib/ai-utils.ts was updated but lib/ai.ts call sites were NOT. Please "
            "update lib/ai.ts manually (see the review, section 2.4/2.5) or restore ai-utils.ts."
        )
        return

    ai_content = ai_content.replace(ai_old_1, ai_new_1).replace(ai_old_2, ai_new_2)
    ai_content = ai_content.replace(
        "createModel(entry, googleKey, groqKey, openaiKey)", "createModel(entry)"
    )
    ai_content = ai_content.replace(
        "  AiTask, PipelineEntry, rotateGroup, createModel, modelLabel,\n"
        "  isCoolingDown, setCooldown, getErrorMessage, isQuotaError, retryDelayMs,",
        "  AiTask, PipelineEntry, rotateGroup, createModel, modelLabel, eligiblePipeline,\n"
        "  setCooldown, getErrorMessage, isQuotaError, retryDelayMs,",
    )

    write(ai_path, ai_content, dry_run, report)
    report.ok(
        "lib/ai.ts — generateWithFallback/generateArticleWithFallback now share "
        "eligiblePipeline() instead of duplicating the provider/cooldown check (DRY fix)"
    )


# ─────────────────────────────────────────────────────────────────────────
# TODO file for what wasn't automated
# ─────────────────────────────────────────────────────────────────────────

TODO_MD = """# Remaining manual follow-ups from the Deep Code Review

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
"""


def write_todo(root: Path, dry_run: bool, report: Report):
    path = root / "REVIEW_FIXES_TODO.md"
    write(path, TODO_MD, dry_run, report)
    report.ok(f"wrote {rel(root, path)} with the remaining manual follow-ups")


# ─────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", default=".", help="Repo root (default: current directory)")
    parser.add_argument("--apply", action="store_true", help="Write changes (default is dry-run / --check)")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not (root / "package.json").exists():
        print(f"WARNING: {root} doesn't look like the repo root (no package.json found). Continuing anyway.")

    dry_run = not args.apply
    mode = "DRY RUN (no files will be written)" if dry_run else "APPLY (writing changes)"
    print(f"apply_review_fixes.py — {mode}")
    print(f"root: {root}\n")

    report = Report()

    steps = [
        ("P0.1  Fix unchecked articles insert error", fix_generate_unchecked_insert),
        ("P0.2  Remove dead hasCyrillic() branch", fix_dead_cyrillic_branch),
        ("P1.3a Create shared error-message helpers", fix_create_error_helpers),
        ("P1.3b Sweep unsafe `as Error` casts", fix_sweep_unsafe_casts),
        ("P1.4a Create brand-scoped-list factory", fix_create_brand_list_factory),
        ("P1.4b Rewrite 9 duplicate brand list routes", fix_dedupe_brand_list_routes),
        ("P2.5  Provider registry for AI model dispatch", fix_ai_provider_registry),
    ]

    for label, fn in steps:
        print(f"{label}")
        fn(root, dry_run, report)
        print()

    write_todo(root, dry_run, report)

    print("\n" + "=" * 60)
    print(f"Applied: {len(report.applied)}   Skipped: {len(report.skipped)}   Warnings: {len(report.errors)}")
    if report.errors:
        print("\nSome anchors didn't match — those files were left untouched.")
        print("This usually means the file differs from the reviewed snapshot.")
        print("Review the [WARN] lines above and apply those fixes manually.")
    if dry_run:
        print("\nThis was a dry run. Re-run with --apply to write these changes.")
    else:
        print("\nDone. Next: run your type-checker/linter/build, review the diff, then commit.")

    sys.exit(1 if report.errors else 0)


if __name__ == "__main__":
    main()
