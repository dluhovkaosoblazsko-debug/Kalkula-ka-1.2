const CACHE_PREFIX = 'kalkulacka-oddluzeni-'
const CACHE_NAME = `${CACHE_PREFIX}v3`
const STATIC_ASSETS = ['/manifest.webmanifest', '/pwa-192.svg', '/pwa-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )

    await self.clients.claim()

    // Jednorázově přenačte otevřená okna při přechodu ze starého
    // cache-first service workeru. localStorage s údaji uživatele se nemaže.
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    await Promise.all(
      clients.map(async (client) => {
        try {
          await client.navigate(client.url)
        } catch {
          // Pokud prohlížeč automatickou navigaci nepovolí,
          // controllerchange v aplikaci provede reload na straně klienta.
        }
      }),
    )
  })())
})

self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET'
    || new URL(event.request.url).origin !== self.location.origin
  ) return

  // Každá navigace jde nejdříve na síť. Díky tomu nový Render deploy
  // okamžitě získá nový index.html a nový hashovaný JS bundle.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' })
        const copy = response.clone()
        const cache = await caches.open(CACHE_NAME)
        await cache.put('/index.html', copy)
        return response
      } catch {
        return (await caches.match('/index.html')) || Response.error()
      }
    })())
    return
  }

  // Hashované assety jsou bezpečné pro cache-first.
  event.respondWith((async () => {
    const cached = await caches.match(event.request)
    if (cached) return cached

    const response = await fetch(event.request)
    if (response.ok) {
      const copy = response.clone()
      const cache = await caches.open(CACHE_NAME)
      await cache.put(event.request, copy)
    }
    return response
  })())
})
