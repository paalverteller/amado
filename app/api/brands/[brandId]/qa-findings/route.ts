import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: findings, error } = await supabase
      .from('qa_findings')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return NextResponse.json({ findings: findings || [] })
  } catch (error) {
    console.error('QA findings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
