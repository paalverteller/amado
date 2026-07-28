import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const report: Sprint2ReadinessReport = {
    generatedAt: new Date().toISOString(),
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    database: {
      requiredTables: {},
      requiredColumns: [],
      pendingMigrations: [],
    },
    features: {
      evidenceIngestion: false,
      signals: false,
      opportunities: false,
      contentBriefs: false,
      knowledgeLibrary: false,
      generationMetadata: false,
      localePtBr: false,
    },
    blockers: [],
    warnings: [],
  }

  try {
    const admin = getSupabaseAdmin()

    // Check required tables
    const requiredTables = [
      'articles', 'rss_sources', 'rss_items', 'brand_profiles',
      'regions', 'prompt_templates', 'evidence_items', 'source_items_raw',
      'ingestion_runs', 'source_health_events', 'content_requests',
      'content_formats', 'generation_runs', 'cron_state', 'user_preferences',
    ]

    for (const table of requiredTables) {
      const { data, error } = await admin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .maybeSingle()

      if (error) {
        report.database.requiredTables[table] = 'incompatible'
        report.warnings.push(`Error checking table ${table}: ${error.message}`)
      } else if (data) {
        report.database.requiredTables[table] = 'present'
      } else {
        report.database.requiredTables[table] = 'missing'
        report.blockers.push(`Missing required table: ${table}`)
      }
    }

    // Check critical columns
    const requiredColumns = [
      { table: 'articles', column: 'content_request_id' },
      { table: 'articles', column: 'locale' },
      { table: 'articles', column: 'region_id' },
      { table: 'brand_profiles', column: 'region_id' },
      { table: 'brand_profiles', column: 'positioning' },
      { table: 'rss_sources', column: 'source_type' },
      { table: 'rss_sources', column: 'health_status' },
      { table: 'evidence_items', column: 'content_fingerprint' },
      { table: 'evidence_items', column: 'canonical_url' },
    ]

    for (const { table, column } of requiredColumns) {
      const { data, error } = await admin
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .eq('column_name', column)
        .maybeSingle()

      if (error) {
        report.database.requiredColumns.push({ table, column, status: 'incompatible' })
        report.warnings.push(`Error checking column ${table}.${column}: ${error.message}`)
      } else if (data) {
        report.database.requiredColumns.push({ table, column, status: 'present' })
      } else {
        report.database.requiredColumns.push({ table, column, status: 'missing' })
        report.blockers.push(`Missing required column: ${table}.${column}`)
      }
    }

    // Feature detection
    report.features.evidenceIngestion = report.database.requiredTables['evidence_items'] === 'present'
    report.features.localePtBr = report.database.requiredTables['regions'] === 'present'
    report.features.generationMetadata = report.database.requiredTables['generation_runs'] === 'present'

    // Sprint 2 specific checks
    const sprint2Tables = [
      'workspaces', 'workspace_members', 'signals', 'opportunities',
      'content_briefs', 'knowledge_documents', 'brand_rule_sets',
      'brand_rules', 'platform_playbooks', 'content_packages',
    ]

    for (const table of sprint2Tables) {
      const { data } = await admin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', table)
        .maybeSingle()

      if (!data) {
        report.warnings.push(`Sprint 2 table not yet created: ${table}`)
      }
    }

    // Overall readiness
    const hasBlockers = report.blockers.length > 0
    report.warnings.push(
      hasBlockers
        ? `Sprint 2 blocked: ${report.blockers.length} critical issues found`
        : 'Sprint 1 foundation appears complete. Sprint 2 can proceed.'
    )

    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      {
        ...report,
        blockers: [...report.blockers, `Readiness check failed: ${(err as Error).message}`],
      },
      { status: 500 }
    )
  }
}

// Types
type Sprint2ReadinessReport = {
  generatedAt: string
  gitCommit: string | null
  database: {
    requiredTables: Record<string, 'present' | 'missing' | 'incompatible'>
    requiredColumns: Array<{
      table: string
      column: string
      status: 'present' | 'missing' | 'incompatible'
    }>
    pendingMigrations: string[]
  }
  features: {
    evidenceIngestion: boolean
    signals: boolean
    opportunities: boolean
    contentBriefs: boolean
    knowledgeLibrary: boolean
    generationMetadata: boolean
    localePtBr: boolean
  }
  blockers: string[]
  warnings: string[]
}
