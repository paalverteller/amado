import { NextResponse } from 'next/server'
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
