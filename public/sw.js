const CACHE_NAME = 'kupala-pwa-1782891273'
const APP_SHELL = ['/', '/generate', '/market', '/history', '/rewrite', '/settings', '/manifest.webmanifest', '/pwa-icon.svg', '/icon-v2.svg', '/icon-nobg.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Network-first for HTML navigations — always get the latest page,
  // never serve a stale cached shell for route content.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Network-first for everything else too, cache as fallback only
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
        return response
      })
      .catch(() => caches.match(request))
  )
})

// Let the page force-activate a waiting SW immediately (see layout.tsx registration)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
