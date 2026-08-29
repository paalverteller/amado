import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { extractGuidelineRules, calculateExtractionStats } from '@/lib/brand-os/guideline-extractor'
import type { ExtractionInput } from '@/lib/brand-os/guideline-extractor'
import { getErrorMessage } from '@/lib/api/error-message'
import { resolveBrandRegionId } from '@/lib/brand-snapshot'
import { resolveRegionProfile } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
): Promise<NextResponse> {
  try {
    const { brandId } = await params
    const regionProfile = await resolveRegionProfile(await resolveBrandRegionId(brandId))
    const body = await request.json()
    const {
      sourceText,
      text,
      documentType = 'brand_core',
      platform = null,
      documentTitle = 'Imported Guideline',
      locale = regionProfile.locale,
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
        sourceType: sourceType as ExtractionInput['sourceType'],
        sourceUrl,
        sourceText: content,
        brandId,
      })

      const stats = calculateExtractionStats(extractionResult)

      // Store candidates.
      // guideline_rule_candidates requires raw_text and enforcement as
      // NOT NULL columns, and has no is_hard_rule column -- the previous
      // version omitted raw_text/enforcement entirely and sent a
      // non-existent is_hard_rule field, which fails the NOT NULL
      // constraint on every single insert. Track inserted candidate ids
      // by their original index so conflicts (below) can reference the
      // real row ids instead of the extraction agent's local rule labels.
      //
      // rule_class and enforcement are mapped to values valid on the
      // downstream brand_rules table (see [runId]/route.ts PATCH ?publish),
      // which passes candidate.rule_class and candidate.enforcement through
      // unchanged into brand_rules, a table with CHECK constraints tighter
      // than the extraction agent's own ruleType/isHardRule vocabulary.
      // brand_rules.rule_class only allows: safety, legal, factual,
      // brand_positioning, language, platform, format, campaign, style,
      // optimization_hypothesis, measurement -- five of the extractor's
      // seven ruleType values (tone, vocabulary, claim, structure, visual)
      // are not in that list and would fail the CHECK constraint at
      // publish time if inserted as-is.
      const RULE_CLASS_MAP: Record<string, string> = {
        tone: 'style',
        vocabulary: 'language',
        claim: 'factual',
        structure: 'format',
        visual: 'style',
        legal: 'legal',
        safety: 'safety',
      }
      const candidateIdByIndex = new Map<number, string>()

      for (let i = 0; i < extractionResult.rules.length; i++) {
        const rule = extractionResult.rules[i]
        const { data: candidate, error: candidateError } = await admin
          .from('guideline_rule_candidates')
          .insert({
            import_run_id: importRun.id,
            source_anchor: rule.sourceQuote,
            raw_text: rule.instruction,
            rule_class: RULE_CLASS_MAP[rule.ruleType] ?? 'brand_positioning',
            enforcement: rule.isHardRule ? 'hard_block' : 'preference',
            rule_key: `${rule.ruleType}_${rule.scope}`,
            operator: 'must',
            value_json: { instruction: rule.instruction, rationale: rule.rationale },
            scope_json: { scope: rule.scope, target: rule.scopeTarget },
            confidence: rule.confidence === 'high' ? 1 : rule.confidence === 'medium' ? 0.6 : 0.3,
            rationale_summary: rule.rationale,
            human_decision: 'pending',
          })
          .select('id')
          .single()

        if (candidateError) {
          console.error('[guideline-import] candidate insert failed:', candidateError.message)
          continue
        }
        candidateIdByIndex.set(i, candidate.id)
      }

      // Store conflicts.
      // policy_conflicts has no description/conflicting_rules columns --
      // it uses explanation plus candidate_a_id/candidate_b_id foreign
      // keys into guideline_rule_candidates. The extraction agent returns
      // ruleA/ruleB as free-text labels (e.g. "tone_global"), so match
      // them back to the rule_key built above to resolve real row ids.
      // Conflicts referencing a rule pair we can't resolve are skipped
      // rather than inserted with a dangling/null candidate id.
      for (const conflict of extractionResult.detectedConflicts) {
        const indexA = extractionResult.rules.findIndex(
          (r) => `${r.ruleType}_${r.scope}` === conflict.ruleA
        )
        const indexB = extractionResult.rules.findIndex(
          (r) => `${r.ruleType}_${r.scope}` === conflict.ruleB
        )
        const candidateAId = indexA >= 0 ? candidateIdByIndex.get(indexA) : undefined
        const candidateBId = indexB >= 0 ? candidateIdByIndex.get(indexB) : undefined

        if (!candidateAId || !candidateBId) {
          console.warn(
            '[guideline-import] skipping conflict, could not resolve candidate ids:',
            conflict.ruleA, conflict.ruleB
          )
          continue
        }

        const { error: conflictError } = await admin.from('policy_conflicts').insert({
          import_run_id: importRun.id,
          candidate_a_id: candidateAId,
          candidate_b_id: candidateBId,
          conflict_type: 'contradiction',
          severity: 'high',
          explanation: conflict.description,
          human_decision: 'pending',
        })

        if (conflictError) {
          console.error('[guideline-import] conflict insert failed:', conflictError.message)
        }
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
          error_summary: { message: getErrorMessage(extractError) },
        })
        .eq('id', importRun.id)

      return NextResponse.json({
        importRun: {
          id: importRun.id,
          status: 'failed',
          documentType: importRun.document_type,
          createdAt: importRun.created_at,
        },
        error: 'Extraction failed: ' + getErrorMessage(extractError),
      }, { status: 500 })
    }
  } catch (err) {
    console.error('[guideline-import] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
