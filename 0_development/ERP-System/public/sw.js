const IS_LOCALHOST =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname === '0.0.0.0';

// On localhost, always disable SW caching to avoid stale bundles during development.
if (IS_LOCALHOST) {
  self.addEventListener('install', (event) => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((c) => c.navigate(c.url));
      })()
    );
  });

  self.addEventListener('fetch', () => {});
} else {
  const CACHE_NAME = 'nexus-erp-v2';
  const URLS_TO_CACHE = ['/', '/index.html', '/manifest.json', '/index.css'];

  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)));
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) =>
        Promise.all(cacheNames.map((name) => (name !== CACHE_NAME ? caches.delete(name) : null)))
      )
    );
    self.clients.claim();
  });

  self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(event.request);
      })
    );
  });
}

