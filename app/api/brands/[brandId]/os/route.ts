import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

interface Context {
  params: Promise<{ brandId: string }>
}

const PROFILE_FIELDS = new Set([
  'brand_name', 'voice_description', 'forbidden_words', 'example_posts',
  'target_audience', 'competitors', 'positioning', 'value_propositions',
  'strategic_themes', 'product_facts', 'proof_points', 'cta_library',
  'legal_disclaimers', 'glossary', 'sensitive_topics', 'default_platform_rules',
])

const PILLAR_FIELDS = new Set([
  'name', 'purpose', 'default_product_explicitness', 'risk_level', 'active', 'sort_order',
])

const TERM_FIELDS = new Set([
  'locale', 'term', 'normalized_term', 'policy', 'replacement', 'notes', 'platform', 'format',
])

function pick(body: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([key]) => allowed.has(key)))
}

export async function GET(_request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const { brandId } = await context.params
    const admin = getSupabaseAdmin()
    const [{ data: profile, error: profileError }, { data: pillars, error: pillarError }, { data: terms, error: termError }] = await Promise.all([
      admin.from('brand_profiles').select('*').eq('id', brandId).single(),
      admin.from('brand_content_pillars').select('*').eq('brand_id', brandId).order('sort_order', { ascending: true }),
      admin.from('brand_terms').select('*').eq('brand_id', brandId).order('policy', { ascending: true }).order('term', { ascending: true }),
    ])
    if (profileError) throw profileError
    if (pillarError) throw pillarError
    if (termError) throw termError
    return NextResponse.json({ profile, pillars: pillars ?? [], terms: terms ?? [] })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const { brandId } = await context.params
    const body = await request.json() as {
      profile?: Record<string, unknown>
      entity?: 'pillar' | 'term'
      id?: string
      patch?: Record<string, unknown>
    }
    const admin = getSupabaseAdmin()

    if (body.profile) {
      const patch = pick(body.profile, PROFILE_FIELDS)
      if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No profile fields supplied' }, { status: 400 })
      patch.updated_at = new Date().toISOString()
      const { data, error } = await admin.from('brand_profiles').update(patch).eq('id', brandId).select('*').single()
      if (error) throw error
      return NextResponse.json({ profile: data })
    }

    if (body.entity === 'pillar' && body.id && body.patch) {
      const patch = pick(body.patch, PILLAR_FIELDS)
      const { data, error } = await admin
        .from('brand_content_pillars')
        .update(patch)
        .eq('id', body.id)
        .eq('brand_id', brandId)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ pillar: data })
    }

    if (body.entity === 'term' && body.id && body.patch) {
      const patch = pick(body.patch, TERM_FIELDS)
      const { data, error } = await admin
        .from('brand_terms')
        .update(patch)
        .eq('id', body.id)
        .eq('brand_id', brandId)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ term: data })
    }

    return NextResponse.json({ error: 'Unsupported Brand OS update' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
