# Epics

Each epic describes a large work group. Small executable tasks live in
`tasks/tasks.jsonl`. Status legend: ✅ done · 🔶 in progress · ⬜ not started.
Current ground truth per epic → [STATUS.md](STATUS.md).

## EPIC-001 — Frontend Foundation ✅ (seam wiring moved to EPIC-007)

Build the real frontend workspace in `web/`, using the user's Aria ERP prototype as the
starting UI baseline.

Acceptance criteria:

- [x] Vite app builds in demo mode.
- [x] Aria ERP layout is cloned into the real frontend.
- [x] Demo mode can boot in the browser.
- [x] Follow-up tasks replace prototype data with this project's PGlite/API data
      (done for sales/inventory/finance; rest tracked in TASK-018/EPIC-008).
- [ ] Data access is behind a `VITE_DATA_MODE` seam → **moved to EPIC-007 (TASK-019)**.

## EPIC-002 — Demo Mode And GitHub Pages ✅

Make the public demo static-hosting friendly.

Acceptance criteria:

- [x] `npm run build:demo` emits a static bundle.
- [x] PGlite persists demo data to IndexedDB.
- [x] Reset demo clears and reseeds browser data.
- [x] GitHub Pages base path and refresh behavior are handled.
- [x] GitHub Actions can deploy the static demo.
- [x] PWA shell, update prompt, mobile safe areas (TASK-016).

## EPIC-003 — Core ERP Modules 🔶 (screens done; audit open)

Build the user-facing module screens around the implemented ERP domain.

Acceptance criteria:

- [x] Inventory screen lists products, warehouses, stock levels, and movements.
- [x] Sales screen lists customers and sales orders.
- [x] Sales order confirmation demonstrates stock deduction (+ rollback on over-sell).
- [x] Invoice screen shows generated invoices.
- [x] Finance screen shows chart of accounts and GL entries.
- [ ] Every routed screen opens error-free under canonical data; leftover Northwind
      sample shapes cleaned or labeled (TASK-018).

## EPIC-004 — Setup Wizard 🔶 (demo path done; production lock open)

Implement first-run setup shared by demo and production. (TASK-009 done, TASK-010 done)

Acceptance criteria:

- [x] Empty app launches setup wizard (`needsSetupWizard()` gate in `app.js` boot(),
      before the sign-in check).
- [x] User can choose language (en/ms/zh — the 3 implemented in `i18n.js`).
- [x] User can create master/company, persisted to PGlite via
      `ErpSystemDemo.completeSetup()` in one transaction.
- [x] Country selection configures currency and tax regime (SG→SGD/GST 9%,
      MY→MYR/SST 8%, live preview, written as an effective-dated `tax_rule`).
- [x] First admin user can be created, persisted as `app_user` + `user_company` +
      a `Superadmin` role.
- [x] Demo can reset wizard state (Settings → "Re-run setup wizard" clears the flag
      without touching data; "Reset demo data" clears it too).
- [x] Company switcher (topbar) reflects the created company — rewired from a
      disconnected mock array to `DB.erpSystem.companies`, with a real
      `switchCompany()` scope switch.
- [ ] Production locks setup after first admin — blocked on TASK-011/TASK-019 (no
      backend yet); the demo/API adapter *contract* (`completeSetup()` input/output
      shape) is defined and documented for the future API adapter to implement.

## EPIC-005 — Production API And Docker 🔶 (API scaffolded; Docker/writes open)

Add the production runtime path. (TASK-011 done, TASK-012/013/021 todo)

Acceptance criteria:

- [x] API exposes a dashboard read endpoint (`GET /api/dashboard`) — write
      endpoints (confirm order, complete setup, switch company) are scaffolded as
      a client-side contract (`erp-system-api-adapter.js`) but not yet implemented
      server-side.
- [x] API connects to PostgreSQL through configured `DATABASE_URL`
      (`src/server.ts`, `npm run server`).
- [ ] Docker Compose starts `web`, `api`, and `db` (TASK-012).
- [x] Migrations run against PostgreSQL — verified for real against a local
      instance (`drizzle.config.ts` needed a `dbCredentials.url` fix; `npm run
      migrate` now works).
- [ ] Stock and finance writes are server-side transactions (needs the write
      endpoints above).
- [x] PostgreSQL concurrency test prevents stock over-sell — proven by
      `POSTGRES_URL=... npm run demo` (exactly 1 of 2 racing issues wins), verified
      live during TASK-011.
- [ ] `Makefile` and `scripts/setup.sh` targets work against the real compose assets
      (TASK-021, blocked on TASK-012).

## EPIC-006 — CI, Testing, And Release ⬜

Add repeatable validation and deployment checks. (TASK-014, TASK-015, TASK-017, TASK-025)

Acceptance criteria:

- CI runs root typecheck, web typecheck, and demo build.
- CI can run transaction proof tests.
- Unit tests (vitest) cover `src/modules/*` business logic.
- Browser smoke test covers desktop and mobile demo load.
- Release checklist distinguishes GitHub Pages demo and Docker production.
- Docs stay aligned with package scripts and deployment assets.

## EPIC-007 — Data Seam Integrity 🔶 (seam wired; drift check open)

Close the gap between the documented dual-mode design and the code: one adapter
interface, two backends, no silent schema drift. (TASK-019 done, TASK-020 todo)

Acceptance criteria:

- [x] Frontend reads `VITE_DATA_MODE` and selects the demo (PGlite) or api (HTTP)
      adapter (`erp-system-data-adapter.js` / `erp-system-api-adapter.js`, mutually
      exclusive self-disable guards, chosen via `window.erpDataMode()`).
- [x] The api adapter exposes every method the demo adapter exposes with the same
      signature (`ready/reset/refresh/confirmOrder/completeSetup/switchCompany/mode/db`);
      every write currently rejects with a clear "not available yet" error since
      TASK-011's server doesn't exist — this is the documented contract for it to
      implement.
- [ ] A repeatable check detects drift between `drizzle/0000_init.sql` +
      `src/data/seed.ts` and `web/public/db/erp-system-*.sql`, and runs in CI (TASK-020).
- [x] `confirmOrder`/`completeSetup`/`switchCompany` exist in exactly one place per
      runtime (demo adapter vs. api adapter), never both active at once.
- [ ] `VITE_DATA_MODE=api` renders the real dashboard once a server is reachable,
      not just the "waiting for API" screen (TASK-026, now that TASK-011 gives it
      something real to call).

## EPIC-008 — Purchasing Module ⬜

First new domain built end-to-end after the sales chain: supplier → purchase order →
goods receipt (stock IN) → supplier invoice (GL). Replaces the mock purchasing screens.
(TASK-022, TASK-023)

Acceptance criteria:

- Drizzle migration adds supplier, purchase_order, purchase_order_line, goods_receipt.
- Receiving stock increases `stock_level` and writes `stock_movement` in one transaction.
- Supplier invoice posts balanced GL (AP credit / inventory-expense debit + tax).
- Purchasing screens read canonical data in demo mode; mock purchasing data removed.
- `src/demo.ts` gains purchasing assertions.

## EPIC-009 — Auth And Users ⬜

Replace the hardcoded Admin stub with real (but minimal) authentication. (TASK-024)

Acceptance criteria:

- Login validates against `app_user`; passwords hashed.
- Session carries `master_fn`/`company_fn`/role; company switcher respects `user_company`.
- Demo mode may auto-login a labeled demo user; production requires login.
- Production locks the setup wizard once the first admin exists (ties to EPIC-004).
