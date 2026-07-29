import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

/**
 * GET /api/brands/[brandId]/packages/[packageId]
 * Get single package with assets and relations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; packageId: string }> }
) {
  try {
    const { brandId, packageId } = await params
    const admin = getSupabaseAdmin()

    const { data: pkg, error } = await admin
      .from('content_packages')
      .select(`
        *,
        assets:content_assets(*),
        campaign:campaign_profile_id(name),
        pillar:content_pillar_id(name)
      `)
      .eq('id', packageId)
      .eq('brand_id', brandId)
      .single()

    if (error || !pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // Get asset relations
    const { data: relations } = await admin
      .from('content_asset_relations')
      .select('*')
      .in('from_asset_id', (pkg.assets || []).map((a: any) => a.id))

    return NextResponse.json({
      package: pkg,
      relations: relations || [],
    })
  } catch (err) {
    console.error('[package-get] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

/**
 * PATCH /api/brands/[brandId]/packages/[packageId]
 * Update package status, metadata, etc.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; packageId: string }> }
) {
  try {
    const { brandId, packageId } = await params
    const body = await request.json()
    const {
      name,
      description,
      status,
      campaignProfileId,
      pillarId,
      topic,
      evidenceIds,
      targetPlatforms,
      targetFormats,
      dueDate,
    } = body

    const admin = getSupabaseAdmin()

    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (status !== undefined) updates.status = status
    if (campaignProfileId !== undefined) updates.campaign_profile_id = campaignProfileId
    if (pillarId !== undefined) updates.content_pillar_id = pillarId
    if (topic !== undefined) updates.topic = topic
    if (evidenceIds !== undefined) updates.evidence_ids = evidenceIds
    if (targetPlatforms !== undefined) updates.target_platforms = targetPlatforms
    if (targetFormats !== undefined) updates.target_formats = targetFormats
    if (dueDate !== undefined) updates.due_date = dueDate

    const { data: pkg, error } = await admin
      .from('content_packages')
      .update(updates)
      .eq('id', packageId)
      .eq('brand_id', brandId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ package: pkg })
  } catch (err) {
    console.error('[package-update] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

/**
 * DELETE /api/brands/[brandId]/packages/[packageId]
 * Delete package and cascade to assets
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; packageId: string }> }
) {
  try {
    const { brandId, packageId } = await params
    const admin = getSupabaseAdmin()

    // Delete assets first (cascade should handle this, but explicit is safer)
    await admin
      .from('content_assets')
      .delete()
      .eq('package_id', packageId)

    const { error } = await admin
      .from('content_packages')
      .delete()
      .eq('id', packageId)
      .eq('brand_id', brandId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[package-delete] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
