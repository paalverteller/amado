import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; runId: string }> }
): Promise<NextResponse> {
  try {
    const { brandId, runId } = await params
    const admin = getSupabaseAdmin()

    // Get import run
    const { data: importRun, error: runError } = await admin
      .from('guideline_import_runs')
      .select('*')
      .eq('id', runId)
      .eq('brand_id', brandId)
      .single()

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 })
    }

    if (!importRun) {
      return NextResponse.json({ error: 'Import run not found' }, { status: 404 })
    }

    // Get candidates
    const { data: candidates, error: candidatesError } = await admin
      .from('guideline_rule_candidates')
      .select('*')
      .eq('import_run_id', runId)
      .order('confidence', { ascending: false })

    if (candidatesError) {
      return NextResponse.json({ error: candidatesError.message }, { status: 500 })
    }

    // Get conflicts
    const { data: conflicts, error: conflictsError } = await admin
      .from('policy_conflicts')
      .select('*')
      .eq('import_run_id', runId)
      .order('severity', { ascending: false })

    if (conflictsError) {
      return NextResponse.json({ error: conflictsError.message }, { status: 500 })
    }

    // Summary stats
    const stats = {
      totalCandidates: candidates?.length ?? 0,
      approved: candidates?.filter(c => c.human_decision === 'approved').length ?? 0,
      rejected: candidates?.filter(c => c.human_decision === 'rejected').length ?? 0,
      pending: candidates?.filter(c => !c.human_decision || c.human_decision === 'pending').length ?? 0,
      conflicts: {
        total: conflicts?.length ?? 0,
        critical: conflicts?.filter(c => c.severity === 'critical').length ?? 0,
        high: conflicts?.filter(c => c.severity === 'high').length ?? 0,
        resolved: conflicts?.filter(c => c.human_decision === 'resolved').length ?? 0,
      },
    }

    return NextResponse.json({
      importRun: {
        id: importRun.id,
        status: importRun.status,
        documentType: importRun.document_type,
        extractionSummary: importRun.extraction_summary,
        errorSummary: importRun.error_summary,
        timingMs: importRun.timing_ms,
        createdAt: importRun.created_at,
        completedAt: importRun.completed_at,
      },
      stats,
      candidates: candidates || [],
      conflicts: conflicts || [],
    })
  } catch (err) {
    console.error('[guideline-import-status] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; runId: string }> }
): Promise<NextResponse> {
  try {
    const { brandId, runId } = await params
    const body = await request.json()
    const { candidateDecisions, conflictResolutions, publish = false } = body

    const admin = getSupabaseAdmin()

    // Update candidate decisions
    if (candidateDecisions && Array.isArray(candidateDecisions)) {
      for (const decision of candidateDecisions) {
        const { candidateId, humanDecision, humanNote } = decision
        const { error } = await admin
          .from('guideline_rule_candidates')
          .update({
            human_decision: humanDecision,
            human_note: humanNote,
          })
          .eq('id', candidateId)
          .eq('import_run_id', runId)

        if (error) {
          console.warn(`[guideline-import] Failed to update candidate ${candidateId}:`, error.message)
        }
      }
    }

    // Update conflict resolutions
    if (conflictResolutions && Array.isArray(conflictResolutions)) {
      for (const resolution of conflictResolutions) {
        const { conflictId, humanDecision, resolutionNote } = resolution
        const { error } = await admin
          .from('policy_conflicts')
          .update({
            human_decision: humanDecision,
            resolution_note: resolutionNote,
          })
          .eq('id', conflictId)
          .eq('import_run_id', runId)

        if (error) {
          console.warn(`[guideline-import] Failed to update conflict ${conflictId}:`, error.message)
        }
      }
    }

    // Publish approved candidates to active rule set
    if (publish) {
      const { data: approvedCandidates, error: fetchError } = await admin
        .from('guideline_rule_candidates')
        .select('*')
        .eq('import_run_id', runId)
        .eq('human_decision', 'approved')

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      // Get or create active rule set
      const { data: activeRuleSet, error: ruleSetError } = await admin
        .from('brand_rule_sets')
        .select('id')
        .eq('brand_id', brandId)
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ruleSetError) {
        return NextResponse.json({ error: ruleSetError.message }, { status: 500 })
      }

      let ruleSetId = activeRuleSet?.id

      if (!ruleSetId) {
        // Create new rule set
        const { data: newRuleSet, error: createError } = await admin
          .from('brand_rule_sets')
          .insert({
            workspace_id: '00000000-0000-0000-0000-000000000000',
            brand_id: brandId,
            name: 'Auto-generated from import',
            version: `v${Date.now()}`,
            status: 'active',
            published_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        ruleSetId = newRuleSet.id
      }

      // Insert approved rules
      for (const candidate of (approvedCandidates || [])) {
        const { error: insertError } = await admin
          .from('brand_rules')
          .insert({
            rule_set_id: ruleSetId,
            rule_class: candidate.rule_class,
            enforcement: candidate.enforcement,
            rule_key: candidate.rule_key,
            operator: candidate.operator,
            value_json: candidate.value_json,
            scope_json: candidate.scope_json,
            source_document_id: candidate.source_document_id,
            source_anchor: candidate.source_anchor,
            extraction_confidence: candidate.confidence,
            human_approved: true,
          })

        if (insertError) {
          console.warn('[guideline-import] Failed to insert rule:', insertError.message)
        }
      }

      // Update import run status
      await admin
        .from('guideline_import_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
    }

    return NextResponse.json({
      success: true,
      published: publish,
      message: publish
        ? `Published ${candidateDecisions?.filter((d: { humanDecision: string }) => d.humanDecision === 'approved').length ?? 0} rules`
        : 'Decisions saved',
    })
  } catch (err) {
    console.error('[guideline-import-patch] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
