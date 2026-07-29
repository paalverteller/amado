import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireCronAuth } from '@/lib/cron-auth'
import { getErrorMessage } from '@/lib/api/error-message'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  try {
    // Ping Supabase to keep it alive (7 days inactivity timer)
    const { error } = await getSupabaseAdmin().from('rss_sources').select('id').limit(1)

    if (error) throw error

    return NextResponse.json({ 
      status: 'ok', 
      message: 'Supabase is kept alive',
      timestamp: new Date().toISOString() 
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
