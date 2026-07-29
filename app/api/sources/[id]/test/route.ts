import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { fetchAndSaveRss } from '@/lib/rss'
import { normalizeConnectorType } from '@/lib/ingestion/types'
import { recordSourceHealth } from '@/lib/evidence'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const startMs = Date.now()

  try {
    // 1. Load source
    const { data: source, error: sourceError } = await getSupabaseAdmin()
      .from('rss_sources')
      .select('id, name, url, source_type, active, country, region_id')
      .eq('id', id)
      .single()

    if (sourceError || !source) {
      return NextResponse.json(
        { error: 'Source not found', sourceId: id },
        { status: 404 }
      )
    }

    if (!source.active) {
      return NextResponse.json(
        {
          sourceId: id,
          name: source.name,
          status: 'skipped',
          reason: 'Source is inactive',
        },
        { status: 200 }
      )
    }

    // 2. Quick connectivity probe (HEAD first for speed)
    let probeOk = false
    let probeStatus = 0
    try {
      const probe = await fetch(source.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(8_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/atom+xml, text/html, */*',
        },
      })
      probeOk = probe.ok
      probeStatus = probe.status
    } catch {
      probeOk = false
    }

    // 3. Run real ingestion test (limited to 3 items)
    const connectorType = normalizeConnectorType(source.source_type)
    let itemsFetched = 0
    let ingestionError: string | null = null

    try {
      // We call fetchAndSaveRss which does the full pipeline
      // It will save to both rss_items and evidence_items
      itemsFetched = await fetchAndSaveRss(source.id, source.url, connectorType)
    } catch (err) {
      ingestionError = getErrorMessage(err)
      await recordSourceHealth({
        sourceId: source.id,
        eventType: 'failure',
        errorMessage: ingestionError,
        responseTimeMs: Date.now() - startMs,
      })
    }

    const durationMs = Date.now() - startMs

    // 4. Record success if we got items
    if (itemsFetched > 0 && !ingestionError) {
      await recordSourceHealth({
        sourceId: source.id,
        eventType: 'success',
        itemsYielded: itemsFetched,
        responseTimeMs: durationMs,
      })
    }

    // 5. Build response
    const healthy = itemsFetched > 0 && !ingestionError
    const degraded = probeOk && itemsFetched === 0 && !ingestionError

    return NextResponse.json({
      sourceId: source.id,
      name: source.name,
      url: source.url,
      connectorType,
      status: healthy ? 'healthy' : degraded ? 'degraded' : 'unhealthy',
      probe: {
        ok: probeOk,
        status: probeStatus,
      },
      ingestion: {
        itemsFetched,
        error: ingestionError,
        durationMs,
      },
      testedAt: new Date().toISOString(),
    })
  } catch (err) {
    const durationMs = Date.now() - startMs
    return NextResponse.json(
      {
        sourceId: id,
        status: 'error',
        error: getErrorMessage(err),
        durationMs,
      },
      { status: 500 }
    )
  }
}
