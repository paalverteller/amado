/**
 * Amado Sprint 2 — Policy Precedence Engine
 * 
 * §6.5: Precedence order for rule conflict resolution
 * 
 * Layer order (highest precedence first):
 * 1. safety and legal hard rules
 * 2. verified product facts and prohibited claims
 * 3. workspace hard policy
 * 4. brand hard policy
 * 5. campaign-specific hard policy
 * 6. region and language policy
 * 7. platform policy
 * 8. format policy
 * 9. objective and audience policy
 * 10. explicit user request
 * 11. soft brand preferences
 * 12. example similarity
 * 13. performance-learned ranking
 */

import type { BrandRule, BrandRuleClass, EnforcementMode, RuleScope } from './types'

// Precedence layer for each rule class
const RULE_CLASS_LAYER: Record<BrandRuleClass, number> = {
  safety: 1,
  legal: 1,
  factual: 2,
  brand_positioning: 4,
  language: 6,
  platform: 7,
  format: 8,
  campaign: 5,
  style: 11,
  optimization_hypothesis: 13,
  measurement: 13,
}

// Hard enforcement modes get priority boost
const ENFORCEMENT_PRIORITY: Record<EnforcementMode, number> = {
  hard_block: 0,
  required: 1,
  forbidden: 1,
  warning: 2,
  preference: 3,
  scoring: 4,
  human_review: 2,
}

export interface CompileContext {
  workspaceId?: string
  brandId: string
  regionId?: string
  locale?: string
  platform?: string
  format?: string
  objective?: string
  campaignProfileId?: string
  audienceId?: string
  productId?: string
  contentPillarId?: string
  riskFlags?: string[]
}

/**
 * Check if a rule scope matches the compile context.
 * Null/undefined scope fields mean "applies everywhere".
 */
export function scopeMatches(ruleScope: RuleScope, context: CompileContext): boolean {
  const checks: Array<[string | string[] | null | undefined, string | undefined]> = [
    [ruleScope.workspace, context.workspaceId],
    [ruleScope.brand, context.brandId],
    [ruleScope.region, context.regionId],
    [ruleScope.language, context.locale],
    [ruleScope.platform, context.platform],
    [ruleScope.format, context.format],
    [ruleScope.pillar, context.contentPillarId],
    [ruleScope.product, context.productId],
    [ruleScope.campaign, context.campaignProfileId],
    [ruleScope.objective, context.objective],
    [ruleScope.audience, context.audienceId],
  ]

  for (const [scopeValue, contextValue] of checks) {
    if (scopeValue === null || scopeValue === undefined) continue
    if (contextValue === undefined) return false
    
    const scopeArray = Array.isArray(scopeValue) ? scopeValue : [scopeValue]
    if (!scopeArray.includes(contextValue)) return false
  }

  // Risk scope: if rule specifies risks, at least one must match
  if (ruleScope.risk !== null && ruleScope.risk !== undefined) {
    const ruleRisks = Array.isArray(ruleScope.risk) ? ruleScope.risk : [ruleScope.risk]
    const contextRisks = context.riskFlags ?? []
    if (!ruleRisks.some(r => contextRisks.includes(r))) return false
  }

  return true
}

/**
 * Sort rules by precedence for compilation.
 * Lower number = higher precedence (applied first).
 */
export function sortByPrecedence(rules: BrandRule[], context: CompileContext): BrandRule[] {
  return [...rules].sort((a, b) => {
    // Layer precedence
    const layerA = RULE_CLASS_LAYER[a.ruleClass] ?? 99
    const layerB = RULE_CLASS_LAYER[b.ruleClass] ?? 99
    if (layerA !== layerB) return layerA - layerB

    // Enforcement priority within layer
    const enforcementA = ENFORCEMENT_PRIORITY[a.enforcement] ?? 99
    const enforcementB = ENFORCEMENT_PRIORITY[b.enforcement] ?? 99
    if (enforcementA !== enforcementB) return enforcementA - enforcementB

    // Explicit priority field
    if (a.priority !== b.priority) return a.priority - b.priority

    // Human-approved rules win over extracted
    if (a.humanApproved !== b.humanApproved) {
      return a.humanApproved ? -1 : 1
    }

    // Newer rules win
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

/**
 * Compile active rules for a context, resolving conflicts by precedence.
 */
export function compileRules(rules: BrandRule[], context: CompileContext): BrandRule[] {
  // Filter by scope
  const scoped = rules.filter(r => scopeMatches(r.scope, context))
  
  // Sort by precedence
  const sorted = sortByPrecedence(scoped, context)
  
  // Deduplicate by ruleKey: higher precedence wins
  const seen = new Map<string, BrandRule>()
  for (const rule of sorted) {
    if (!seen.has(rule.ruleKey)) {
      seen.set(rule.ruleKey, rule)
    }
  }
  
  return Array.from(seen.values())
}

/**
 * Detect conflicts between rules.
 */
export interface RuleConflict {
  ruleA: BrandRule
  ruleB: BrandRule
  type: 'contradiction' | 'duplicate' | 'ambiguity' | 'scope_overlap'
  severity: 'low' | 'medium' | 'high' | 'critical'
  explanation: string
}

export function detectConflicts(rules: BrandRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = []
  
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]
      const b = rules[j]
      
      // Same key, different values = contradiction
      if (a.ruleKey === b.ruleKey && JSON.stringify(a.value) !== JSON.stringify(b.value)) {
        conflicts.push({
          ruleA: a,
          ruleB: b,
          type: 'contradiction',
          severity: a.enforcement === 'hard_block' || b.enforcement === 'hard_block' ? 'critical' : 'high',
          explanation: `Rule "${a.ruleKey}" has conflicting values: ${JSON.stringify(a.value)} vs ${JSON.stringify(b.value)}`,
        })
      }
      
      // Same key, same value, overlapping scope = duplicate
      if (a.ruleKey === b.ruleKey && JSON.stringify(a.value) === JSON.stringify(b.value)) {
        const scopeOverlap = checkScopeOverlap(a.scope, b.scope)
        if (scopeOverlap) {
          conflicts.push({
            ruleA: a,
            ruleB: b,
            type: 'duplicate',
            severity: 'low',
            explanation: `Duplicate rule "${a.ruleKey}" with overlapping scope`,
          })
        }
      }
    }
  }
  
  return conflicts
}

function checkScopeOverlap(a: RuleScope, b: RuleScope): boolean {
  // Simple check: if both have same non-null platform/format, they overlap
  const keys: (keyof RuleScope)[] = ['platform', 'format', 'region', 'language']
  for (const key of keys) {
    const aVal = a[key]
    const bVal = b[key]
    if (aVal && bVal) {
      const aArr = Array.isArray(aVal) ? aVal : [aVal]
      const bArr = Array.isArray(bVal) ? bVal : [bVal]
      if (aArr.some(v => bArr.includes(v))) return true
    }
  }
  return false
}
