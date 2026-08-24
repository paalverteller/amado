/**
 * Thin client-side fetch helper for the "GET JSON, silently no-op on
 * failure, let the caller decide what to render while loading" pattern
 * that was hand-duplicated across the brand-tab components before this
 * phase (code review Phase 2a -- see docs/AMADO_ROADMAP.md).
 *
 * Deliberately narrow for now: this is the first migrated pattern, not a
 * general-purpose HTTP client. Mutation helpers (POST/PATCH/DELETE with
 * user-visible error messages) will be added here in a later phase as
 * more of the ~89 raw fetch() call sites migrate -- see the code review
 * notes for the full prioritized list. Resist the urge to grow this into
 * a big abstraction ahead of an actual second use case (YAGNI) -- add the
 * next helper when the next pattern is actually migrated, not before.
 *
 * Returns the parsed response body, or null if the request failed
 * (non-2xx status, network error, or unparsable JSON). Never throws --
 * callers that want to distinguish "not loaded yet" from "failed" should
 * check for null and leave existing state untouched, exactly matching
 * the pre-migration `if (res.ok) setX(...)` behavior this replaces.
 */
export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (err) {
    console.error(`[fetchJson] ${url}:`, err)
    return null
  }
}
