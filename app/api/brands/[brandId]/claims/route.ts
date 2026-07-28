import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: claims, error } = await supabase
      .from('brand_claims')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ claims: claims || [] })
  } catch (error) {
    console.error('Claims API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
