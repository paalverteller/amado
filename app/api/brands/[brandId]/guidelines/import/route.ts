import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { extractGuidelineRules, calculateExtractionStats } from '@/lib/brand-os/guideline-extractor'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
): Promise<NextResponse> {
  try {
    const { brandId } = await params
    const body = await request.json()
    const {
      sourceText,
      text,
      documentType = 'brand_core',
      platform = null,
      documentTitle = 'Imported Guideline',
      locale = 'pt-BR',
      sourceType = 'manual',
      sourceUrl,
    } = body

    const content = text || sourceText
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // 1. Store the source document
    const { data: doc, error: docError } = await admin
      .from('knowledge_documents')
      .insert({
        brand_id: brandId,
        title: documentTitle,
        content: content.trim(),
        document_type: documentType,
        platform,
        locale,
        status: 'pending_review',
      })
      .select('id')
      .single()

    if (docError) {
      console.warn('[guideline-import] knowledge_documents not available:', docError.message)
    }

    // 2. Create import run
    const { data: importRun, error: runError } = await admin
      .from('guideline_import_runs')
      .insert({
        brand_id: brandId,
        workspace_id: '00000000-0000-0000-0000-000000000000',
        source_document_ids: doc ? [doc.id] : [],
        document_type: documentType,
        status: 'processing',
        extraction_summary: {
          documentTitle,
          platform,
          locale,
          textLength: content.length,
          wordCount: content.split(/\s+/).length,
        },
      })
      .select()
      .single()

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 })
    }

    // 3. Run extraction agent
    try {
      const extractionResult = await extractGuidelineRules({
        sourceType: sourceType as any,
        sourceUrl,
        sourceText: content,
        brandId,
      })

      const stats = calculateExtractionStats(extractionResult)

      // Store candidates
      for (const rule of extractionResult.rules) {
        await admin.from('guideline_rule_candidates').insert({
          import_run_id: importRun.id,
          rule_class: rule.ruleType,
          rule_key: `${rule.ruleType}_${rule.scope}`,
          operator: 'must',
          value_json: { instruction: rule.instruction, rationale: rule.rationale },
          scope_json: { scope: rule.scope, target: rule.scopeTarget },
          confidence: rule.confidence,
          source_anchor: rule.sourceQuote,
          is_hard_rule: rule.isHardRule,
          human_decision: 'pending',
        })
      }

      // Store conflicts
      for (const conflict of extractionResult.detectedConflicts) {
        await admin.from('policy_conflicts').insert({
          import_run_id: importRun.id,
          severity: 'high',
          description: conflict.description,
          conflicting_rules: [conflict.ruleA, conflict.ruleB],
          human_decision: 'pending',
        })
      }

      // Update import run
      await admin
        .from('guideline_import_runs')
        .update({
          status: 'review',
          extraction_summary: {
            ...importRun.extraction_summary,
            stats,
            summary: extractionResult.summary,
            requiresLegalReview: extractionResult.requiresLegalReview,
          },
          completed_at: new Date().toISOString(),
        })
        .eq('id', importRun.id)

      return NextResponse.json({
        importRun: {
          id: importRun.id,
          status: 'review',
          documentType: importRun.document_type,
          createdAt: importRun.created_at,
          stats,
        },
        message: 'Extraction complete. Review candidates before publishing.',
      }, { status: 201 })
    } catch (extractError) {
      console.error('[guideline-import] extraction failed:', extractError)
      
      await admin
        .from('guideline_import_runs')
        .update({
          status: 'failed',
          error_summary: { message: (extractError as Error).message },
        })
        .eq('id', importRun.id)

      return NextResponse.json({
        importRun: {
          id: importRun.id,
          status: 'failed',
          documentType: importRun.document_type,
          createdAt: importRun.created_at,
        },
        error: 'Extraction failed: ' + (extractError as Error).message,
      }, { status: 500 })
    }
  } catch (err) {
    console.error('[guideline-import] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
