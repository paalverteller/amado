import { NextRequest, NextResponse } from 'next/server'
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
