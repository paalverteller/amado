import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

/**
 * GET /api/brands/[brandId]/packages
 * List content packages with optional filtering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const admin = getSupabaseAdmin()
    let query = admin
      .from('content_packages')
      .select(`
        *,
        assets:content_assets(*),
        campaign:campaign_profile_id(name)
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (campaignId) query = query.eq('campaign_profile_id', campaignId)

    const { data: packages, error } = await query

    if (error) throw error

    return NextResponse.json({
      packages: packages || [],
      pagination: { limit, offset, count: packages?.length || 0 },
    })
  } catch (err) {
    console.error('[packages-list] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

/**
 * POST /api/brands/[brandId]/packages
 * Create a new content package
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
      campaignProfileId,
      pillarId,
      topic,
      evidenceIds,
      targetPlatforms,
      targetFormats,
      dueDate,
    } = body

    if (!name || !topic) {
      return NextResponse.json(
        { error: 'name and topic are required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // Create package
    const { data: pkg, error: pkgError } = await admin
      .from('content_packages')
      .insert({
        brand_id: brandId,
        workspace_id: '00000000-0000-0000-0000-000000000000',
        name,
        description,
        campaign_profile_id: campaignProfileId,
        content_pillar_id: pillarId,
        topic,
        evidence_ids: evidenceIds || [],
        target_platforms: targetPlatforms || [],
        target_formats: targetFormats || [],
        status: 'draft',
        due_date: dueDate,
      })
      .select()
      .single()

    if (pkgError) throw pkgError

    return NextResponse.json({ package: pkg }, { status: 201 })
  } catch (err) {
    console.error('[packages-create] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
