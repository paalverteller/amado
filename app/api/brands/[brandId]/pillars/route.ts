import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: pillars, error } = await supabase
      .from('brand_content_pillars')
      .select('*')
      .eq('brand_id', brandId)
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ pillars: pillars || [] })
  } catch (error) {
    console.error('Pillars API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
