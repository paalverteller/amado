import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

/** A finding row as constructed by the checks below, before insertion. */
interface QaFindingDraft {
  brand_id: string
  asset_id: string
  severity: 'critical' | 'high' | 'medium'
  category: string
  description: string
  status: 'open'
}

/**
 * GET /api/brands/[brandId]/qa
 * List QA findings with filtering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const assetId = searchParams.get('assetId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const admin = getSupabaseAdmin()
    let query = admin
      .from('qa_findings')
      .select(`
        *,
        claim_spans(*)
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (severity) query = query.eq('severity', severity)
    if (status) query = query.eq('status', status)
    if (assetId) query = query.eq('asset_id', assetId)

    const { data: findings, error } = await query

    if (error) throw error

    return NextResponse.json({ findings: findings || [] })
  } catch (err) {
    console.error('[qa-list] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

/**
 * POST /api/brands/[brandId]/qa
 * Run QA pipeline on an asset
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const body = await request.json()
    const { assetId, content, checks = ['claims', 'terms', 'compliance'] } = body

    if (!assetId || !content) {
      return NextResponse.json(
        { error: 'assetId and content are required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()
    const findings: QaFindingDraft[] = []

    // 1. Claim verification
    if (checks.includes('claims')) {
      const { data: claims } = await admin
        .from('brand_claims')
        .select('*')
        .eq('brand_id', brandId)

      for (const claim of (claims || [])) {
        if (claim.claim_type === 'forbidden' && content.toLowerCase().includes(claim.claim_text.toLowerCase())) {
          findings.push({
            brand_id: brandId,
            asset_id: assetId,
            severity: 'critical',
            category: 'forbidden_claim',
            description: `Forbidden claim detected: "${claim.claim_text}"`,
            status: 'open',
          })
        }
      }
    }

    // 2. Term policy check
    if (checks.includes('terms')) {
      const { data: terms } = await admin
        .from('brand_terms')
        .select('*')
        .eq('brand_id', brandId)
        .eq('active', true)

      for (const term of (terms || [])) {
        if (term.policy === 'forbidden' && content.toLowerCase().includes(term.term.toLowerCase())) {
          findings.push({
            brand_id: brandId,
            asset_id: assetId,
            severity: 'high',
            category: 'forbidden_term',
            description: `Forbidden term "${term.term}" used. Replacement: ${term.replacement || 'none'}`,
            status: 'open',
          })
        }
      }
    }

    // 3. Compliance check (placeholder for more sophisticated checks)
    if (checks.includes('compliance')) {
      // Check for required disclaimers
      const { data: rules } = await admin
        .from('brand_rules')
        .select('*')
        .eq('brand_id', brandId)
        .eq('rule_class', 'legal')
        .eq('status', 'approved')

      for (const rule of (rules || [])) {
        const instruction = rule.value_json?.instruction || ''
        if (instruction.includes('disclaimer') && !content.toLowerCase().includes('disclaimer')) {
          findings.push({
            brand_id: brandId,
            asset_id: assetId,
            severity: 'medium',
            category: 'missing_disclaimer',
            description: `Potential missing disclaimer: ${instruction}`,
            status: 'open',
          })
        }
      }
    }

    // Store findings
    for (const finding of findings) {
      await admin.from('qa_findings').insert(finding)
    }

    // Update asset QA status
    await admin
      .from('content_assets')
      .update({
        qa_status: findings.length > 0 ? 'failed' : 'passed',
        qa_findings_count: findings.length,
      })
      .eq('id', assetId)

    return NextResponse.json({
      findings,
      passed: findings.length === 0,
      summary: {
        total: findings.length,
        critical: findings.filter((f: QaFindingDraft) => f.severity === 'critical').length,
        high: findings.filter((f: QaFindingDraft) => f.severity === 'high').length,
        medium: findings.filter((f: QaFindingDraft) => f.severity === 'medium').length,
      },
    })
  } catch (err) {
    console.error('[qa-run] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
