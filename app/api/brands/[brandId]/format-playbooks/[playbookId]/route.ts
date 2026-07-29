import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/api/error-message'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; playbookId: string }> }
) {
  try {
    const { brandId, playbookId } = await params
    const admin = getSupabaseAdmin()

    const { data: playbook, error } = await admin
      .from('format_playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('brand_id', brandId)
      .single()

    if (error || !playbook) {
      return NextResponse.json({ error: 'Format playbook not found' }, { status: 404 })
    }

    return NextResponse.json({ playbook })
  } catch (err) {
    console.error('[format-playbook-get] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; playbookId: string }> }
) {
  try {
    const { brandId, playbookId } = await params
    const body = await request.json()
    const admin = getSupabaseAdmin()

    const updates: any = {}
    const fields = ['format', 'structure_template', 'section_guidance', 'length_guidance', 'visual_guidance', 'example_structure', 'active']
    
    for (const field of fields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    const { data: playbook, error } = await admin
      .from('format_playbooks')
      .update(updates)
      .eq('id', playbookId)
      .eq('brand_id', brandId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ playbook })
  } catch (err) {
    console.error('[format-playbook-update] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; playbookId: string }> }
) {
  try {
    const { brandId, playbookId } = await params
    const admin = getSupabaseAdmin()

    const { error } = await admin
      .from('format_playbooks')
      .delete()
      .eq('id', playbookId)
      .eq('brand_id', brandId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[format-playbook-delete] error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
