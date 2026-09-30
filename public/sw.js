// Verze cache se musí změnit při vydání nové aplikace. HTML a JS se
// ověřují přes síť, aby PWA nemohla dlouhodobě zobrazovat starý build.
const CACHE_NAME = 'kalkulacka-oddluzeni-v2'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/pwa-192.svg', '/pwa-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return

  const url = new URL(event.request.url)
  const isDocumentOrCode = event.request.mode === 'navigate'
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css')

  if (isDocumentOrCode) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html'))),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => caches.match('/index.html'))
    }),
  )
})
