/**
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
