import { createClient as _supabaseCreateClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null
let _admin: SupabaseClient | null = null

// AMADO_MVP_RUNTIME_REPAIR_V1
const SUPABASE_SERVICE_SUFFIX = /\/(?:rest|auth|storage|functions)\/v\d+\/?$/i

export type SupabaseRuntimeInfo = {
  configured: boolean
  sourceEnv: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_URL' | null
  host: string | null
  normalizedPath: '/'
  repairedServiceSuffix: boolean
}

/**
 * Supabase JS expects the PROJECT ORIGIN, for example:
 *   https://<project-ref>.supabase.co
 *
 * It appends /rest/v1, /auth/v1, etc. itself. A common deployment mistake is
 * pasting the REST endpoint (...supabase.co/rest/v1) into
 * NEXT_PUBLIC_SUPABASE_URL. That makes the SDK build a duplicated/invalid
 * PostgREST path and every .from(...) call fails with PGRST125
 * "Invalid path specified in request URL".
 *
 * We repair the known service suffixes, but deliberately reject arbitrary
 * paths (Dashboard URLs, copied Studio links, etc.) instead of guessing.
 */
export function normalizeSupabaseProjectUrl(raw: string): {
  url: string
  repairedServiceSuffix: boolean
} {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('Supabase URL is empty')

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Supabase URL must be a valid https:// project URL')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Supabase URL must use http(s), received ${parsed.protocol}`)
  }

  let path = parsed.pathname.replace(/\/+$/, '')
  const repairedServiceSuffix = SUPABASE_SERVICE_SUFFIX.test(path)
  if (repairedServiceSuffix) {
    path = path.replace(SUPABASE_SERVICE_SUFFIX, '').replace(/\/+$/, '')
  }

  if (path && path !== '/') {
    throw new Error(
      `Supabase URL must be the project origin only; unexpected path "${path}". ` +
      'Use https://<project-ref>.supabase.co (without /rest/v1 or Dashboard paths).',
    )
  }

  parsed.pathname = '/'
  parsed.search = ''
  parsed.hash = ''

  return { url: parsed.origin, repairedServiceSuffix }
}

function configuredSupabaseUrl(): {
  raw: string
  sourceEnv: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_URL'
} {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (publicUrl?.trim()) return { raw: publicUrl, sourceEnv: 'NEXT_PUBLIC_SUPABASE_URL' }

  const serverUrl = process.env.SUPABASE_URL
  if (serverUrl?.trim()) return { raw: serverUrl, sourceEnv: 'SUPABASE_URL' }

  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL (or server-only SUPABASE_URL)')
}

function resolveSupabaseUrl(): string {
  const { raw } = configuredSupabaseUrl()
  return normalizeSupabaseProjectUrl(raw).url
}

export function getSupabaseRuntimeInfo(): SupabaseRuntimeInfo {
  try {
    const { raw, sourceEnv } = configuredSupabaseUrl()
    const normalized = normalizeSupabaseProjectUrl(raw)
    return {
      configured: true,
      sourceEnv,
      host: new URL(normalized.url).host,
      normalizedPath: '/',
      repairedServiceSuffix: normalized.repairedServiceSuffix,
    }
  } catch {
    return {
      configured: false,
      sourceEnv: null,
      host: null,
      normalizedPath: '/',
      repairedServiceSuffix: false,
    }
  }
}

/**
 * Browser/anon-key Supabase client (singleton, lazily created).
 *
 * NOTE: the singleton is per-process. In a serverless environment this
 * means it is NOT shared across concurrent function instances or cold
 * starts.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = resolveSupabaseUrl()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
    _client = _supabaseCreateClient(url, key)
  }
  return _client
}

/**
 * Service-role client for server-side/admin operations.
 *
 * In production, SUPABASE_SERVICE_ROLE_KEY is strongly preferred. The anon
 * fallback is retained for local compatibility with the existing app, but
 * runtime-health reports whether the DB is actually reachable.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = resolveSupabaseUrl()
    const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const key = roleKey ?? anonKey

    if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')

    _admin = roleKey
      ? _supabaseCreateClient(url, roleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : _supabaseCreateClient(url, key)
  }
  return _admin
}
