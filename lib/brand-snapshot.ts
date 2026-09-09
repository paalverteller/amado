import { getSupabaseAdmin } from '@/lib/supabase/client'
import type { ContentFormat } from '@/lib/content-formats'
import { compileRules, type CompileContext } from '@/lib/brand-os/precedence'
import type { BrandRule } from '@/lib/brand-os/types'
import { promptBlock } from '@/lib/prompt-safety'

// content format -> platform_playbooks.platform, where a mapping exists.
// Formats with no real platform (article, email, quick_note, rewrite) are
// left unmapped -- no platform playbook applies to them.
const FORMAT_TO_PLATFORM: Partial<Record<ContentFormat, string>> = {
  linkedin_post: 'linkedin',
  instagram_caption: 'instagram',
  instagram_carousel: 'instagram',
  x_thread: 'x',
  facebook_post: 'facebook',
  telegram_post: 'whatsapp', // closest existing platform_playbooks value to a messaging-app format
  short_video_script: 'youtube',
}

// Safety ceilings on hard-constraint queries (forbidden claims/terms, hard
// compliance rules). These are NOT meant to be hit in practice -- unlike
// the old .limit(15)/.limit(20) values, they exist only so a single brand
// can never send an unbounded query, not to cap what a real brand book
// needs. If a brand ever has more rows than this, buildBrandSnapshot logs
// it via `degraded` instead of silently dropping rows past the cap.
const HARD_CONSTRAINT_SAFETY_LIMIT = 200

export interface BrandSnapshotFact {
  /** Which layer this fact came from -- shown in the "what was used" UI. */
  category: 'voice' | 'audience' | 'pain_point' | 'product' | 'claim' | 'term' | 'pillar' | 'rule' | 'playbook'
  label: string
}

export interface BrandSnapshotResult {
  /** Prompt-ready XML-tagged text block, same convention as buildRegionContextLayer etc. */
  promptText: string
  /** What actually went into promptText, for the "visible selected context" UI. */
  facts: BrandSnapshotFact[]
  /**
   * Human-readable descriptions of any query that failed or was silently
   * truncated while building this snapshot. Empty when everything behaved.
   * Callers (generation, "visible context" UI) should treat a non-empty
   * `degraded` as "brand context may be incomplete -- forbidden claims,
   * terms, or compliance rules might be missing from this generation",
   * not as a hard failure: generation still proceeds, but the gap is now
   * visible instead of looking like an intentional empty fact list.
   */
  degraded: string[]
}

const EMPTY: BrandSnapshotResult = { promptText: '', facts: [], degraded: [] }

/** Resolve the active/default brand when a caller does not choose one explicitly. */
export async function resolveDefaultBrandProfileId(requested?: string | null): Promise<string | null> {
  if (requested) return requested
  const { data, error } = await getSupabaseAdmin()
    .from('brand_profiles')
    .select('id')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[brand-snapshot] default brand lookup failed:', error.message)
    return null
  }
  return data?.id ?? null
}

/**
 * Sprint 12 Phase 4: resolve a brand's region_id, so generation can derive
 * "which market is this content for" from the brand the caller already
 * chose instead of requiring a second, independently-tracked regionId that
 * could drift out of sync with it. Returns null for a brand with no region
 * set (pre-Sprint-12 brands, or a brand deliberately left region-agnostic)
 * -- callers should fall back to their own default in that case, exactly
 * like resolveDefaultBrandProfileId's `requested` param falls through.
 *
 * Fable review, Phase 2 (region-failure-!=-absence): this function used to
 * return null for three different situations -- brand not found, brand has
 * no region, and a genuine DB error -- and every caller collapsed all three
 * into "no region, use the default market". A transient DB error is not
 * the same thing as a brand that deliberately has no region, and treating
 * it like one silently produces Brazil-market content for a brand in any
 * other market. Now: a real query error throws (callers already have a
 * top-level try/catch that turns this into a loud 500, per
 * generateAndPersistArticle's callers); null is returned only when the
 * brand genuinely has no region_id set (or no brandId was given at all).
 */
export async function resolveBrandRegionId(brandId?: string | null): Promise<string | null> {
  if (!brandId) return null
  const { data, error } = await getSupabaseAdmin()
    .from('brand_profiles')
    .select('region_id')
    .eq('id', brandId)
    .maybeSingle()
  if (error) {
    throw new Error(`[brand-snapshot] brand region lookup failed for brand ${brandId}: ${error.message}`)
  }
  return data?.region_id ?? null
}

/**
 * Compiles the structured Brand OS tables (Sprint 4: audiences, pain
 * points, products, claims, vocabulary, content pillars, active
 * compliance rules, platform playbook) into one prompt layer, plus a
 * flat fact list for UI transparency.
 *
 * Falls back to brand_profiles' legacy free-text voice_description when
 * a brand has none of the structured data yet (an old/simple brand
 * profile that predates Sprint 4) -- this function replaces
 * buildBrandVoiceLayer's job entirely rather than sitting alongside it.
 *
 * Fable review, Phase 1 (Brand OS integrity): every query here used to
 * discard its `error` and read only `.data`, so an RLS issue, a missing
 * column, or a table absent from the manually-consolidated prod baseline
 * silently produced an empty (not degraded-looking) fact list -- the
 * model would then be free to make claims that are supposed to be
 * forbidden. Every query below now checks `error` and records a
 * human-readable note in the returned `degraded` array instead of
 * failing generation outright (a brand-context outage should not take
 * generation down entirely, but it must not look identical to "this
 * brand simply has no forbidden claims" either).
 */
export async function buildBrandSnapshot(
  brandId?: string | null,
  contentType?: ContentFormat,
  compileContext?: Omit<CompileContext, 'brandId'>,
): Promise<BrandSnapshotResult> {
  if (!brandId) return EMPTY

  const admin = getSupabaseAdmin()
  const platform = contentType ? FORMAT_TO_PLATFORM[contentType] : undefined
  const degraded: string[] = []

  const [profile, audiences, painPoints, products, claims, terms, pillars, activeRuleSet, playbook] = await Promise.all([
    admin.from('brand_profiles').select('brand_name, voice_description').eq('id', brandId).maybeSingle(),
    admin.from('brand_audiences').select('name, roles, pains, desired_outcomes').eq('brand_id', brandId).eq('active', true).limit(3),
    admin.from('brand_pain_points').select('canonical_name, description, business_consequences').eq('brand_id', brandId).eq('active', true).limit(4),
    admin.from('brand_products').select('name, description, product_role, approved_definition').eq('brand_id', brandId).eq('active', true).limit(6),
    admin.from('brand_claims').select('claim_text, claim_type, qualifier').eq('brand_id', brandId).eq('status', 'active').order('created_at', { ascending: true }).limit(HARD_CONSTRAINT_SAFETY_LIMIT),
    admin.from('brand_terms').select('term, policy, replacement').eq('brand_id', brandId).in('policy', ['forbidden', 'preferred']).order('created_at', { ascending: true }).limit(HARD_CONSTRAINT_SAFETY_LIMIT),
    admin.from('brand_content_pillars').select('name, purpose, risk_level').eq('brand_id', brandId).eq('active', true).order('sort_order').limit(6),
    admin.from('brand_rule_sets').select('id').eq('brand_id', brandId).eq('status', 'active').order('published_at', { ascending: false }).limit(1).maybeSingle(),
    platform
      ? admin.from('platform_playbooks').select('strategy_json').eq('brand_id', brandId).eq('platform', platform).eq('status', 'active').maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (profile.error) degraded.push(`brand_profiles: ${profile.error.message}`)
  if (audiences.error) degraded.push(`brand_audiences: ${audiences.error.message}`)
  if (painPoints.error) degraded.push(`brand_pain_points: ${painPoints.error.message}`)
  if (products.error) degraded.push(`brand_products: ${products.error.message}`)
  if (claims.error) degraded.push(`brand_claims (forbidden/approved claims): ${claims.error.message}`)
  if (terms.error) degraded.push(`brand_terms (forbidden/preferred terms): ${terms.error.message}`)
  if (pillars.error) degraded.push(`brand_content_pillars: ${pillars.error.message}`)
  if (activeRuleSet.error) degraded.push(`brand_rule_sets (active compliance rule set): ${activeRuleSet.error.message}`)
  if (playbook && 'error' in playbook && playbook.error) degraded.push(`platform_playbooks: ${(playbook.error as { message: string }).message}`)

  if (degraded.length) {
    console.error('[brand-snapshot] buildBrandSnapshot degraded for brand', brandId, ':', degraded)
  }

  const facts: BrandSnapshotFact[] = []
  const parts: string[] = []

  const brandName = profile.data?.brand_name
  if (brandName) parts.push(promptBlock('brand', brandName, { maxChars: 300 }))

  // Legacy voice description -- kept as a fallback layer even when
  // structured data exists, since it may still hold useful free-text
  // color (tone adjectives etc.) that has no structured equivalent yet.
  if (profile.data?.voice_description) {
    parts.push(promptBlock('brand_voice', profile.data.voice_description, { maxChars: 4_000, mode: 'policy' }))
    facts.push({ category: 'voice', label: 'Голос бренда (описание)' })
  }

  if (audiences.data?.length) {
    const lines = audiences.data.map((a) => {
      const roles = a.roles?.length ? ` (${a.roles.join(', ')})` : ''
      const pains = a.pains?.length ? ` Боли: ${a.pains.slice(0, 3).join('; ')}.` : ''
      return `- ${a.name}${roles}.${pains}`
    })
    parts.push(promptBlock('target_audiences', lines.join('\n'), { maxChars: 8_000 }))
    for (const a of audiences.data) facts.push({ category: 'audience', label: a.name })
  }

  if (painPoints.data?.length) {
    const lines = painPoints.data.map((p) => `- ${p.canonical_name}: ${p.description ?? ''}`)
    parts.push(promptBlock('audience_pain_points', lines.join('\n'), { maxChars: 8_000 }))
    for (const p of painPoints.data) facts.push({ category: 'pain_point', label: p.canonical_name })
  }

  if (products.data?.length) {
    const lines = products.data.map((p) => `- ${p.name}${p.product_role ? ` [${p.product_role}]` : ''}: ${p.approved_definition ?? p.description ?? ''}`)
    parts.push(promptBlock('products', lines.join('\n'), { maxChars: 10_000 }))
    for (const p of products.data) facts.push({ category: 'product', label: p.name })
  }

  if (claims.data?.length) {
    if (claims.data.length >= HARD_CONSTRAINT_SAFETY_LIMIT) {
      degraded.push(`brand_claims: hit the ${HARD_CONSTRAINT_SAFETY_LIMIT}-row safety cap -- some claims (possibly forbidden ones) may be missing from this generation`)
      console.error('[brand-snapshot] brand_claims safety cap hit for brand', brandId)
    }
    const approved = claims.data.filter((c) => c.claim_type === 'approved' || c.claim_type === 'qualified')
    const forbidden = claims.data.filter((c) => c.claim_type === 'forbidden')
    if (approved.length) {
      parts.push(promptBlock('approved_claims', approved.map((c) => `- ${c.claim_text}${c.qualifier ? ` (${c.qualifier})` : ''}`).join('\n'), { maxChars: 12_000, mode: 'policy' }))
      for (const c of approved) facts.push({ category: 'claim', label: c.claim_text.slice(0, 60) })
    }
    if (forbidden.length) {
      parts.push(promptBlock('forbidden_claims', `NEVER state these -- they are legally/factually prohibited for this brand:\n${forbidden.map((c) => `- ${c.claim_text}`).join('\n')}`, { maxChars: 12_000, mode: 'policy' }))
      for (const c of forbidden) facts.push({ category: 'claim', label: `⛔ ${c.claim_text.slice(0, 60)}` })
    }
  }

  if (terms.data?.length) {
    if (terms.data.length >= HARD_CONSTRAINT_SAFETY_LIMIT) {
      degraded.push(`brand_terms: hit the ${HARD_CONSTRAINT_SAFETY_LIMIT}-row safety cap -- some terms (possibly forbidden ones) may be missing from this generation`)
      console.error('[brand-snapshot] brand_terms safety cap hit for brand', brandId)
    }
    const forbidden = terms.data.filter((t) => t.policy === 'forbidden')
    const preferred = terms.data.filter((t) => t.policy === 'preferred')
    if (forbidden.length) {
      parts.push(promptBlock('forbidden_terms', `Never use these words/phrases${forbidden.some((t) => t.replacement) ? ' (use the replacement when given)' : ''}:\n${forbidden.map((t) => `- "${t.term}"${t.replacement ? ` → use "${t.replacement}" instead` : ''}`).join('\n')}`, { maxChars: 12_000, mode: 'policy' }))
      for (const t of forbidden) facts.push({ category: 'term', label: `⛔ ${t.term}` })
    }
    if (preferred.length) {
      parts.push(promptBlock('preferred_terms', `Prefer these terms when relevant: ${preferred.map((t) => `"${t.term}"`).join(', ')}`, { maxChars: 8_000, mode: 'policy' }))
      for (const t of preferred) facts.push({ category: 'term', label: t.term })
    }
  }

  if (pillars.data?.length) {
    const lines = pillars.data.map((p) => `- ${p.name}: ${p.purpose ?? ''}`)
    parts.push(promptBlock('content_pillars', lines.join('\n'), { maxChars: 8_000 }))
    for (const p of pillars.data) facts.push({ category: 'pillar', label: p.name })
  }

  if (activeRuleSet.data?.id) {
    const { data: rawRules, error: rulesError } = await admin
      .from('brand_rules')
      .select('id, rule_set_id, rule_class, enforcement, rule_key, operator, value_json, scope_json, priority, source_document_id, source_anchor, extraction_confidence, human_approved, created_at')
      .eq('rule_set_id', activeRuleSet.data.id)
      .in('enforcement', ['hard_block', 'forbidden', 'required'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(HARD_CONSTRAINT_SAFETY_LIMIT)

    if (rulesError) {
      degraded.push(`brand_rules (compliance rules): ${rulesError.message}`)
      console.error('[brand-snapshot] brand_rules query failed for brand', brandId, ':', rulesError.message)
    } else if (rawRules?.length) {
      if (rawRules.length >= HARD_CONSTRAINT_SAFETY_LIMIT) {
        degraded.push(`brand_rules: hit the ${HARD_CONSTRAINT_SAFETY_LIMIT}-row safety cap -- some hard compliance rules may be missing from this generation`)
        console.error('[brand-snapshot] brand_rules safety cap hit for brand', brandId)
      }

      // Fable review, Phase 1: this used to read brand_rules raw with no
      // scope filtering at all -- a LinkedIn-only hard_block would be
      // injected into an email generation, or vice versa. Route through
      // the actual precedence engine (scopeMatches + compileRules) so
      // only rules whose scope matches this request's context survive,
      // and duplicate rule_keys are resolved by real precedence instead
      // of "whichever DB row happened to come back first".
      const brandRules: BrandRule[] = rawRules.map((r) => ({
        id: r.id,
        ruleSetId: r.rule_set_id,
        ruleClass: r.rule_class,
        enforcement: r.enforcement,
        ruleKey: r.rule_key,
        operator: r.operator,
        value: r.value_json,
        scope: r.scope_json ?? {},
        priority: r.priority,
        sourceDocumentId: r.source_document_id,
        sourceAnchor: r.source_anchor,
        extractionConfidence: r.extraction_confidence,
        humanApproved: r.human_approved,
        createdAt: r.created_at,
      }))

      const context: CompileContext = {
        brandId,
        platform,
        format: contentType,
        ...compileContext,
      }
      const compiled = compileRules(brandRules, context)

      if (compiled.length) {
        const lines = compiled.map((r) => `- [${r.enforcement}] ${r.ruleClass}/${r.ruleKey} ${r.operator} ${JSON.stringify(r.value)}`)
        parts.push(promptBlock('compliance_rules', `These are hard constraints, not suggestions -- violating them is a compliance failure:\n${lines.join('\n')}`, { maxChars: 20_000, mode: 'policy' }))
        for (const r of compiled) facts.push({ category: 'rule', label: `${r.ruleClass}: ${r.ruleKey}` })
      }
    }
  }

  if (playbook && 'data' in playbook && playbook.data?.strategy_json && Object.keys(playbook.data.strategy_json).length > 0) {
    parts.push(promptBlock('platform_playbook', JSON.stringify({ platform, strategy: playbook.data.strategy_json }), { maxChars: 12_000, mode: 'policy' }))
    facts.push({ category: 'playbook', label: `Плейбук: ${platform}` })
  }

  return { promptText: parts.join('\n\n'), facts, degraded }
}
