import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: audiences, error } = await supabase
      .from('brand_audiences')
      .select('*')
      .eq('brand_id', brandId)
      .eq('active', true)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ audiences: audiences || [] })
  } catch (error) {
    console.error('Audiences API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
