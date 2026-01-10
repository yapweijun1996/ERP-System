
const CACHE_NAME = 'nexus-erp-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: Cache Core Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle ESM modules and CDN resources (Runtime Caching)
  if (event.request.url.includes('esm.sh') || event.request.url.includes('cdn.')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
             // Swallow errors for offline handling
          });
          return response || fetchPromise;
        });
      })
    );
    return;
  }

  // App Shell Strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if available
        if (response) {
          // Fetch update in background to keep cache fresh (Stale-While-Revalidate)
          fetch(event.request).then((networkResponse) => {
             if(networkResponse && networkResponse.status === 200) {
                 caches.open(CACHE_NAME).then((cache) => {
                     cache.put(event.request, networkResponse.clone());
                 });
             }
          }).catch(() => {});
          return response;
        }

        // Network fallback
        return fetch(event.request);
      })
  );
});
