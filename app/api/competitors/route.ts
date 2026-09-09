import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

async function resolveBrandIdForRegion(regionId: string): Promise<string | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('brand_profiles')
    .select('id')
    .eq('region_id', regionId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id ?? null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const brandId = request.nextUrl.searchParams.get('brand_id')
    const regionId = request.nextUrl.searchParams.get('region_id')
    const admin = getSupabaseAdmin()

    let query = admin.from('competitors').select('*').order('name', { ascending: true })

    if (brandId) {
      query = query.eq('brand_id', brandId)
    } else if (regionId) {
      const { data: brandsInRegion, error: brandsError } = await admin
        .from('brand_profiles')
        .select('id')
        .eq('region_id', regionId)
      if (brandsError) return NextResponse.json({ error: brandsError.message }, { status: 500 })

      const brandIds = (brandsInRegion ?? []).map((brand: { id: string }) => brand.id)
      if (brandIds.length === 0) return NextResponse.json({ competitors: [] })
      query = query.in('brand_id', brandIds)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ competitors: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      brand_id?: string
      region_id?: string
      name?: string
      website?: string
      notes?: string
    }

    const name = body.name?.trim()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    let brandId = body.brand_id?.trim() || null
    if (!brandId && body.region_id) brandId = await resolveBrandIdForRegion(body.region_id)
    if (!brandId) {
      return NextResponse.json({ error: 'A market-specific brand profile is required for this competitor' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: existing, error: existingError } = await admin
      .from('competitors')
      .select('id')
      .eq('brand_id', brandId)
      .ilike('name', name)
      .maybeSingle()
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
    if (existing) return NextResponse.json({ error: 'Competitor already exists in this market' }, { status: 409 })

    const { data, error } = await admin
      .from('competitors')
      .insert({
        brand_id: brandId,
        name,
        website: body.website?.trim() || null,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
