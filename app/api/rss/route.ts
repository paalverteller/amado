import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { normalizeConnectorType } from '@/lib/ingestion/types'
import { getErrorMessage } from '@/lib/api/error-message'
import { resolveRegionProfile } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

type CompetitorScope = {
  regionId: string | null
  country: string | null
  locale: string | null
}

async function resolveCompetitorScope(competitorId: string): Promise<CompetitorScope> {
  const admin = getSupabaseAdmin()
  const { data: competitor, error: competitorError } = await admin
    .from('competitors')
    .select('brand_id')
    .eq('id', competitorId)
    .maybeSingle()
  if (competitorError) throw new Error(competitorError.message)
  if (!competitor) throw new Error('Competitor not found')

  if (!competitor.brand_id) return { regionId: null, country: null, locale: null }
  const { data: brand, error: brandError } = await admin
    .from('brand_profiles')
    .select('region_id')
    .eq('id', competitor.brand_id)
    .maybeSingle()
  if (brandError) throw new Error(brandError.message)
  if (!brand?.region_id) return { regionId: null, country: null, locale: null }

  const profile = await resolveRegionProfile(brand.region_id)
  return {
    regionId: brand.region_id,
    country: profile?.name ?? null,
    locale: profile?.locale ?? null,
  }
}

async function linkCompetitorSource(competitorId: string, sourceId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('competitor_source_links')
    .upsert({ competitor_id: competitorId, source_id: sourceId }, { onConflict: 'competitor_id,source_id' })
  if (error) throw new Error(`Failed to link competitor source: ${error.message}`)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const regionId = request.nextUrl.searchParams.get('region_id')
    const category = request.nextUrl.searchParams.get('source_category')
    let query = getSupabaseAdmin().from('rss_sources').select('*').order('name', { ascending: true })
    if (regionId) query = query.eq('region_id', regionId)
    if (category) query = query.eq('source_category', category)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sources: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      name?: string
      url?: string
      source_type?: string
      sourceType?: string
      country?: string
      region_id?: string
      language_code?: string
      parser_config?: Record<string, unknown>
      active?: boolean
      competitor_id?: string
      source_category?: string
    }

    const name = body.name?.trim()
    const url = body.url?.trim()
    const sourceType = normalizeConnectorType(body.source_type ?? body.sourceType)
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    if (!url.startsWith('http') && !url.startsWith('pubmed:')) {
      return NextResponse.json({ error: 'URL must start with http(s) or pubmed:' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const competitorScope = body.competitor_id ? await resolveCompetitorScope(body.competitor_id) : null
    let regionId = body.region_id ?? competitorScope?.regionId ?? undefined
    let country = body.country?.trim() || competitorScope?.country || 'Brasil'

    if (!regionId && country && country !== 'Global') {
      const normalizedCountry = country.toUpperCase() === 'BRASIL' ? 'BR' : country.toUpperCase()
      const { data: region } = await admin.from('regions').select('id').eq('code', normalizedCountry).maybeSingle()
      if (region?.id) regionId = region.id
    }

    const resolvedRegion = regionId ? await resolveRegionProfile(regionId) : null
    const languageCode = body.language_code ?? competitorScope?.locale ?? resolvedRegion?.locale ?? 'pt-BR'
    const sourceCategory = body.source_category ?? (body.competitor_id ? 'competitor' : 'general')

    const { data: existing, error: existingError } = await admin
      .from('rss_sources')
      .select('*')
      .eq('url', url)
      .maybeSingle()
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

    if (existing) {
      if (body.competitor_id) await linkCompetitorSource(body.competitor_id, existing.id)
      const { data: updated, error: updateError } = await admin
        .from('rss_sources')
        .update({
          name,
          source_type: sourceType,
          active: body.active ?? true,
          ...(body.competitor_id ? { source_category: 'competitor' } : {}),
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
      return NextResponse.json(updated)
    }

    const { data, error } = await admin
      .from('rss_sources')
      .insert({
        name,
        url,
        source_type: sourceType,
        country,
        region_id: regionId ?? null,
        language_code: languageCode,
        parser_config: body.parser_config ?? {},
        active: body.active ?? true,
        competitor_id: body.competitor_id ?? null,
        source_category: sourceCategory,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (body.competitor_id) await linkCompetitorSource(body.competitor_id, data.id)
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
