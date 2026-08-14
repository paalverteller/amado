import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseRuntimeInfo } from '@/lib/supabase/client'
import { getAiRuntimeInfo } from '@/lib/ai-utils'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

// AMADO_MVP_RUNTIME_REPAIR_V1
export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseRuntimeInfo()
  const ai = getAiRuntimeInfo()

  try {
    const admin = getSupabaseAdmin()

    const [
      { count: brands, error: brandsError },
      { count: sources, error: sourcesError },
      { count: competitors, error: competitorsError },
    ] = await Promise.all([
      admin.from('brand_profiles').select('id', { count: 'exact', head: true }),
      admin.from('rss_sources').select('id', { count: 'exact', head: true }),
      admin.from('competitors').select('id', { count: 'exact', head: true }),
    ])

    const errors = [brandsError, sourcesError, competitorsError]
      .filter(Boolean)
      .map((error) => error?.message ?? 'Unknown database error')

    const databaseOk = errors.length === 0

    return NextResponse.json(
      {
        ok: databaseOk && ai.googleConfigured,
        database: {
          ok: databaseOk,
          supabase,
          counts: {
            brands: brands ?? 0,
            sources: sources ?? 0,
            competitors: competitors ?? 0,
          },
          errors,
        },
        ai,
        deployment: {
          gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
          environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
        },
      },
      {
        status: databaseOk ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: {
          ok: false,
          supabase,
          errors: [getErrorMessage(error)],
        },
        ai,
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
