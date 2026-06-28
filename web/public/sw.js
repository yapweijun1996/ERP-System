const CACHE_VERSION = 'erp-system-pwa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const staticUrls = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './assets/erp.css',
  './assets/erp-blocks.css',
  './assets/i18n.css',
  './assets/sales-ext.css',
  './assets/purchasing-ext.css',
  './assets/pwa.css',
  './assets/icons.js',
  './assets/data-core.js',
  './assets/data-master.js',
  './assets/data-sales.js',
  './assets/data-purchasing.js',
  './assets/data-purchasing-ext.js',
  './assets/data-manufacturing.js',
  './assets/data-quality.js',
  './assets/data-crm.js',
  './assets/data-service.js',
  './assets/data-assets.js',
  './assets/data-finance.js',
  './assets/data-hr.js',
  './assets/data-projects.js',
  './assets/data-integration.js',
  './assets/data-bi.js',
  './assets/data-admin.js',
  './assets/master-db.js',
  './assets/sales-data.js',
  './assets/erp-system-data-adapter.js',
  './assets/ui.js',
  './assets/i18n.js',
  './assets/screens-ops.js',
  './assets/screens-inv.js',
  './assets/screens-mfg.js',
  './assets/screens-qc.js',
  './assets/screens-crm.js',
  './assets/screens-service.js',
  './assets/screens-asset.js',
  './assets/screens-fin.js',
  './assets/screens-fin2.js',
  './assets/screens-sales.js',
  './assets/screens-purchase.js',
  './assets/screens-hr.js',
  './assets/screens-bi.js',
  './assets/screens-admin.js',
  './assets/screens-people.js',
  './assets/screens-project.js',
  './assets/screens-integration.js',
  './assets/screens-settings.js',
  './assets/screens-sales-new.js',
  './assets/screens-sales-hub.js',
  './assets/screens-sales-list.js',
  './assets/screens-sales-control.js',
  './assets/screens-quotation-crud.js',
  './assets/screens-txn-view.js',
  './assets/screens-purch-new.js',
  './assets/screens-purchasing-hub.js',
  './assets/screens-purchasing-lists.js',
  './assets/screens-purchasing-control.js',
  './assets/screens-fin-new.js',
  './assets/screens-mfg-new.js',
  './assets/screens-crm-new.js',
  './assets/screens-hr-new.js',
  './assets/screens-fin-pay.js',
  './assets/screens-inv-adjust.js',
  './assets/screens-inv-new.js',
  './assets/screens-activity.js',
  './assets/app.js',
  './assets/pwa.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(staticUrls))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('./index.html', response.clone());
    return response;
  } catch (error) {
    return (await cache.match('./index.html')) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const cache = await caches.open(RUNTIME_CACHE);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
