import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/brands/[brandId]/packages/[packageId]/assets
 * List assets in a package
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; packageId: string }> }
) {
  try {
    const { packageId } = await params
    const admin = getSupabaseAdmin()

    const { data: assets, error } = await admin
      .from('content_assets')
      .select('*')
      .eq('package_id', packageId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ assets: assets || [] })
  } catch (err) {
    console.error('[assets-list] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/brands/[brandId]/packages/[packageId]/assets
 * Create a new asset in a package
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; packageId: string }> }
) {
  try {
    const { packageId } = await params
    const body = await request.json()
    const {
      platform,
      format,
      content,
      status,
      qaStatus,
      generationParams,
    } = body

    if (!platform || !format) {
      return NextResponse.json(
        { error: 'platform and format are required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    const { data: asset, error } = await admin
      .from('content_assets')
      .insert({
        package_id: packageId,
        platform,
        format,
        content,
        status: status || 'draft',
        qa_status: qaStatus || 'pending',
        generation_params: generationParams || {},
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ asset }, { status: 201 })
  } catch (err) {
    console.error('[asset-create] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
