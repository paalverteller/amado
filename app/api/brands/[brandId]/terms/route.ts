import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: terms, error } = await supabase
      .from('brand_terms')
      .select('*')
      .eq('brand_id', brandId)
      .eq('active', true)
      .order('term', { ascending: true })

    if (error) throw error
    return NextResponse.json({ terms: terms || [] })
  } catch (error) {
    console.error('Terms API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
