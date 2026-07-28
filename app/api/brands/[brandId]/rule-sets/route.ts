import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: ruleSets, error } = await supabase
      .from('brand_rule_sets')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ ruleSets: ruleSets || [] })
  } catch (error) {
    console.error('Rule sets API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
