import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

/**
 * GET /api/brands/[brandId]/learning
 * Get learning data: performance snapshots, patterns, preferences
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')

    const admin = getSupabaseAdmin()
    const result: any = {}

    if (type === 'all' || type === 'performance') {
      const { data: snapshots } = await admin
        .from('performance_snapshots')
        .select('*')
        .eq('brand_id', brandId)
        .order('period_start', { ascending: false })
        .limit(limit)
      result.performance = snapshots || []
    }

    if (type === 'all' || type === 'patterns') {
      const { data: patterns } = await admin
        .from('content_pattern_usage')
        .select('*')
        .eq('brand_id', brandId)
        .order('usage_count', { ascending: false })
        .limit(limit)
      result.patterns = patterns || []
    }

    if (type === 'all' || type === 'preferences') {
      const { data: preferences } = await admin
        .from('preference_profiles')
        .select('*')
        .eq('brand_id', brandId)
        .order('updated_at', { ascending: false })
        .limit(limit)
      result.preferences = preferences || []
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[learning-get] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

/**
 * POST /api/brands/[brandId]/learning
 * Record performance data and update learning loop
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const body = await request.json()
    const {
      assetId,
      platform,
      format,
      pillarId,
      metrics,
      periodStart,
      periodEnd,
    } = body

    if (!assetId || !metrics) {
      return NextResponse.json(
        { error: 'assetId and metrics are required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // 1. Record performance snapshot
    const { data: snapshot, error: snapshotError } = await admin
      .from('performance_snapshots')
      .insert({
        brand_id: brandId,
        asset_id: assetId,
        platform,
        format,
        content_pillar_id: pillarId,
        metrics,
        period_start: periodStart || new Date().toISOString(),
        period_end: periodEnd || new Date().toISOString(),
      })
      .select()
      .single()

    if (snapshotError) throw snapshotError

    // 2. Update or create content pattern usage
    const patternKey = `${platform}:${format}:${pillarId || 'none'}`
    const { data: existingPattern } = await admin
      .from('content_pattern_usage')
      .select('*')
      .eq('brand_id', brandId)
      .eq('pattern_key', patternKey)
      .single()

    if (existingPattern) {
      // Update existing pattern
      const newUsageCount = existingPattern.usage_count + 1
      const currentAvg = existingPattern.avg_performance || {}
      const newAvg: any = {}
      
      for (const [key, value] of Object.entries(metrics)) {
        const currentVal = (currentAvg as any)[key] || 0
        newAvg[key] = (currentVal * existingPattern.usage_count + (value as number)) / newUsageCount
      }

      await admin
        .from('content_pattern_usage')
        .update({
          usage_count: newUsageCount,
          avg_performance: newAvg,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existingPattern.id)
    } else {
      // Create new pattern
      await admin
        .from('content_pattern_usage')
        .insert({
          brand_id: brandId,
          pattern_key: patternKey,
          pattern_type: 'platform_format_pillar',
          platform,
          format,
          content_pillar_id: pillarId,
          usage_count: 1,
          avg_performance: metrics,
          last_used_at: new Date().toISOString(),
        })
    }

    // 3. Update preference profile
    const { data: existingPref } = await admin
      .from('preference_profiles')
      .select('*')
      .eq('brand_id', brandId)
      .eq('preference_type', 'platform_format')
      .eq('preference_key', `${platform}:${format}`)
      .single()

    const performanceScore = calculatePerformanceScore(metrics)

    if (existingPref) {
      const newWeight = Math.min(1.0, existingPref.weight + 0.05)
      await admin
        .from('preference_profiles')
        .update({
          weight: newWeight,
          performance_score: performanceScore,
          evidence_count: existingPref.evidence_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPref.id)
    } else {
      await admin
        .from('preference_profiles')
        .insert({
          brand_id: brandId,
          preference_type: 'platform_format',
          preference_key: `${platform}:${format}`,
          weight: 0.5,
          performance_score: performanceScore,
          evidence_count: 1,
        })
    }

    return NextResponse.json({
      snapshot,
      message: 'Performance recorded and learning loop updated',
    })
  } catch (err) {
    console.error('[learning-post] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

function calculatePerformanceScore(metrics: any): number {
  // Simple weighted score based on common metrics
  const weights: Record<string, number> = {
    engagement_rate: 0.3,
    click_through_rate: 0.25,
    conversion_rate: 0.25,
    reach: 0.1,
    impressions: 0.1,
  }

  let score = 0
  let totalWeight = 0

  for (const [key, weight] of Object.entries(weights)) {
    if (metrics[key] !== undefined) {
      // Normalize to 0-1 range (assuming percentages)
      const normalized = Math.min(1, Math.max(0, metrics[key] / 100))
      score += normalized * weight
      totalWeight += weight
    }
  }

  return totalWeight > 0 ? score / totalWeight : 0.5
}
