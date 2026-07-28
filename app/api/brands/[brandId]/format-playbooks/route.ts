import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/brands/[brandId]/format-playbooks
 * List format playbooks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')
    const active = searchParams.get('active')

    const admin = getSupabaseAdmin()
    let query = admin
      .from('format_playbooks')
      .select('*')
      .eq('brand_id', brandId)
      .order('format', { ascending: true })

    if (format) query = query.eq('format', format)
    if (active !== null) query = query.eq('active', active === 'true')

    const { data: playbooks, error } = await query

    if (error) throw error

    return NextResponse.json({ playbooks: playbooks || [] })
  } catch (err) {
    console.error('[format-playbooks-list] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/brands/[brandId]/format-playbooks
 * Create a new format playbook
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params
    const body = await request.json()
    const {
      format,
      structureTemplate,
      sectionGuidance,
      lengthGuidance,
      visualGuidance,
      exampleStructure,
      active = true,
    } = body

    if (!format) {
      return NextResponse.json(
        { error: 'format is required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    const { data: playbook, error } = await admin
      .from('format_playbooks')
      .insert({
        brand_id: brandId,
        workspace_id: '00000000-0000-0000-0000-000000000000',
        format,
        structure_template: structureTemplate,
        section_guidance: sectionGuidance || {},
        length_guidance: lengthGuidance || {},
        visual_guidance: visualGuidance,
        example_structure: exampleStructure,
        active,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ playbook }, { status: 201 })
  } catch (err) {
    console.error('[format-playbook-create] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
