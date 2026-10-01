import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

// The free-text fields on brand_profiles itself. "Filled" means non-empty
// after trimming -- a placeholder string like "PLACEHOLDER — ..." still
// counts as filled here, since this endpoint reports structural
// completeness (is there *something* in each field), not content quality.
// Whether a filled field is still a placeholder is a judgement call for a
// human reading it in Settings -> Brand OS, not something this endpoint
// can determine from string content alone.
const PROFILE_TEXT_FIELDS = [
  'voice_description', 'forbidden_words', 'example_posts', 'target_audience',
  'competitors', 'positioning', 'value_propositions', 'strategic_themes',
  'product_facts', 'proof_points', 'cta_library', 'legal_disclaimers',
  'glossary', 'sensitive_topics', 'default_platform_rules',
] as const

// Structured tables buildBrandSnapshot() (lib/brand-snapshot.ts) actually
// reads at generation time. Each is used conditionally on row count --
// zero rows means that guidance block is silently omitted from every
// generation for this brand, not an error. Listing them here mirrors
// exactly what brand-snapshot.ts queries, so this report reflects real
// generation-time coverage rather than a separately-invented checklist.
const STRUCTURED_TABLES = [
  { table: 'brand_audiences', filter: { active: true } },
  { table: 'brand_pain_points', filter: { active: true } },
  { table: 'brand_products', filter: { active: true } },
  { table: 'brand_claims', filter: { status: 'active' } },
  { table: 'brand_terms', filter: null },
  { table: 'brand_content_pillars', filter: { active: true } },
] as const

type ProfileRow = Record<string, string | boolean | null> & { id: string; brand_name: string; region_id: string | null }

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const regionId = request.nextUrl.searchParams.get('region_id')
    const brandId = request.nextUrl.searchParams.get('brand_id')
    const admin = getSupabaseAdmin()

    let profileQuery = admin.from('brand_profiles').select('*').eq('is_active', true)
    if (regionId) profileQuery = profileQuery.eq('region_id', regionId)
    if (brandId) profileQuery = profileQuery.eq('id', brandId)
    const { data: profiles, error: profilesError } = await profileQuery
    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })

    const brandRows = (profiles ?? []) as ProfileRow[]
    if (brandRows.length === 0) {
      return NextResponse.json({ brands: [], generatedAt: new Date().toISOString() })
    }

    const brands = await Promise.all(
      brandRows.map(async (brand) => {
        const emptyFields = PROFILE_TEXT_FIELDS.filter((field) => {
          const value = brand[field]
          return typeof value !== 'string' || value.trim().length === 0
        })

        const tableCounts = await Promise.all(
          STRUCTURED_TABLES.map(async ({ table, filter }) => {
            let query = admin.from(table).select('id', { count: 'exact', head: true }).eq('brand_id', brand.id)
            if (filter) {
              for (const [key, value] of Object.entries(filter)) {
                query = query.eq(key, value)
              }
            }
            const { count, error } = await query
            return { table, count: error ? null : (count ?? 0), error: error?.message ?? null }
          }),
        )

        const { data: activeRuleSet } = await admin
          .from('brand_rule_sets')
          .select('id')
          .eq('brand_id', brand.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()

        return {
          id: brand.id,
          name: brand.brand_name,
          regionId: brand.region_id,
          isDefault: Boolean(brand.is_default),
          emptyProfileFields: emptyFields,
          filledProfileFieldCount: PROFILE_TEXT_FIELDS.length - emptyFields.length,
          totalProfileFieldCount: PROFILE_TEXT_FIELDS.length,
          structuredTables: tableCounts,
          hasActiveRuleSet: Boolean(activeRuleSet?.id),
        }
      }),
    )

    return NextResponse.json({ brands, generatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
