import { getSupabaseAdmin } from '@/lib/supabase/client'
import type { ContentFormat } from '@/lib/content-formats'

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
}

const EMPTY: BrandSnapshotResult = { promptText: '', facts: [] }

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
 * Compiles the structured Brand OS tables (Sprint 4: audiences, pain
 * points, products, claims, vocabulary, content pillars, active
 * compliance rules, platform playbook) into one prompt layer, plus a
 * flat fact list for UI transparency.
 *
 * Falls back to brand_profiles' legacy free-text voice_description when
 * a brand has none of the structured data yet (an old/simple brand
 * profile that predates Sprint 4) -- this function replaces
 * buildBrandVoiceLayer's job entirely rather than sitting alongside it.
 */
export async function buildBrandSnapshot(
  brandId?: string | null,
  contentType?: ContentFormat,
): Promise<BrandSnapshotResult> {
  if (!brandId) return EMPTY

  const admin = getSupabaseAdmin()
  const platform = contentType ? FORMAT_TO_PLATFORM[contentType] : undefined

  const [profile, audiences, painPoints, products, claims, terms, pillars, activeRuleSet, playbook] = await Promise.all([
    admin.from('brand_profiles').select('brand_name, voice_description').eq('id', brandId).maybeSingle(),
    admin.from('brand_audiences').select('name, roles, pains, desired_outcomes').eq('brand_id', brandId).eq('active', true).limit(3),
    admin.from('brand_pain_points').select('canonical_name, description, business_consequences').eq('brand_id', brandId).eq('active', true).limit(4),
    admin.from('brand_products').select('name, description, product_role, approved_definition').eq('brand_id', brandId).eq('active', true).limit(6),
    admin.from('brand_claims').select('claim_text, claim_type, qualifier').eq('brand_id', brandId).eq('status', 'active').limit(15),
    admin.from('brand_terms').select('term, policy, replacement').eq('brand_id', brandId).in('policy', ['forbidden', 'preferred']).limit(20),
    admin.from('brand_content_pillars').select('name, purpose, risk_level').eq('brand_id', brandId).eq('active', true).order('sort_order').limit(6),
    admin.from('brand_rule_sets').select('id').eq('brand_id', brandId).eq('status', 'active').maybeSingle(),
    platform
      ? admin.from('platform_playbooks').select('strategy_json').eq('brand_id', brandId).eq('platform', platform).eq('status', 'active').maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const facts: BrandSnapshotFact[] = []
  const parts: string[] = []

  const brandName = profile.data?.brand_name
  if (brandName) parts.push(`<brand>${brandName}</brand>`)

  // Legacy voice description -- kept as a fallback layer even when
  // structured data exists, since it may still hold useful free-text
  // color (tone adjectives etc.) that has no structured equivalent yet.
  if (profile.data?.voice_description) {
    parts.push(`<brand_voice>${profile.data.voice_description}</brand_voice>`)
    facts.push({ category: 'voice', label: 'Голос бренда (описание)' })
  }

  if (audiences.data?.length) {
    const lines = audiences.data.map((a) => {
      const roles = a.roles?.length ? ` (${a.roles.join(', ')})` : ''
      const pains = a.pains?.length ? ` Боли: ${a.pains.slice(0, 3).join('; ')}.` : ''
      return `- ${a.name}${roles}.${pains}`
    })
    parts.push(`<target_audiences>\n${lines.join('\n')}\n</target_audiences>`)
    for (const a of audiences.data) facts.push({ category: 'audience', label: a.name })
  }

  if (painPoints.data?.length) {
    const lines = painPoints.data.map((p) => `- ${p.canonical_name}: ${p.description ?? ''}`)
    parts.push(`<audience_pain_points>\n${lines.join('\n')}\n</audience_pain_points>`)
    for (const p of painPoints.data) facts.push({ category: 'pain_point', label: p.canonical_name })
  }

  if (products.data?.length) {
    const lines = products.data.map((p) => `- ${p.name}${p.product_role ? ` [${p.product_role}]` : ''}: ${p.approved_definition ?? p.description ?? ''}`)
    parts.push(`<products>\n${lines.join('\n')}\n</products>`)
    for (const p of products.data) facts.push({ category: 'product', label: p.name })
  }

  if (claims.data?.length) {
    const approved = claims.data.filter((c) => c.claim_type === 'approved' || c.claim_type === 'qualified')
    const forbidden = claims.data.filter((c) => c.claim_type === 'forbidden')
    if (approved.length) {
      parts.push(`<approved_claims>\n${approved.map((c) => `- ${c.claim_text}${c.qualifier ? ` (${c.qualifier})` : ''}`).join('\n')}\n</approved_claims>`)
      for (const c of approved) facts.push({ category: 'claim', label: c.claim_text.slice(0, 60) })
    }
    if (forbidden.length) {
      parts.push(`<forbidden_claims>NEVER state these -- they are legally/factually prohibited for this brand:\n${forbidden.map((c) => `- ${c.claim_text}`).join('\n')}\n</forbidden_claims>`)
      for (const c of forbidden) facts.push({ category: 'claim', label: `⛔ ${c.claim_text.slice(0, 60)}` })
    }
  }

  if (terms.data?.length) {
    const forbidden = terms.data.filter((t) => t.policy === 'forbidden')
    const preferred = terms.data.filter((t) => t.policy === 'preferred')
    if (forbidden.length) {
      parts.push(`<forbidden_terms>Never use these words/phrases${forbidden.some((t) => t.replacement) ? ' (use the replacement when given)' : ''}:\n${forbidden.map((t) => `- "${t.term}"${t.replacement ? ` → use "${t.replacement}" instead` : ''}`).join('\n')}\n</forbidden_terms>`)
      for (const t of forbidden) facts.push({ category: 'term', label: `⛔ ${t.term}` })
    }
    if (preferred.length) {
      parts.push(`<preferred_terms>Prefer these terms when relevant: ${preferred.map((t) => `"${t.term}"`).join(', ')}</preferred_terms>`)
      for (const t of preferred) facts.push({ category: 'term', label: t.term })
    }
  }

  if (pillars.data?.length) {
    const lines = pillars.data.map((p) => `- ${p.name}: ${p.purpose ?? ''}`)
    parts.push(`<content_pillars>\n${lines.join('\n')}\n</content_pillars>`)
    for (const p of pillars.data) facts.push({ category: 'pillar', label: p.name })
  }

  if (activeRuleSet.data?.id) {
    const { data: rules } = await admin
      .from('brand_rules')
      .select('rule_class, enforcement, rule_key, operator, value_json')
      .eq('rule_set_id', activeRuleSet.data.id)
      .in('enforcement', ['hard_block', 'forbidden', 'required'])
      .limit(20)

    if (rules?.length) {
      const lines = rules.map((r) => `- [${r.enforcement}] ${r.rule_class}/${r.rule_key} ${r.operator} ${JSON.stringify(r.value_json)}`)
      parts.push(`<compliance_rules>These are hard constraints, not suggestions -- violating them is a compliance failure:\n${lines.join('\n')}\n</compliance_rules>`)
      for (const r of rules) facts.push({ category: 'rule', label: `${r.rule_class}: ${r.rule_key}` })
    }
  }

  if (playbook && 'data' in playbook && playbook.data?.strategy_json && Object.keys(playbook.data.strategy_json).length > 0) {
    parts.push(`<platform_playbook platform="${platform}">${JSON.stringify(playbook.data.strategy_json)}</platform_playbook>`)
    facts.push({ category: 'playbook', label: `Плейбук: ${platform}` })
  }

  return { promptText: parts.join('\n\n'), facts }
}
