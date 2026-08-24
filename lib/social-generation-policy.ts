import { getSupabaseAdmin } from '@/lib/supabase/client'
import type { ContentFormat } from '@/lib/content-formats'

const FORMAT_TO_PLATFORM: Partial<Record<ContentFormat, string>> = {
  linkedin_post: 'linkedin',
  instagram_caption: 'instagram',
  instagram_carousel: 'instagram',
  x_thread: 'x',
  threads_post: 'threads',
  facebook_post: 'facebook',
}

export function isSocialContentFormat(format: ContentFormat): boolean {
  return Boolean(FORMAT_TO_PLATFORM[format])
}

function permanentContract(): string {
  return `<social_execution_contract>
These rules apply to every social-media generation:
- Truth > speed. Never invent current facts, numbers, customers, quotes, benchmarks, product capabilities or attribution.
- Business > vanity. Do not optimize for raw likes or engagement bait. Optimize for useful attention and qualified business actions.
- Native > cross-post. Adapt the idea to the selected platform instead of copying another platform's version.
- Original > recycled. Prefer evidence, proprietary observations, concrete examples and a real point of view.
- Conversation > broadcast. Invite discussion only when a substantive answer is useful.
- Evidence > AI prose. Quantified claims require evidence already supplied in context.
- Mandatory human review: new statistics or benchmarks; customer names/logos/quotes/results; security/privacy claims; pricing/SLA/legal/financial claims; politics/elections/social controversy; incidents/outages; personal-data cases.
- Do not turn political, election, sport or entertainment news into market-news hooks.
- Cadence, length and hashtag/topic-tag ranges are operating hypotheses, not universal ranking laws.
</social_execution_contract>`
}

export async function buildSocialPlaybookContext(
  format: ContentFormat,
  brandProfileId?: string | null,
): Promise<string> {
  const platform = FORMAT_TO_PLATFORM[format]
  if (!platform) return ''

  const contract = permanentContract()
  if (!brandProfileId) return contract

  const { data, error } = await getSupabaseAdmin()
    .from('platform_playbooks')
    .select('platform, locale, version, strategy_json, measurement_json')
    .eq('brand_id', brandProfileId)
    .eq('platform', platform)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[social-generation-policy] playbook lookup failed:', error.message)
    return contract
  }

  if (!data) return contract

  return `${contract}

<platform_playbook platform="${data.platform}" locale="${data.locale}" version="${data.version}">
This is the active Brand OS playbook for the selected platform. Apply it unless a higher-priority factual, legal, safety, brand or region rule conflicts.
STRATEGY: ${JSON.stringify(data.strategy_json ?? {})}
MEASUREMENT: ${JSON.stringify(data.measurement_json ?? {})}
</platform_playbook>`
}
