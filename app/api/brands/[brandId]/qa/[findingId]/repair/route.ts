import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { generateArticleWithFallback } from '@/lib/ai'

/**
 * POST /api/brands/[brandId]/qa/[findingId]/repair
 * Generate repair for a QA finding
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; findingId: string }> }
) {
  try {
    const { brandId, findingId } = await params
    const body = await request.json()
    const { strategy = 'auto' } = body

    const admin = getSupabaseAdmin()

    // Get finding
    const { data: finding, error: findingError } = await admin
      .from('qa_findings')
      .select('*')
      .eq('id', findingId)
      .eq('brand_id', brandId)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Get asset content
    const { data: asset } = await admin
      .from('content_assets')
      .select('content, platform, format')
      .eq('id', finding.asset_id)
      .single()

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Get brand rules for context
    const { data: rules } = await admin
      .from('brand_rules')
      .select('*')
      .eq('brand_id', brandId)
      .eq('status', 'approved')
      .limit(20)

    // Build repair prompt
    const repairPrompt = `You are a content repair agent. Fix the following content issue:

ISSUE: ${finding.description}
CATEGORY: ${finding.category}
SEVERITY: ${finding.severity}

ORIGINAL CONTENT:
${asset.content}

PLATFORM: ${asset.platform}
FORMAT: ${asset.format}

RELEVANT BRAND RULES:
${(rules || []).map((r: any) => `- ${r.value_json?.instruction || r.rule_key}`).join('\n')}

INSTRUCTIONS:
1. Fix the issue while preserving the original message and tone
2. Maintain platform-appropriate formatting
3. Ensure compliance with all brand rules
4. Return ONLY the repaired content, no explanations

REPAIRED CONTENT:`

    const { text: repairedContent } = await generateArticleWithFallback({
      systemPrompt: 'You are a content repair agent. Fix content issues while preserving the original message and tone.',
      userPrompt: repairPrompt,
      task: 'utility',
    })

    // Create repair run
    const { data: repairRun, error: repairError } = await admin
      .from('repair_runs')
      .insert({
        finding_id: findingId,
        asset_id: finding.asset_id,
        strategy,
        original_content: asset.content,
        repaired_content: repairedContent,
        status: 'pending_review',
      })
      .select()
      .single()

    if (repairError) throw repairError

    return NextResponse.json({
      repairRun,
      repairedContent,
    })
  } catch (err) {
    console.error('[repair-run] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * PATCH /api/brands/[brandId]/qa/[findingId]/repair
 * Approve or reject a repair
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; findingId: string }> }
) {
  try {
    const { findingId } = await params
    const body = await request.json()
    const { repairRunId, decision, note } = body

    if (!repairRunId || !decision) {
      return NextResponse.json(
        { error: 'repairRunId and decision are required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    const { data: repairRun, error } = await admin
      .from('repair_runs')
      .update({
        status: decision === 'approve' ? 'approved' : 'rejected',
        human_note: note,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', repairRunId)
      .eq('finding_id', findingId)
      .select()
      .single()

    if (error) throw error

    // If approved, update asset content
    if (decision === 'approve') {
      await admin
        .from('content_assets')
        .update({
          content: repairRun.repaired_content,
          qa_status: 'passed',
        })
        .eq('id', repairRun.asset_id)

      // Mark finding as resolved
      await admin
        .from('qa_findings')
        .update({ status: 'resolved' })
        .eq('id', findingId)
    }

    return NextResponse.json({ repairRun })
  } catch (err) {
    console.error('[repair-review] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
