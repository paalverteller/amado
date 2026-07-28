import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    const { data: examples, error } = await supabase
      .from('approved_examples')
      .select(`
        *,
        pillar:content_pillar_id (name)
      `)
      .eq('brand_id', brandId)
      .eq('active', true)
      .order('approved_at', { ascending: false })

    if (error) throw error

    const formatted = (examples || []).map(ex => ({
      ...ex,
      pillarName: ex.pillar?.name || 'Unknown',
    }))

    return NextResponse.json({ examples: formatted })
  } catch (error) {
    console.error('Examples API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
