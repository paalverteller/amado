import { createClient as _supabaseCreateClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null
let _admin: SupabaseClient | null = null

/**
 * Browser/anon-key Supabase client (singleton, lazily created).
 *
 * NOTE: the singleton is per-process. In a serverless environment this
 * means it is NOT shared across concurrent function instances or cold
 * starts — each cold start builds its own client. That's fine for the
 * client itself (cheap to construct), just don't rely on any assumption
 * of a single shared instance across requests.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY')
    _client = _supabaseCreateClient(url, key)
  }
  return _client
}

/**
 * Service-role (or anon-key fallback) Supabase client for server-side/admin
 * operations. Same per-process singleton caveat as {@link getSupabase}.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')

    const key = roleKey ?? anonKey
    if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or ANON_KEY')

    _admin = roleKey
      ? _supabaseCreateClient(url, roleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : _supabaseCreateClient(url, key)
  }
  return _admin
}
