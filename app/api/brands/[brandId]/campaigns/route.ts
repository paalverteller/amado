import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/brands/[brandId]/campaigns
 * List campaign profiles
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')
    const limit = parseInt(searchParams.get('limit') || '50')

    const admin = getSupabaseAdmin()
    let query = admin
      .from('campaign_profiles')
      .select(`
        *,
        packages:content_packages(id, status)
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (active !== null) query = query.eq('active', active === 'true')

    const { data: campaigns, error } = await query

    if (error) throw error

    return NextResponse.json({ campaigns: campaigns || [] })
  } catch (err) {
    console.error('[campaigns-list] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/brands/[brandId]/campaigns
 * Create a new campaign profile
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const body = await request.json()
    const {
      name,
      description,
      objective,
      targetAudience,
      keyMessages,
      durationDays,
      budgetRange,
      kpiTargets,
      active = true,
    } = body

    if (!name || !objective) {
      return NextResponse.json(
        { error: 'name and objective are required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    const { data: campaign, error } = await admin
      .from('campaign_profiles')
      .insert({
        brand_id: brandId,
        workspace_id: '00000000-0000-0000-0000-000000000000',
        name,
        description,
        objective,
        target_audience: targetAudience,
        key_messages: keyMessages || [],
        duration_days: durationDays,
        budget_range: budgetRange,
        kpi_targets: kpiTargets || {},
        active,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (err) {
    console.error('[campaign-create] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
