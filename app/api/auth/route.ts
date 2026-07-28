import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { password?: string }
    const valid = process.env.ACCESS_PASSWORD

    if (!valid) {
      return NextResponse.json({ error: 'ACCESS_PASSWORD not configured' }, { status: 500 })
    }
   if (!body.password || body.password !== valid) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
   }

    const res = NextResponse.json({ success: true })
    // Store the actual password value so middleware can verify it
    res.cookies.set('auth', valid, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete('auth')
  return res
}
