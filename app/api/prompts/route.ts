import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal Server Error'
}

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>
    const { data, error } = await getSupabaseAdmin()
      .from('prompt_templates')
      .insert([body])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
