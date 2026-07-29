import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { normalizeConnectorType } from '@/lib/ingestion/types'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('rss_sources')
      .select('*')
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sources: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
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
    }

    const name = body.name?.trim()
    const url = body.url?.trim()
    const sourceType = normalizeConnectorType(body.source_type ?? body.sourceType)
    const country = (body.country ?? 'Brasil').trim()

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    if (!url.startsWith('http') && !url.startsWith('pubmed:')) {
      return NextResponse.json({ error: 'URL must start with http(s) or pubmed:' }, { status: 400 })
    }

    // Resolve region_id from country if not provided
    let regionId = body.region_id
    if (!regionId && country) {
      const { data: region } = await getSupabaseAdmin()
        .from('regions')
        .select('id')
        .eq('code', country.toUpperCase() === 'BRASIL' ? 'BR' : country.toUpperCase())
        .maybeSingle()
      if (region?.id) regionId = region.id
    }

    const { data, error } = await getSupabaseAdmin()
      .from('rss_sources')
      .insert({
        name,
        url,
        source_type: sourceType,
        country,
        region_id: regionId,
        language_code: body.language_code ?? 'pt-BR',
        parser_config: body.parser_config ?? {},
        active: body.active ?? true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
