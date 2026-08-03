import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// In Next.js 16+, the exported function MUST be named 'proxy', not 'middleware'
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
