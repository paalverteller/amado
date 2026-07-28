import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: painPoints, error } = await supabase
      .from('brand_pain_points')
      .select('*')
      .eq('brand_id', brandId)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ painPoints: painPoints || [] })
  } catch (error) {
    console.error('Pain points API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
