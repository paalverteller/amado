import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: playbooks, error } = await supabase
      .from('platform_playbooks')
      .select('*')
      .eq('brand_id', brandId)
      .eq('active', true)
      .order('platform', { ascending: true })

    if (error) throw error
    return NextResponse.json({ playbooks: playbooks || [] })
  } catch (error) {
    console.error('Playbooks API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
