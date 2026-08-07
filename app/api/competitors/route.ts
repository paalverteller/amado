import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const brandId = request.nextUrl.searchParams.get('brand_id')

    let query = getSupabaseAdmin()
      .from('competitors')
      .select('*')
      .order('name', { ascending: true })

    if (brandId) query = query.eq('brand_id', brandId)

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
