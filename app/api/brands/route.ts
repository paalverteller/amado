import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

/**
 * GET /api/brands
 *
 * Did not exist before this — confirmed via search, nothing in this
 * codebase ever listed all brands. The /brand workspace's brand selector
 * had exactly one hardcoded option ("Bitrix24 Brasil"); this is what
 * makes it possible to make that selector real instead.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const regionId = req.nextUrl.searchParams.get('region_id')
    let query = getSupabaseAdmin()
      .from('brand_profiles')
      .select('id, brand_name, is_active, is_default, region_id, updated_at')
      .order('is_default', { ascending: false })
      .order('brand_name', { ascending: true })

    if (regionId) query = query.eq('region_id', regionId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
