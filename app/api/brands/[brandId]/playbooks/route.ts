import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

type Context = {
  params: Promise<{ brandId: string }>
}

export async function GET(
  _request: NextRequest,
  { params }: Context,
): Promise<NextResponse> {
  try {
    const { brandId } = await params

    const { data, error } = await getSupabaseAdmin()
      .from('platform_playbooks')
      .select('id, platform, locale, version, status, strategy_json, measurement_json, created_at')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('platform', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ playbooks: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
