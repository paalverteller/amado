/**
 * Amado — Cron Authentication Helper
 * 
 * §2.3 from product spec: shared requireCronAuth() helper.
 * Missing secret must always return 401 in production.
 */

import { NextResponse } from 'next/server'

/**
 * Verify cron authorization. Returns a NextResponse with 401 if unauthorized,
 * or null if authorized.
 * 
 * Usage:
 *   const denied = requireCronAuth(request)
 *   if (denied) return denied
 */
export function requireCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  
  // If secret is configured, require exact match
  if (secret) {
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null
  }
  
  // No secret configured: fail closed in production
  const isProduction = 
    process.env.NODE_ENV === 'production' || 
    process.env.VERCEL_ENV === 'production'
  
  if (isProduction) {
    return NextResponse.json(
      { error: 'Unauthorized — CRON_SECRET not configured' }, 
      { status: 401 }
    )
  }
  
  // Development: allow without secret (with warning)
  console.warn('[cron-auth] No CRON_SECRET configured — allowing in development only')
  return null
}
