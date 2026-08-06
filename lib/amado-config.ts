/**
 * Amado — Product Configuration & Feature Flags
 * 
 * Central place for product constants, feature flags, and environment-based toggles.
 * All new code should read from here, not hard-code values.
 */

export const PRODUCT_NAME = 'Amado'
export const PRODUCT_TAGLINE = 'AI-first Content Intelligence & Production'
export const PRODUCT_VERSION = '1.0.0-stage0'

// ─── Default Market Configuration ───────────────────────────────────────────
export const DEFAULT_REGION_CODE = 'BR'
export const DEFAULT_LOCALE = 'pt-BR'
export const DEFAULT_CURRENCY = 'BRL'
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'
export const DEFAULT_OUTPUT_LANGUAGE = 'pt-BR'

// ─── Feature Flags ──────────────────────────────────────────────────────────
export const FEATURE_FLAGS = {
  // Signal engine (Stage 3+)
  signalsEnabled: envBool('AMADO_SIGNALS_ENABLED', false),
  
  // Brand opportunity scoring (Stage 4+)
  opportunitiesEnabled: envBool('AMADO_OPPORTUNITIES_ENABLED', false),
  
  // Hybrid knowledge search with embeddings (Stage 5+)
  hybridSearchEnabled: envBool('AMADO_HYBRID_SEARCH_ENABLED', false),
  
  // Editorial QA with structured rubric (Stage 5+)
  editorialQaEnabled: envBool('AMADO_EDITORIAL_QA_ENABLED', true),
  
  // Multi-region support (Stage 1 foundation, full in Stage 6)
  multiRegionEnabled: envBool('AMADO_MULTI_REGION_ENABLED', false),
  
  // Workspace auth and RLS (Stage 6+)
  workspaceAuthEnabled: envBool('AMADO_WORKSPACE_AUTH_ENABLED', false),
  
  // Auto-publishing (explicitly disabled until later stages)
  autoPublishEnabled: envBool('AMADO_AUTO_PUBLISH_ENABLED', false),
  
  // PubMed ingestion (retired — kept as flag for graceful degradation)
  pubMedEnabled: envBool('AMADO_PUBMED_ENABLED', false),
  
  // Russian translation gate (retired — items no longer require ru translation)
  russianTranslationGate: envBool('AMADO_RU_GATE_ENABLED', false),
} as const

// ─── Ingestion Configuration ────────────────────────────────────────────────
export const INGESTION_CONFIG = {
  // Tier 1: lightweight discovery
  discoveryIntervalMinutes: envNumber('AMADO_DISCOVERY_INTERVAL_MIN', 180), // 3h
  
  // Tier 2: evidence hydration -- fetches full article text via
  // lib/web-reader.ts (Firecrawl/Jina) for every item on every active
  // source, every cron run. Only spends real API calls once
  // FIRECRAWL_API_KEY or JINA_READER_MODE is actually configured -- until
  // then this is a safe no-op regardless of the flag below. Emergency
  // kill switch: set AMADO_HYDRATION_ENABLED=false, no redeploy needed.
  hydrationEnabled: envBool('AMADO_HYDRATION_ENABLED', true),

  // Hard ceiling on hydration calls in a single cron/collect run, across
  // ALL sources combined -- protects against cost blowup and function
  // timeout if the active-source count grows. Once hit, remaining items
  // in that run save as hydration_status='snippet', same as if hydration
  // were off; nothing fails.
  maxHydrationPerRun: envNumber('AMADO_MAX_HYDRATION_PER_RUN', 40),
  
  // Max items per source per fetch
  maxItemsPerSource: envNumber('AMADO_MAX_ITEMS_PER_SOURCE', 6),
  
  // Max description length for discovery snippets
  maxSnippetChars: envNumber('AMADO_MAX_SNIPPET_CHARS', 300),
  
  // Source health thresholds
  maxConsecutiveFailures: envNumber('AMADO_MAX_SOURCE_FAILURES', 5),
  sourceTimeoutMs: envNumber('AMADO_SOURCE_TIMEOUT_MS', 15000),
} as const

// ─── Generation Configuration ───────────────────────────────────────────────
export const GENERATION_CONFIG = {
  // Default max tokens by format category
  shortFormatMaxTokens: 600,
  standardFormatMaxTokens: 2000,
  longFormatMaxTokens: 4000,
  
  // Batch limits
  maxBatchSize: envNumber('AMADO_MAX_BATCH_SIZE', 10),
  
  // Cost controls
  maxRepairLoops: envNumber('AMADO_MAX_REPAIR_LOOPS', 2),
} as const

// ─── Cron Configuration ─────────────────────────────────────────────────────
export const CRON_CONFIG = {
  // All cron endpoints require CRON_SECRET in production
  requireSecretInProduction: true,
  
  // Throttle intervals (hours)
  marketRefreshThrottleHours: envNumber('AMADO_MARKET_REFRESH_HOURS', 6),
  autoGenerateThrottleHours: envNumber('AMADO_AUTO_GENERATE_HOURS', 56),
} as const

// ─── Helpers ────────────────────────────────────────────────────────────────

function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key]
  if (val === undefined) return defaultValue
  return val === '1' || val === 'true' || val === 'yes'
}

function envNumber(key: string, defaultValue: number): number {
  const val = process.env[key]
  if (val === undefined) return defaultValue
  const n = Number(val)
  return Number.isFinite(n) ? n : defaultValue
}

export type FeatureFlag = keyof typeof FEATURE_FLAGS

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}