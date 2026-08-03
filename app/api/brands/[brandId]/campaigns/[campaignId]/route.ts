import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; campaignId: string }> }
) {
  try {
    const { brandId, campaignId } = await params
    const admin = getSupabaseAdmin()

    const { data: campaign, error } = await admin
      .from('campaign_profiles')
      .select(`
        *,
        packages:content_packages(id, name, status)
      `)
      .eq('id', campaignId)
      .eq('brand_id', brandId)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error('[campaign-get] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; campaignId: string }> }
) {
  try {
    const { brandId, campaignId } = await params
    const body = await request.json()
    const admin = getSupabaseAdmin()

    const updates: Record<string, unknown> = {}
    const fields = ['name', 'description', 'objective', 'target_audience', 'key_messages', 'duration_days', 'budget_range', 'kpi_targets', 'active']
    
    for (const field of fields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    const { data: campaign, error } = await admin
      .from('campaign_profiles')
      .update(updates)
      .eq('id', campaignId)
      .eq('brand_id', brandId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error('[campaign-update] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; campaignId: string }> }
) {
  try {
    const { brandId, campaignId } = await params
    const admin = getSupabaseAdmin()

    const { error } = await admin
      .from('campaign_profiles')
      .delete()
      .eq('id', campaignId)
      .eq('brand_id', brandId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[campaign-delete] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
