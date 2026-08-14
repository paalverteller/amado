import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { resolveDefaultBrandId } from '@/lib/marketing-analytics'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

const VALID_STATUS = ['planned', 'active', 'paused', 'completed', 'archived'] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const brandId = await resolveDefaultBrandId(request.nextUrl.searchParams.get('brand_id'))
    let query = getSupabaseAdmin()
      .from('marketing_campaigns')
      .select('*')
      .order('starts_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (brandId) query = query.eq('brand_id', brandId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json({ campaigns: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const status = typeof body.status === 'string' ? body.status : 'planned'
    if (!VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUS.join(', ')}` }, { status: 400 })
    }

    const brandId = await resolveDefaultBrandId(typeof body.brand_id === 'string' ? body.brand_id : null)
    const { data, error } = await getSupabaseAdmin()
      .from('marketing_campaigns')
      .insert({
        brand_id: brandId,
        name,
        objective: typeof body.objective === 'string' ? body.objective.trim() || null : null,
        primary_kpi: typeof body.primary_kpi === 'string' ? body.primary_kpi.trim() || null : null,
        status,
        starts_at: typeof body.starts_at === 'string' && body.starts_at ? body.starts_at : null,
        ends_at: typeof body.ends_at === 'string' && body.ends_at ? body.ends_at : null,
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
