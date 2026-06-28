# PWA Standard

This project treats the GitHub Pages demo as an installable PWA shell. Production Docker
deploys can use the same shell, but production data still flows through the API.

## 1. Required Surface

Minimum PWA surface:

- `manifest.webmanifest` linked from `web/index.html`
- `name`, `short_name`, `id`, `start_url`, `scope`, `display`, `theme_color`,
  `background_color`, and icons
- `192x192` and `512x512` PNG icons
- one maskable icon for Android adaptive icons
- service worker registered from the same scope as the app
- HTTPS in production; localhost is acceptable only for local testing
- offline shell for navigation requests
- update flow when a new waiting service worker is available

References:

- MDN: <https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest>
- MDN: <https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers>
- web.dev update flow: <https://web.dev/learn/pwa/update>

## 2. Update Flow

ERP System uses a user-controlled update flow:

1. Browser installs a new service worker in the background.
2. The old app keeps running.
3. `web/public/assets/pwa.js` detects `registration.waiting`.
4. The UI shows a small toast with **Update now** and **Later**.
5. **Update now** posts `SKIP_WAITING` to the waiting worker.
6. `controllerchange` reloads the page once.

This avoids surprise reloads in the middle of an ERP workflow.

## 3. Offline Strategy

Service worker file: `web/public/sw.js`.

Rules:

- Navigation requests use network-first, then cached `index.html`.
- Same-origin static assets use stale-while-revalidate.
- JS/CSS/module requests are never served `index.html` as a fallback. That avoids blank
  screens caused by loading HTML where JavaScript was expected.
- Demo data is still mock/demo only. Offline does not make IndexedDB a production ERP
  database.

## 4. iOS And Android Safe Area

`web/index.html` uses:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
```

CSS reads safe-area insets through:

```css
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

Reference: <https://developer.mozilla.org/en-US/docs/Web/CSS/env>

ERP System rules:

- Topbar includes `safe-area-inset-top` on mobile.
- Page shell includes left/right safe-area padding on mobile.
- Bottom tabbar height includes `safe-area-inset-bottom`; buttons fill the usable height.
- Floating PWA update/install toast sits above the bottom tabbar on mobile.
- Detail sheets and command palette respect bottom safe area.

Do not implement iOS bottom navigation by adding bottom padding only. The bar itself must
occupy the home-indicator area so there is no empty strip below the buttons.

## 5. Files

| File | Purpose |
| --- | --- |
| `web/public/manifest.webmanifest` | Install metadata, app identity, icons, shortcuts |
| `web/public/sw.js` | Offline shell, runtime cache, update activation |
| `web/public/assets/pwa.js` | Registration, install prompt, update prompt |
| `web/public/assets/pwa.css` | Toast UI and safe-area overrides |
| `web/public/icons/` | PWA icons |

## 6. Verification

Before publishing:

- `npm run typecheck:web`
- `GITHUB_PAGES=true npm run build:demo`
- `web/dist/manifest.webmanifest` exists
- `web/dist/sw.js` exists
- `web/dist/icons/icon-192.png`, `icon-512.png`, and `maskable-512.png` exist
- Browser loads `/ERP-System/` with no failed requests
- `navigator.serviceWorker.ready` resolves on the Pages path
- mobile viewport has no horizontal overflow
- update toast appears when a waiting worker exists
