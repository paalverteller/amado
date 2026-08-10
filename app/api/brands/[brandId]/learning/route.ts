import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

interface RouteContext {
  params: Promise<{ brandId: string }>
}

/**
 * GET /api/brands/[brandId]/learning
 *
 * Read-only view over what's been recorded for this brand: manually
 * entered performance snapshots and explicit preference signals (see
 * POST below). Rewritten from scratch -- the previous version of this
 * route referenced columns that don't exist on any of these tables
 * (performance_snapshots.metrics/period_start/format,
 * content_pattern_usage.usage_count/pattern_key,
 * preference_profiles.preference_type/weight) and would have failed on
 * every call. See migration 043 for what actually changed vs. what was
 * simply always wrong here.
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { brandId } = await context.params
    const type = request.nextUrl.searchParams.get('type') || 'all'
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 200)
    const admin = getSupabaseAdmin()
    const result: Record<string, unknown[]> = {}

    if (type === 'all' || type === 'performance') {
      const { data, error } = await admin
        .from('performance_snapshots')
        .select('*, article:article_id (topic, content_type)')
        .eq('brand_id', brandId)
        .order('recorded_at', { ascending: false })
        .limit(limit)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result.performance = data ?? []
    }

    if (type === 'all' || type === 'preferences') {
      const { data, error } = await admin
        .from('preference_profiles')
        .select('*')
        .eq('brand_id', brandId)
        .eq('active', true)
        .order('confidence', { ascending: false })
        .limit(limit)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result.preferences = data ?? []
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

/**
 * POST /api/brands/[brandId]/learning
 *
 * Records ONE explicit preference signal -- a person looking at
 * performance data decides "this worked, remember it" and describes the
 * pattern themselves (patternKey/patternValue, free text: e.g.
 * profileType="hook", patternKey="opener_style", patternValue="question").
 * This is the sprint's "explicit-signal learning loop": the signal only
 * exists because a human typed it after looking at real results. This
 * route never writes to brand_claims/brand_terms/brand_rules or any
 * other governance table -- preference_profiles is an observational,
 * human-curated log a person can review and act on manually in the
 * Brand workspace, not something the system applies on its own
 * (plan §11.4: no automatic Brand OS rewrites).
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { brandId } = await context.params
    const body = await request.json() as {
      profileType?: string
      patternKey?: string
      patternValue?: string
    }

    const profileType = body.profileType?.trim()
    const patternKey = body.patternKey?.trim()
    const patternValue = body.patternValue?.trim()

    const validTypes = ['hook', 'structure', 'ending', 'cta', 'visual', 'tone']
    if (!profileType || !validTypes.includes(profileType)) {
      return NextResponse.json({ error: `profileType must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }
    if (!patternKey || !patternValue) {
      return NextResponse.json({ error: 'patternKey and patternValue are required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    const { data: existing } = await admin
      .from('preference_profiles')
      .select('id, confidence, evidence_count')
      .eq('brand_id', brandId)
      .eq('profile_type', profileType)
      .eq('pattern_key', patternKey)
      .eq('pattern_value', patternValue)
      .maybeSingle()

    if (existing) {
      const { data, error } = await admin
        .from('preference_profiles')
        .update({
          confidence: Math.min(1, existing.confidence + 0.1),
          evidence_count: existing.evidence_count + 1,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          active: true,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    const { data, error } = await admin
      .from('preference_profiles')
      .insert({
        brand_id: brandId,
        profile_type: profileType,
        pattern_key: patternKey,
        pattern_value: patternValue,
        confidence: 0.5,
        evidence_count: 1,
        last_used_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
