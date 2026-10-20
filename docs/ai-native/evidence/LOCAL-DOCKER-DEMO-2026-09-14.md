# Local Docker Demo evidence — 2026-09-14

## Scope

This evidence covers the client-demo runtime requested for a local Docker Desktop
machine. It is a static Demo build only; it is not production or PostgreSQL
readiness evidence.

- **Observed:** 2026-09-14, Asia/Singapore
- **Actor:** Codex `/root`
- **Tested revision:** `d01f1f1` (`Add local Docker Demo stack`)
- **Environment:** Docker Desktop 28.3.0, Docker Compose v2.38.1, `node:20-alpine`, `nginx:alpine`, headless Chromium
- **Dirty state during verification:** only the six files in the local-Docker change set; clean after commit
- **Credentials/provider:** none; no API, PostgreSQL, worker or production configuration started

## Expected result

`docker compose -f docker-compose.demo.yml up -d --build` should build the existing
Web frontend with `VITE_DATA_MODE=demo`, serve it from nginx, and expose a healthy
local URL without requiring GitHub Pages, API credentials or a database container.
The browser Demo boot progress bar and setup provisioning stepper must remain in the
published bundle.

## Verification

The following commands passed:

```text
docker compose -f docker-compose.demo.yml up -d --build
docker compose -f docker-compose.demo.yml ps
curl -fsS http://localhost:8081/health
docker compose -f docker-compose.yml build web
npm run docs:check
git diff --check
```

Observed container state was `Up (healthy)` on `0.0.0.0:8081->80/tcp`; `/health`
returned `ok`. The local `release.json` reported `revision=local-demo`,
`dataMode=demo`, `fileCount=134`, and included both a `.wasm` asset and a PGlite
`.data` asset.

Headless Chromium loaded `http://127.0.0.1:8081/` and observed:

- document title `Aria ERP`;
- `window.erpDataMode()` = `demo`;
- `window.ErpSystemData` ready after boot;
- `.demo-boot-progress` present;
- `#app` visible after boot;
- zero console errors and page errors.

The production Compose Web image was also built with the default API branch and
completed successfully, protecting the existing API/PostgreSQL image path.

## Acceptance boundary

This proves a reproducible local static Demo container and its browser boot path.
PGlite/WASM executes in the browser and stores Demo data in that browser's IndexedDB;
the container serves assets only. No production provider, PostgreSQL, multi-user
concurrency, remote deployment, or client data claim is made.
