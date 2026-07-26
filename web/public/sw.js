const CACHE_VERSION = 'erp-system-pwa-v131';
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
  './assets/inventory-ext.css',
  './assets/purchasing-ext.css',
  './assets/pwa.css',
  './assets/icons.js',
  './assets/data-core.js',
  './assets/data-master.js',
  './assets/data-sales.js',
  './assets/data-purchasing.js',
  './assets/data-purchasing-ext.js',
  './assets/data-manufacturing.js',
  './db/erp-system-demo-manufacturing.sql',
  './db/erp-system-demo-quality.sql',
  './db/erp-system-demo-sales-front.sql',
  './db/erp-system-demo-sales-delivery.sql',
  './db/erp-system-demo-sales-return.sql',
  './db/erp-system-demo-sales-debit.sql',
  './db/erp-system-demo-sales-pricing.sql',
  './db/erp-system-demo-sales-credit.sql',
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
  './assets/sales-data.js',
  './assets/erp-system-data-adapter.js',
  './assets/erp-system-api-adapter.js',
  './assets/receipt-drafts.js',
  './assets/ui.js',
  './assets/i18n.js',
  './assets/screens-common.js',
  './assets/screens-ops.js',
  './assets/screens-warehouse.js',
  './assets/screens-inv.js',
  './assets/screens-mfg.js',
  './assets/screens-qc.js',
  './assets/screens-qc-canonical.js',
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
  './assets/screens-sales-front-canonical.js',
  './assets/screens-sales-delivery-canonical.js',
  './assets/screens-sales-return-canonical.js',
  './assets/screens-sales-pricing-canonical.js',
  './assets/screens-sales-order-approval-canonical.js',
  './assets/screens-sales-analytics-canonical.js',
  './assets/screens-sales-commission-canonical.js',
  './assets/screens-purch-new.js',
  './assets/screens-purchasing-hub.js',
  './assets/screens-purchasing-lists.js',
  './assets/screens-purchasing-control.js',
  './assets/screens-purchasing-details.js',
  './assets/screens-fin-new.js',
  './assets/screens-mfg-new.js',
  './assets/screens-mfg-canonical.js',
  './assets/screens-crm-new.js',
  './assets/screens-hr-new.js',
  './assets/screens-fin-pay.js',
  './assets/screens-inv-adjust.js',
  './assets/screens-inv-new.js',
  './assets/screens-activity.js',
  './assets/screens-control-plane-canonical.js',
  './assets/app.js',
  './assets/pwa.js',
  './db/erp-system-schema.sql',
  './db/erp-system-migrations.sql',
  './db/erp-system-demo-txn.sql',
  './db/erp-system-demo-drafts.sql',
  './db/erp-system-demo-picks.sql'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        await cache.addAll(staticUrls);
        await precacheBundledRuntime(cache);
      })
  );
});

/* Vite gives the ESM runtime, PGlite WASM and database image content-hashed
   filenames. Discover that local module graph from the built index/JS rather
   than hard-coding hashes, so a completed service-worker install is a real
   offline proof for the bundled database runtime too. */
async function precacheBundledRuntime(cache) {
  const scope = new URL(self.registration.scope);
  const queue = [new URL('./index.html', scope).href];
  const seen = new Set();
  while (queue.length) {
    const href = queue.shift();
    if (seen.has(href)) continue;
    seen.add(href);
    const url = new URL(href);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) continue;

    let response = await cache.match(href);
    if (!response) {
      response = await fetch(href, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Unable to precache bundled ERP asset: ${url.pathname}`);
      await cache.put(href, response.clone());
    }
    if (!/\.(?:html|js)$/.test(url.pathname)) continue;

    const source = await response.clone().text();
    const references = new Set();
    const htmlPattern = /(?:src|href)=["']([^"'#]+)["']/g;
    const modulePattern = /(?:import\s*\(|new URL\s*\()\s*["']([^"']+\.(?:js|wasm|data))["']/g;
    let match;
    const pattern = url.pathname.endsWith('.html') ? htmlPattern : modulePattern;
    while ((match = pattern.exec(source))) references.add(match[1]);
    for (const reference of references) {
      const child = new URL(reference, href);
      if (child.origin === scope.origin && child.pathname.startsWith(scope.pathname)) {
        queue.push(child.href);
      }
    }
  }
}

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
  const url = new URL(request.url);

  /* TASK-024: never cache API responses. They're session-scoped (auth,
     dashboard) but the Cache API keys purely on URL, ignoring cookies — a
     stale-while-revalidate hit here would hand back a cached "200
     authenticated" response after the user signs out, since the browser's
     own cookie jar (correctly cleared) never gets consulted. Always hit the
     network for /api/* and /health. */
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    event.respondWith(fetch(request));
    return;
  }

  if (url.searchParams.has('__source_probe') || request.cache === 'reload' || request.cache === 'no-store') {
    event.respondWith(fetch(request));
    return;
  }

  if (url.searchParams.has('v')) {
    event.respondWith(networkFirstAsset(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

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
  } catch {
    return (await cache.match('./index.html')) || Response.error();
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await caches.match(request, { ignoreSearch: true })) || Response.error();
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
