import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

interface Ctx { params: Promise<{ id: string }> }
const VALID_STATUS = ['planned', 'active', 'paused', 'completed', 'archived'] as const
const FIELDS = ['name', 'objective', 'primary_kpi', 'status', 'starts_at', 'ends_at', 'notes'] as const

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const { id } = await params
    const body = await request.json() as Record<string, unknown>
    if (typeof body.status === 'string' && !VALID_STATUS.includes(body.status as (typeof VALID_STATUS)[number])) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUS.join(', ')}` }, { status: 400 })
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of FIELDS) {
      if (field in body) update[field] = body[field] === '' ? null : body[field]
    }
    if (typeof update.name === 'string') update.name = update.name.trim()
    if (update.name === '') return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })

    const { data, error } = await getSupabaseAdmin().from('marketing_campaigns').update(update).eq('id', id).select().maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
