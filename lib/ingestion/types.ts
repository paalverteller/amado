/**
 * Amado — Ingestion Layer Types
 * 
 * §2.2 from product spec: typed connector configuration.
 * Every ingestion call must receive a typed connector, not positional parameters.
 */

export type ConnectorType = 'rss' | 'atom' | 'html_index' | 'api' | 'manual'

export interface SourceConnector {
  id: string
  connectorType: ConnectorType
  endpoint: string
  parserConfig: Record<string, unknown>
  regionId: string | null
  languageCode: string | null
}

export interface SourceHealth {
  lastSuccessAt: string | null
  lastFailureAt: string | null
  consecutiveFailures: number
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  lastErrorMessage: string | null
  itemsYieldedLastRun: number
  avgResponseTimeMs: number | null
}

export interface IngestionRun {
  id: string
  sourceId: string
  startedAt: string
  finishedAt: string | null
  itemsDiscovered: number
  itemsSaved: number
  errors: string[]
  connectorType: ConnectorType
}

export interface EvidenceItem {
  id: string
  sourceId: string
  canonicalUrl: string
  sourceLanguage: string | null
  sourceTitle: string
  sourceSummary: string | null
  localizedTitle: string | null
  localizedSummary: string | null
  localizedLanguage: string | null
  author: string | null
  publishedAt: string | null
  discoveredAt: string
  entities: string[] | null
  topics: string[] | null
  contentFingerprint: string | null
  regionIds: string[] | null
  sourceAuthority: number | null
  hydrationStatus: 'snippet' | 'full_text' | 'failed'
}

/** Normalize source_type string to canonical ConnectorType */
export function normalizeConnectorType(raw: string | null | undefined): ConnectorType {
  if (!raw) return 'rss'
  const normalized = raw.toLowerCase().trim()
  
  // Map legacy/inconsistent names
  if (normalized === 'html' || normalized === 'html_site' || normalized === 'html_index') return 'html_index'
  if (normalized === 'atom' || normalized === 'atom_feed') return 'atom'
  if (normalized === 'api' || normalized === 'rest' || normalized === 'graphql') return 'api'
  if (normalized === 'manual' || normalized === 'user' || normalized === 'upload') return 'manual'
  if (normalized === 'rss' || normalized === 'rss_feed') return 'rss'
  
  // Default fallback
  return 'rss'
}

/** Build a SourceConnector from database row */
export function buildSourceConnector(row: {
  id: string
  source_type?: string | null
  type?: string | null
  url: string
  country?: string | null
  region_id?: string | null
  language_code?: string | null
  parser_config?: Record<string, unknown> | null
}): SourceConnector {
  return {
    id: row.id,
    connectorType: normalizeConnectorType(row.source_type ?? row.type),
    endpoint: row.url,
    parserConfig: row.parser_config ?? {},
    regionId: row.region_id ?? row.country ?? null,
    languageCode: row.language_code ?? null,
  }
}
