import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  try {
    const supabase = getSupabase()

    // Bug fix: this queried a `brands` table that has never existed in
    // this schema (confirmed against all 44 migrations — only
    // brand_profiles exists). Every load of the Overview tab has 404'd
    // until now. Also: regions has no `locale` column, it's `locale_code`.
    const { data: brand, error: brandError } = await supabase
      .from('brand_profiles')
      .select(`*, regions:region_id (name, locale_code)`)
      .eq('id', brandId)
      .single()

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const { data: ruleSet } = await supabase
      .from('brand_rule_sets')
      .select('id, version, status')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Bug fix: brand_rules has no brand_id column (only rule_set_id) and
    // no status column (only a human_approved boolean) — the original
    // query here filtered on two columns that don't exist and would have
    // errored (silently returning 0/0/0 via the `|| 0` fallbacks) even
    // once the `brands` table bug above was fixed. Counting via the
    // active rule set instead.
    let totalRules = 0
    let approvedRules = 0
    let pendingRules = 0
    if (ruleSet?.id) {
      const [{ count: total }, { count: approved }, { count: pending }] = await Promise.all([
        supabase.from('brand_rules').select('*', { count: 'exact', head: true }).eq('rule_set_id', ruleSet.id),
        supabase.from('brand_rules').select('*', { count: 'exact', head: true }).eq('rule_set_id', ruleSet.id).eq('human_approved', true),
        supabase.from('brand_rules').select('*', { count: 'exact', head: true }).eq('rule_set_id', ruleSet.id).eq('human_approved', false),
      ])
      totalRules = total || 0
      approvedRules = approved || 0
      pendingRules = pending || 0
    }

    return NextResponse.json({
      overview: {
        id: brand.id,
        brandName: brand.brand_name,
        positioning: brand.positioning ?? '',
        voiceDescription: brand.voice_description,
        targetAudience: brand.target_audience,
        competitors: brand.competitors,
        isActive: brand.is_active,
        isDefault: brand.is_default,
        regionName: brand.regions?.name || 'Unknown',
        locale: brand.regions?.locale_code || 'pt-BR',
        ruleSetVersion: ruleSet?.version || 'none',
        ruleSetStatus: ruleSet?.status || 'none',
        totalRules,
        approvedRules,
        pendingRules,
      }
    })
  } catch (error) {
    console.error('Overview API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
