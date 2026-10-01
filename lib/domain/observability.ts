// Shared shapes for the source/brand observability API responses
// (app/api/sources/observability, app/api/sources/competitor-mentions,
// app/api/brands/os-coverage) and their consuming components. Defined
// once here rather than redeclared per-consumer, per the convention
// already used for RssSource/BrandProfile/PromptTemplate.

export interface SourceObservability {
  freshness: { lastEvidenceAt: string | null; daysSinceLastEvidence: number | null }
  yield: { windowDays: number; evidenceCount: number }
  extraction: { fullTextCount: number; failedCount: number; successRate: number | null }
  duplication: { refetchRate: number | null; fingerprintDuplicateCount: number }
}

export interface RegionCoverage {
  regionId: string
  code: string
  name: string
  totalSources: number
  activeSources: number
  healthySources: number
  evidenceYield30d: number
}

export interface CompetitorMentionSource {
  id: string
  name: string
  mentionCount: number
  competitorsCovered: number
}
