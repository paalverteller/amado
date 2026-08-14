import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Sprint 10 addition: a request carrying a valid CRON_SECRET bearer
 * token is a trusted server-to-server call and passes regardless of the
 * auth cookie. Needed because app/api/cron/market-refresh/route.ts makes
 * an internal fetch to /api/market/refresh -- a route this proxy does
 * NOT put in the always-allow list below (only /api/cron/* is), so that
 * internal call would otherwise 401 against itself. This was a
 * pre-existing gap (the fetch call predates this fix), not something
 * introduced here -- ACCESS_PASSWORD being unset makes isAuthenticated
 * always false below, so this route would 401 the internal call either
 * way, cookie or not.
 */
function hasValidCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

// In Next.js 16+, the exported function MUST be named 'proxy', not 'middleware'
const PUBLIC_ASSET_RE = /\.(?:svg|png|jpe?g|webp|gif|ico|avif|woff2?|webmanifest)$/i

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets must be available before password auth. In particular the
  // August /amado-icon.* files are rendered on the login screen itself.
  if (PUBLIC_ASSET_RE.test(pathname)) {
    return NextResponse.next()
  }

  // Always allow: static assets, auth API, cron, PWA files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg' ||
    pathname === '/pwa-icon.svg' ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest'
  ) {
    return NextResponse.next()
  }

  if (hasValidCronSecret(request)) {
    return NextResponse.next()
  }

  const password = process.env.ACCESS_PASSWORD
  const authCookie = request.cookies.get('auth')
  const isAuthenticated = !!password && authCookie?.value === password

  // Root page is the login form — allow unauthenticated access
  const isPublicPage = pathname === '/'

  if (!isAuthenticated && !isPublicPage && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Protect API routes
  if (!isAuthenticated && pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Authenticated user on login page -> send to the Overview landing page
  if (isAuthenticated && isPublicPage) {
    return NextResponse.redirect(new URL('/overview', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}