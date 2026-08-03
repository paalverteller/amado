import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

interface Ctx { params: Promise<{ brandId: string; ruleSetId: string }> }

/**
 * POST /api/brands/[brandId]/rule-sets/[ruleSetId]/publish
 *
 * Did not exist before this sprint — the rule-sets route
 * (app/api/brands/[brandId]/rule-sets/route.ts) only ever exposed GET via
 * createBrandListHandler. Plan §8.3/Phase 3 acceptance requires "a
 * version can be published" and "a previous version can be restored" —
 * both are the same operation here: activate this rule set. Restoring an
 * archived version is just re-publishing it.
 *
 * Only one rule set is 'active' per brand at a time (see the comment on
 * brand_rule_sets in migration 030_brand_os_core.sql). Not wrapped in a
 * database transaction — this codebase doesn't use any elsewhere either —
 * so the target is activated FIRST, then the previous active one (if any)
 * is archived second, meaning a mid-way failure never leaves a brand with
 * zero active rule sets.
 */
export async function POST(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const { brandId, ruleSetId } = await params
    const admin = getSupabaseAdmin()

    const { data: target, error: targetError } = await admin
      .from('brand_rule_sets')
      .select('id, brand_id')
      .eq('id', ruleSetId)
      .eq('brand_id', brandId)
      .maybeSingle()
    if (targetError) throw new Error(targetError.message)
    if (!target) return NextResponse.json({ error: 'Rule set not found' }, { status: 404 })

    const { data: activated, error: activateError } = await admin
      .from('brand_rule_sets')
      .update({ status: 'active', published_at: new Date().toISOString() })
      .eq('id', ruleSetId)
      .select()
      .single()
    if (activateError) throw new Error(activateError.message)

    const { error: archiveError } = await admin
      .from('brand_rule_sets')
      .update({ status: 'archived' })
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .neq('id', ruleSetId)
    if (archiveError) throw new Error(archiveError.message)

    return NextResponse.json({ ruleSet: activated })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
