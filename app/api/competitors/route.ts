import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const brandId = request.nextUrl.searchParams.get('brand_id')
    const regionId = request.nextUrl.searchParams.get('region_id')
    const admin = getSupabaseAdmin()

    let query = admin
      .from('competitors')
      .select('*')
      .order('name', { ascending: true })

    if (brandId) {
      query = query.eq('brand_id', brandId)
    } else if (regionId) {
      // Sprint 12 Phase 4: same brand-mediated region filter as
      // /api/competitors/summary -- competitors have no region_id of
      // their own, only brand_id.
      const { data: brandsInRegion, error: brandsError } = await admin
        .from('brand_profiles')
        .select('id')
        .eq('region_id', regionId)
      if (brandsError) return NextResponse.json({ error: brandsError.message }, { status: 500 })

      const brandIds = (brandsInRegion ?? []).map((b: { id: string }) => b.id)
      if (brandIds.length === 0) return NextResponse.json({ competitors: [] })
      query = query.in('brand_id', brandIds)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ competitors: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      brand_id?: string
      name?: string
      website?: string
      notes?: string
    }

    const name = body.name?.trim()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const { data, error } = await getSupabaseAdmin()
      .from('competitors')
      .insert({
        brand_id: body.brand_id ?? null,
        name,
        website: body.website?.trim() || null,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}