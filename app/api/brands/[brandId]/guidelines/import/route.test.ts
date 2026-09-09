import { describe, it, expect } from 'vitest'
import { toRuleScope, validateGuidelineImportBody } from './route'

// Fable review, Phase 1B (docs/fable-review.md): confirmed critical bug --
// scope_json used to be written as `{ scope: rule.scope, target:
// rule.scopeTarget }`, a shape with ZERO fields in common with RuleScope
// (lib/brand-os/types.ts), which is what precedence.ts's scopeMatches()
// actually reads at generation time. Every rule ever published through
// this pipeline therefore scope-matched as fully global regardless of its
// intended platform/format/campaign scope. toRuleScope() is the fix:
// rule.scope names the SCOPE DIMENSION ('global' | 'platform' | 'format'
// | 'campaign'), and rule.scopeTarget is the VALUE within that dimension
// (e.g. 'linkedin' when scope === 'platform') -- so the correct RuleScope
// keys exactly one field, by dimension name, to the target value.
describe('toRuleScope', () => {
  it('maps a platform-scoped rule to RuleScope.platform, not a { scope, target } shape', () => {
    const result = toRuleScope({ scope: 'platform', scopeTarget: 'linkedin' })
    expect(result).toEqual({ platform: 'linkedin' })
    // Explicitly guard against regressing to the old shape.
    expect(result).not.toHaveProperty('scope')
    expect(result).not.toHaveProperty('target')
  })

  it('maps a format-scoped rule to RuleScope.format', () => {
    const result = toRuleScope({ scope: 'format', scopeTarget: 'email' })
    expect(result).toEqual({ format: 'email' })
  })

  it('maps a campaign-scoped rule to RuleScope.campaign', () => {
    const result = toRuleScope({ scope: 'campaign', scopeTarget: 'q4-launch' })
    expect(result).toEqual({ campaign: 'q4-launch' })
  })

  it('returns an all-fields-empty RuleScope for a global rule (matches everywhere, correctly)', () => {
    const result = toRuleScope({ scope: 'global', scopeTarget: undefined })
    expect(result).toEqual({})
  })

  it('returns an all-fields-empty RuleScope for global even if scopeTarget is (incorrectly) set', () => {
    // Defensive: 'global' should never carry a target, but if the
    // extractor ever produces one, global must still mean global --
    // it must not accidentally scope a rule the extractor intended to
    // be universal.
    const result = toRuleScope({ scope: 'global', scopeTarget: 'linkedin' })
    expect(result).toEqual({})
  })

  it('falls back to an empty (global) scope when scopeTarget is missing for a non-global dimension', () => {
    // A platform-scoped rule with no actual target value can't be
    // scoped to anything specific -- treat it as global rather than
    // producing a RuleScope with an undefined value under the key,
    // which scopeMatches() would need special-case handling for.
    const result = toRuleScope({ scope: 'platform', scopeTarget: undefined })
    expect(result).toEqual({})
  })
})


describe('validateGuidelineImportBody', () => {
  it('accepts the documented source types and pins locale to the brand region', () => {
    const result = validateGuidelineImportBody({
      sourceType: 'brand_book',
      sourceText: 'Brand rules',
      sourceUrl: 'https://example.com/brand-book',
      locale: 'pt-BR',
    }, 'pt-BR')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.locale).toBe('pt-BR')
  })

  it('rejects a locale that disagrees with the brand region', () => {
    const result = validateGuidelineImportBody({ sourceText: 'Brand rules', locale: 'de-DE' }, 'pt-BR')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/locale must match/i)
  })

  it('rejects invalid enum and URL values instead of casting them through', () => {
    const result = validateGuidelineImportBody({
      sourceText: 'Brand rules',
      sourceType: 'anything',
      sourceUrl: 'javascript:alert(1)',
    }, 'pt-BR')
    expect(result.ok).toBe(false)
  })
})
