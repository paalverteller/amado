import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()
    
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select(`*, regions:region_id (name, locale)`)
      .eq('id', brandId)
      .single()

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const { data: ruleSet } = await supabase
      .from('brand_rule_sets')
      .select('version, status')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { count: totalRules } = await supabase
      .from('brand_rules')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)

    const { count: approvedRules } = await supabase
      .from('brand_rules')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'approved')

    const { count: pendingRules } = await supabase
      .from('brand_rules')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'pending')

    return NextResponse.json({
      overview: {
        id: brand.id,
        brandName: brand.brand_name,
        positioning: brand.positioning,
        voiceDescription: brand.voice_description,
        targetAudience: brand.target_audience,
        competitors: brand.competitors,
        isActive: brand.is_active,
        isDefault: brand.is_default,
        regionName: brand.regions?.name || 'Unknown',
        locale: brand.regions?.locale || 'pt-BR',
        ruleSetVersion: ruleSet?.version || 'none',
        ruleSetStatus: ruleSet?.status || 'none',
        totalRules: totalRules || 0,
        approvedRules: approvedRules || 0,
        pendingRules: pendingRules || 0,
      }
    })
  } catch (error) {
    console.error('Overview API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
