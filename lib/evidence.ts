/**
 * Amado — Evidence Layer Operations
 * 
 * §9.3: Evidence layer — normalized records with source/ localization separation.
 */

import { getSupabaseAdmin } from '@/lib/supabase/client'
import crypto from 'crypto'
import { isMarketEvidenceEligible } from '@/lib/market-source-policy'
export interface EvidenceInput {
  sourceId: string
  canonicalUrl: string
  sourceTitle: string
  sourceSummary?: string | null
  sourceLanguage?: string | null
  sourceAuthor?: string | null
  publishedAt?: string | null
  sourceAuthority?: number
  regionIds?: string[]
  topics?: string[]
  entities?: string[]
  /** Full article/content text, when already known (e.g. manual paste). */
  fullText?: string | null
  /** Defaults to 'full_text' when fullText is provided, else 'snippet'. */
  hydrationStatus?: 'snippet' | 'full_text' | 'failed'
}

export interface RawPayloadInput {
  sourceId: string
  connectorType: string
  endpoint: string
  rawPayload: Record<string, unknown>
  httpStatus?: number
  contentType?: string
  errorMessage?: string
  durationMs?: number
}

/**
 * Normalize URL to canonical form for deduplication.
 * Removes tracking parameters, fragments, trailing slashes.
 */
export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'ttclid', 'li_fat_id', 'mc_cid', 'mc_eid',
      'ref', 'source', 'campaign', 'medium',
    ]
    trackingParams.forEach(p => u.searchParams.delete(p))
    u.hash = ''
    let pathname = u.pathname
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    u.pathname = pathname
    return u.toString().toLowerCase()
  } catch {
    return url.toLowerCase().trim()
  }
}

/**
 * Generate content fingerprint for fuzzy deduplication.
 * Uses normalized title + first 200 chars of summary.
 */
export function generateFingerprint(title: string, summary?: string | null): string {
  const normalized = `${title.trim().toLowerCase()}|${(summary ?? '').trim().toLowerCase().slice(0, 200)}`
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32)
}

/**
 * Save raw ingestion payload.
 */
export async function saveRawPayload(input: RawPayloadInput): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from('source_items_raw')
    .insert({
      source_id: input.sourceId,
      connector_type: input.connectorType,
      endpoint: input.endpoint,
      raw_payload: input.rawPayload,
      http_status: input.httpStatus,
      content_type: input.contentType,
      error_message: input.errorMessage,
      duration_ms: input.durationMs,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save raw payload: ${error.message}`)
  return data!.id
}

/**
 * Save or update an evidence item.
 * Returns the evidence item ID.
 */
export async function saveEvidence(input: EvidenceInput): Promise<string> {
  const canonicalUrl = canonicalizeUrl(input.canonicalUrl)
  const fingerprint = generateFingerprint(input.sourceTitle, input.sourceSummary)
  const hydrationStatus = input.hydrationStatus ?? (input.fullText ? 'full_text' : 'snippet')

  const { data: existing } = await getSupabaseAdmin()
    .from('evidence_items')
    .select('id')
    .eq('source_id', input.sourceId)
    .eq('canonical_url', canonicalUrl)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await getSupabaseAdmin()
      .from('evidence_items')
      .update({
        source_title: input.sourceTitle,
        source_summary: input.sourceSummary ?? null,
        source_language: input.sourceLanguage ?? null,
        source_author: input.sourceAuthor ?? null,
        published_at: input.publishedAt ?? null,
        content_fingerprint: fingerprint,
        source_authority: input.sourceAuthority ?? 1.0,
        region_ids: input.regionIds ?? null,
        topics: input.topics ?? null,
        entities: input.entities ?? null,
        full_text: input.fullText ?? null,
        hydration_status: hydrationStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) throw new Error(`Failed to update evidence: ${error.message}`)
    return data!.id
  }

  const { data, error } = await getSupabaseAdmin()
    .from('evidence_items')
    .insert({
      source_id: input.sourceId,
      canonical_url: canonicalUrl,
      content_fingerprint: fingerprint,
      source_language: input.sourceLanguage ?? null,
      source_title: input.sourceTitle,
      source_summary: input.sourceSummary ?? null,
      source_author: input.sourceAuthor ?? null,
      published_at: input.publishedAt ?? null,
      source_authority: input.sourceAuthority ?? 1.0,
      region_ids: input.regionIds ?? null,
      topics: input.topics ?? null,
      entities: input.entities ?? null,
      full_text: input.fullText ?? null,
      hydration_status: hydrationStatus,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save evidence: ${error.message}`)
  return data!.id
}

/**
 * Record ingestion run for observability.
 */
export async function recordIngestionRun(params: {
  sourceId: string
  connectorType: string
  itemsDiscovered: number
  itemsSaved: number
  itemsDuplicated?: number
  errors?: string[]
  success: boolean
  metadata?: Record<string, unknown>
}): Promise<void> {
  await getSupabaseAdmin()
    .from('ingestion_runs')
    .insert({
      source_id: params.sourceId,
      connector_type: params.connectorType,
      items_discovered: params.itemsDiscovered,
      items_saved: params.itemsSaved,
      items_duplicated: params.itemsDuplicated ?? 0,
      errors: params.errors ?? [],
      success: params.success,
      metadata: params.metadata ?? {},
      finished_at: new Date().toISOString(),
    })
}

/**
 * Record source health event.
 */
export async function recordSourceHealth(params: {
  sourceId: string
  eventType: 'success' | 'failure' | 'degraded' | 'recovered'
  httpStatus?: number
  errorMessage?: string
  itemsYielded?: number
  responseTimeMs?: number
}): Promise<void> {
  await getSupabaseAdmin()
    .from('source_health_events')
    .insert({
      source_id: params.sourceId,
      event_type: params.eventType,
      http_status: params.httpStatus,
      error_message: params.errorMessage,
      items_yielded: params.itemsYielded ?? 0,
      response_time_ms: params.responseTimeMs,
    })

  const status = params.eventType === 'success' ? 'healthy' 
    : params.eventType === 'recovered' ? 'healthy'
    : params.eventType === 'degraded' ? 'degraded'
    : 'unhealthy'

  const { data: source } = await getSupabaseAdmin()
    .from('rss_sources')
    .select('consecutive_failures')
    .eq('id', params.sourceId)
    .single()

  const consecutiveFailures = params.eventType === 'success' || params.eventType === 'recovered'
    ? 0
    : ((source?.consecutive_failures ?? 0) + 1)

  await getSupabaseAdmin()
    .from('rss_sources')
    .update({
      health_status: status,
      consecutive_failures: consecutiveFailures,
      last_success_at: params.eventType === 'success' ? new Date().toISOString() : undefined,
      last_failure_at: params.eventType === 'failure' ? new Date().toISOString() : undefined,
    })
    .eq('id', params.sourceId)
}

/**
 * Find duplicate evidence items by fingerprint.
 */
export async function findDuplicates(fingerprint: string, excludeId?: string): Promise<{ id: string; canonical_url: string }[]> {
  let query = getSupabaseAdmin()
    .from('evidence_items')
    .select('id, canonical_url')
    .eq('content_fingerprint', fingerprint)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query.limit(5)
  if (error) return []
  return data ?? []
}

/** A structured recent-market context so generation can persist the exact evidence IDs it used. */
export interface RecentEvidenceContext {
  text: string
  ids: string[]
  items: Array<{ id: string; title: string; summary: string | null }>
}

/**
 * Get recent general-market evidence for context injection. Competitor-tagged
 * sources are deliberately excluded here; they have a separate context layer.
 */
export async function getRecentEvidenceContext(
  topic: string,
  limit = 5,
  regionId?: string | null,
): Promise<RecentEvidenceContext> {
  type RecentRow = {
    id: string
    source_title: string | null
    source_summary: string | null
    source_language: string | null
    published_at: string | null
    source:
      | { source_category?: string | null; region_id?: string | null }
      | Array<{ source_category?: string | null; region_id?: string | null }>
      | null
  }

  const { data, error } = await getSupabaseAdmin()
    .from('evidence_items')
    .select('id, source_title, source_summary, source_language, published_at, source:source_id(source_category, region_id)')
    .order('discovered_at', { ascending: false })
    .limit(120)

  if (error || !data || data.length === 0) {
    return { text: '', ids: [], items: [] }
  }

  const rows = data as unknown as RecentRow[]

  const marketItems = rows.filter((item) => {
    const source = Array.isArray(item.source) ? item.source[0] : item.source

    if (regionId && source?.region_id && source.region_id !== regionId) {
      return false
    }

    return isMarketEvidenceEligible({
      sourceCategory: source?.source_category,
      title: item.source_title,
      summary: item.source_summary,
    })
  })

  const keywords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)

  const filtered = keywords.length > 0
    ? marketItems.filter((item) => {
        const text = `${item.source_title ?? ''} ${item.source_summary ?? ''}`.toLowerCase()
        return keywords.some((keyword) => text.includes(keyword))
      })
    : marketItems

  const selected = (filtered.length > 0 ? filtered : marketItems).slice(0, limit)

  return {
    text: selected
      .map((item) => `• ${item.source_title ?? ''}: ${(item.source_summary ?? '').slice(0, 200)}`)
      .join('\n'),
    ids: selected.map((item) => item.id),
    items: selected.map((item) => ({
      id: item.id,
      title: item.source_title ?? '',
      summary: item.source_summary ?? null,
    })),
  }
}

/** Backward-compatible text-only wrapper. */
export async function getRecentEvidenceItems(topic: string, limit = 5): Promise<string> {
  return (await getRecentEvidenceContext(topic, limit)).text
}
