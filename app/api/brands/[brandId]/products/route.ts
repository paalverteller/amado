import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: products, error } = await supabase
      .from('brand_products')
      .select('*')
      .eq('brand_id', brandId)
      .eq('active', true)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ products: products || [] })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
