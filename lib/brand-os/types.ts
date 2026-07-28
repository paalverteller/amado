/**
 * Amado Sprint 2 — Brand Operating System Types
 * 
 * §6: Policy engine architecture
 * §8: Data model
 * §9: Content request and planning
 * §10: AI agent architecture
 * §11: Platform playbooks
 * §13: Editorial QA
 */

// ─── Rule System ────────────────────────────────────────────────────────────

export type BrandRuleClass =
  | 'safety'
  | 'legal'
  | 'factual'
  | 'brand_positioning'
  | 'language'
  | 'platform'
  | 'format'
  | 'campaign'
  | 'style'
  | 'optimization_hypothesis'
  | 'measurement'

export type EnforcementMode =
  | 'hard_block'
  | 'required'
  | 'forbidden'
  | 'warning'
  | 'preference'
  | 'scoring'
  | 'human_review'

export interface BrandRule {
  id: string
  ruleSetId: string
  ruleClass: BrandRuleClass
  enforcement: EnforcementMode
  ruleKey: string
  operator: string
  value: unknown
  scope: RuleScope
  priority: number
  sourceDocumentId?: string | null
  sourceAnchor?: string | null
  extractionConfidence?: number | null
  humanApproved: boolean
  validFrom?: string | null
  validUntil?: string | null
  supersededBy?: string | null
  createdAt: string
}

export interface RuleScope {
  workspace?: string | string[] | null
  brand?: string | string[] | null
  region?: string | string[] | null
  language?: string | string[] | null
  platform?: string | string[] | null
  format?: string | string[] | null
  pillar?: string | string[] | null
  product?: string | string[] | null
  campaign?: string | string[] | null
  objective?: string | string[] | null
  audience?: string | string[] | null
  risk?: string | string[] | null
}

export interface BrandRuleSet {
  id: string
  workspaceId: string
  brandId: string
  name: string
  version: string
  status: 'draft' | 'review' | 'active' | 'archived'
  parentVersionId?: string | null
  publishedAt?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Brand Strategy Entities ────────────────────────────────────────────────

export interface BrandProduct {
  id: string
  brandId: string
  name: string
  slug: string
  description?: string | null
  active: boolean
  regionId?: string | null
  approvedDefinition?: string | null
  productRole?: 'infrastructure' | 'hero' | 'support' | 'integration' | null
  deepLink?: string | null
  whatsappCtaLink?: string | null
}

export interface BrandCapability {
  id: string
  productId: string
  brandId: string
  capabilityName: string
  featureDescription?: string | null
  userBenefit?: string | null
  supportedPainIds?: string[] | null
  proofDocumentId?: string | null
  status: 'active' | 'inactive'
}

export interface BrandAudience {
  id: string
  brandId: string
  name: string
  roles?: string[] | null
  companyProfile?: string | null
  pains?: string[] | null
  desiredOutcomes?: string[] | null
  objections?: string[] | null
  technicalDetailLevel?: 'low' | 'medium' | 'high' | null
  regionId?: string | null
  locale: string
  active: boolean
}

export interface BrandPainPoint {
  id: string
  brandId: string
  canonicalName: string
  description?: string | null
  observableSymptoms?: string[] | null
  businessConsequences?: string[] | null
  relatedProductCapabilityIds?: string[] | null
  approvedBrazilianExamples?: string[] | null
  active: boolean
}

export interface BrandContentPillar {
  id: string
  brandId: string
  name: string
  purpose?: string | null
  audienceApplicability?: string[] | null
  productApplicability?: string[] | null
  defaultProductExplicitness?: 'none' | 'implicit' | 'late_light' | 'explicit_product' | null
  riskLevel?: 'low' | 'medium' | 'high' | null
  active: boolean
  sortOrder: number
}

// ─── Platform Playbooks ─────────────────────────────────────────────────────

export type Platform = 'instagram' | 'facebook' | 'linkedin' | 'x' | 'threads' | 'youtube' | 'tiktok' | 'whatsapp'

export interface PlatformPlaybook {
  id: string
  brandId: string
  platform: Platform
  locale: string
  version: string
  status: 'draft' | 'review' | 'active' | 'archived'
  strategy: Record<string, unknown>
  measurement: Record<string, unknown>
}

export interface FormatPlaybook {
  id: string
  platformPlaybookId: string
  format: string
  version: string
  outputSchemaKey: string
  requiredDeliverables: string[]
  constraints: Record<string, unknown>
  rubric: Record<string, unknown>
  active: boolean
}

export interface ApprovedExample {
  id: string
  brandId: string
  platform?: string | null
  format?: string | null
  contentPillarId?: string | null
  label: 'positive' | 'negative' | 'reference'
  textContent: string
  structuredContent?: Record<string, unknown> | null
  whyItWorks?: string | null
  sourceDocumentId?: string | null
  sourceAnchor?: string | null
  approved: boolean
  performanceSummary?: Record<string, unknown> | null
}

export interface CampaignProfile {
  id: string
  brandId: string
  name: string
  description?: string | null
  defaultObjective?: string | null
  ctaPolicy?: string | null
  productExplicitness?: 'none' | 'implicit' | 'late_light' | 'explicit_product' | null
  proofRequirement?: 'none' | 'preferred' | 'required' | null
  riskFlags?: string[] | null
  active: boolean
}

// ─── Guideline Compiler ─────────────────────────────────────────────────────

export type DocumentType =
  | 'brand_core'
  | 'platform_playbook'
  | 'format_playbook'
  | 'compliance'
  | 'product_facts'
  | 'approved_examples'
  | 'measurement'

export interface GuidelineImportRun {
  id: string
  brandId: string
  workspaceId: string
  sourceDocumentIds?: string[] | null
  documentType?: DocumentType | null
  model?: string | null
  promptVersion?: string | null
  status: 'processing' | 'completed' | 'failed' | 'review'
  extractionSummary?: Record<string, unknown> | null
  errorSummary?: string | null
  timingMs?: number | null
  costEstimate?: number | null
  createdAt: string
  completedAt?: string | null
}

export interface GuidelineRuleCandidate {
  id: string
  importRunId: string
  sourceDocumentId?: string | null
  sourceAnchor?: string | null
  rawText: string
  ruleClass: BrandRuleClass
  enforcement: EnforcementMode
  ruleKey: string
  operator: string
  value: unknown
  scope: RuleScope
  confidence?: number | null
  rationaleSummary?: string | null
  humanDecision?: 'approved' | 'rejected' | 'modified' | 'pending' | null
  humanNote?: string | null
}

export interface PolicyConflict {
  id: string
  importRunId?: string | null
  candidateAId?: string | null
  candidateBId?: string | null
  existingRuleId?: string | null
  conflictType: 'contradiction' | 'duplicate' | 'ambiguity' | 'scope_overlap' | 'precedence'
  severity: 'low' | 'medium' | 'high' | 'critical'
  explanation: string
  proposedResolution?: string | null
  humanDecision?: 'resolved' | 'ignored' | 'pending' | null
  resolutionNote?: string | null
}

export interface CompiledPolicySnapshot {
  id: string
  workspaceId: string
  brandId: string
  brandPolicyVersion: string
  regionId?: string | null
  locale: string
  platform?: string | null
  format?: string | null
  objective?: string | null
  campaignProfileId?: string | null
  hardRules: CompiledRule[]
  requiredDeliverables: string[]
  deterministicValidators: string[]
  softRubric: Array<{
    criterion: string
    weight: number
    description: string
  }>
  approvedExampleIds?: string[] | null
  knowledgeDocumentVersions?: string[] | null
  compiledAt: string
  policyHash: string
}

export interface CompiledRule {
  ruleId: string
  ruleClass: BrandRuleClass
  enforcement: EnforcementMode
  ruleKey: string
  operator: string
  value: unknown
  scope: RuleScope
  priority: number
  sourceAnchor?: string | null
}

// ─── Content Planning ───────────────────────────────────────────────────────

export type ProductExplicitness = 'none' | 'implicit' | 'late_light' | 'explicit_product'

export type ContentObjective =
  | 'reach'
  | 'saves'
  | 'shares'
  | 'replies'
  | 'dms'
  | 'whatsapp'
  | 'leads'
  | 'demo_requests'
  | 'registrations'
  | 'retention'
  | 'trust'

export interface ContentPlanningRequest {
  workspaceId: string
  brandId: string
  regionId: string
  locale: 'pt-BR'
  source:
    | { type: 'signal'; signalId: string; opportunityId?: string }
    | { type: 'manual'; topic: string; context?: string }
    | { type: 'asset'; assetId: string }
  platforms: Platform[]
  requestedFormats?: Record<string, string[]>
  objective: ContentObjective
  audienceId?: string | null
  productId?: string | null
  productCapabilityIds: string[]
  productExplicitness: ProductExplicitness
  campaignProfileId?: string | null
  proof: {
    type: 'none' | 'evidence' | 'case' | 'data' | 'screenshot' | 'product_fact'
    referenceIds: string[]
  }
  riskFlags: Array<'lgpd' | 'paid_partnership' | 'real_customer_data' | 'ai_image' | 'none'>
  toneAdjustment: 'default' | 'more_direct' | 'warmer' | 'more_provocative' | 'more_educational' | 'more_premium'
  userConstraints: string[]
}

export interface ContentPlan {
  strategicAngle: string
  whyNow: string
  targetReader: string
  businessPain: string
  contentPillarId: string
  coreConcept: string
  evidenceIds: string[]
  approvedClaimIds: string[]
  riskNotes: string[]
  platformPlans: PlatformPlan[]
}

export interface PlatformPlan {
  platform: Platform
  recommendedFormat: string
  recommendationReason: string
  objective: string
  hookMode: string
  structurePattern: string
  endingMode: string
  productPlacement: string
  requiredDeliverables: string[]
  measurementPlan: Record<string, unknown>
}

// ─── Content Packages ───────────────────────────────────────────────────────

export interface ContentPackage {
  id: string
  workspaceId: string
  brandId: string
  briefId?: string | null
  signalId?: string | null
  opportunityId?: string | null
  objective?: string | null
  status: 'draft' | 'planning' | 'generating' | 'review' | 'approved' | 'rejected' | 'published'
  policyVersion?: string | null
  policySnapshotId?: string | null
  ownerId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ContentAsset {
  id: string
  packageId?: string | null
  brandId: string
  platform: Platform
  format: string
  locale: string
  contentPillarId?: string | null
  hookType?: string | null
  structurePattern?: string | null
  endingType?: string | null
  productExplicitness?: ProductExplicitness | null
  policySnapshotId?: string | null
  generationRunId?: string | null
  structuredContent?: Record<string, unknown> | null
  renderedText?: string | null
  approvalStatus: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'needs_repair'
  qaScore?: number | null
  humanEditDistance?: number | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface ContentAssetRelation {
  id: string
  parentAssetId: string
  childAssetId: string
  relationType: 'first_comment' | 'link_reply' | 'banner_variant' | 'caption' | 'slide_copy' | 'visual_brief' | 'follow_up' | 'alt_text' | 'metadata'
  sortOrder: number
}

// ─── QA ─────────────────────────────────────────────────────────────────────

export interface QaFinding {
  id: string
  evaluationRunId: string
  assetId: string
  ruleId?: string | null
  category: 'schema' | 'platform' | 'language' | 'claims' | 'product_truth' | 'privacy' | 'compliance' | 'brand_voice' | 'localization' | 'platform_fit' | 'pattern_fatigue' | 'duplicate'
  severity: 'info' | 'warning' | 'error' | 'blocker'
  location?: { field?: string; start?: number; end?: number } | null
  message: string
  suggestedFix?: string | null
  autoRepairable: boolean
  status: 'open' | 'repaired' | 'ignored' | 'confirmed'
}

export interface ClaimSpan {
  id: string
  assetId: string
  startPosition: number
  endPosition: number
  claimText: string
  claimType: 'factual' | 'product' | 'opinion' | 'hypothetical' | 'unsupported'
  evidenceIds?: string[] | null
  approvedClaimIds?: string[] | null
  qualifier?: string | null
  status: 'verified' | 'unverified' | 'blocked' | 'qualified'
}

export interface RepairRun {
  id: string
  assetId: string
  findingIds: string[]
  inputSnapshot: Record<string, unknown>
  outputSnapshot: Record<string, unknown>
  changedFields: string[]
  repairPromptVersion?: string | null
  model?: string | null
  latencyMs?: number | null
  success: boolean
  errorMessage?: string | null
}

// ─── Learning ───────────────────────────────────────────────────────────────

export interface PerformanceSnapshot {
  id: string
  assetId: string
  platform: Platform
  horizon: '3h' | '24h' | '72h' | '7d' | 'manual'
  reach?: number | null
  impressions?: number | null
  followers?: number | null
  nonFollowerReach?: number | null
  saves?: number | null
  shares?: number | null
  replies?: number | null
  comments?: number | null
  likes?: number | null
  watchTimeSeconds?: number | null
  retentionRate?: number | null
  rewatches?: number | null
  profileVisits?: number | null
  dms?: number | null
  whatsappStarts?: number | null
  linkClicks?: number | null
  qualitativeNotes?: string | null
  source?: 'manual' | 'api' | 'csv_import' | null
  recordedBy?: string | null
  recordedAt: string
}

export interface ContentPatternUsage {
  id: string
  assetId: string
  brandId: string
  platform: Platform
  hookType?: string | null
  openingSyntax?: string | null
  contentFormula?: string | null
  structurePattern?: string | null
  endingType?: string | null
  ctaType?: string | null
  productMentionPosition?: string | null
  namedCharacterUsed?: boolean | null
  brazilianDetailUsed?: string | null
  bannerType?: string | null
  visualDirectionType?: string | null
}

export interface PreferenceProfile {
  id: string
  brandId: string
  profileType: 'hook' | 'structure' | 'ending' | 'cta' | 'visual' | 'tone'
  patternKey: string
  patternValue: string
  confidence: number
  evidenceCount: number
  lastUsedAt?: string | null
  active: boolean
}
