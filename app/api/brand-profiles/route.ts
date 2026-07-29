import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get('region_id')
    
    let query = getSupabaseAdmin()
      .from('brand_profiles')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (regionId) {
      query = query.eq('region_id', regionId)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ profiles: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // PATCH — update existing
    if (body.id) {
      const { data, error } = await getSupabaseAdmin()
        .from('brand_profiles')
        .update({
          brand_name: body.brand_name,
          voice_description: body.voice_description,
          forbidden_words: body.forbidden_words,
          example_posts: body.example_posts,
          target_audience: body.target_audience,
          competitors: body.competitors,
          positioning: body.positioning,
          value_propositions: body.value_propositions,
          strategic_themes: body.strategic_themes,
          product_facts: body.product_facts,
          proof_points: body.proof_points,
          cta_library: body.cta_library,
          legal_disclaimers: body.legal_disclaimers,
          glossary: body.glossary,
          sensitive_topics: body.sensitive_topics,
          default_platform_rules: body.default_platform_rules,
          region_id: body.region_id,
          is_active: body.is_active,
          is_default: body.is_default,
        })
        .eq('id', body.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ profile: data })
    }

    // POST — create new
    const { data, error } = await getSupabaseAdmin()
      .from('brand_profiles')
      .insert({
        brand_name: body.brand_name,
        voice_description: body.voice_description ?? '',
        forbidden_words: body.forbidden_words ?? '',
        example_posts: body.example_posts ?? '',
        target_audience: body.target_audience ?? '',
        competitors: body.competitors ?? '',
        positioning: body.positioning ?? '',
        value_propositions: body.value_propositions ?? '',
        strategic_themes: body.strategic_themes ?? '',
        product_facts: body.product_facts ?? '',
        proof_points: body.proof_points ?? '',
        cta_library: body.cta_library ?? '',
        legal_disclaimers: body.legal_disclaimers ?? '',
        glossary: body.glossary ?? '',
        sensitive_topics: body.sensitive_topics ?? '',
        default_platform_rules: body.default_platform_rules ?? '',
        region_id: body.region_id,
        is_default: body.is_default ?? false,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ profile: data })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await getSupabaseAdmin()
      .from('brand_profiles')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
