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

## EPIC-003 — Core ERP Modules ✅

Build the user-facing module screens around the implemented ERP domain.

Acceptance criteria:

- [x] Inventory screen lists products, warehouses, stock levels, and movements.
- [x] Sales screen lists customers and sales orders.
- [x] Sales order confirmation demonstrates stock deduction (+ rollback on over-sell).
- [x] Invoice screen shows generated invoices.
- [x] Finance screen shows chart of accounts and GL entries.
- [x] Every routed screen opens error-free under canonical data; leftover Northwind
      sample shapes cleaned or labeled (TASK-018) — `npm run audit:screens` (new,
      wired into CI) drives all 114 routes through the live `SCREENS` registry;
      0 crashes, 0 leftover-identity leaks on canonical screens as of 2026-07-17.
      Routes belonging to modules with no schema yet (see docs/STATUS.md) are an
      intentional, allowlisted exception, not a gap in this criterion.

## EPIC-004 — Setup Wizard ✅

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
- [x] Production locks setup after first admin — `GET /api/setup/status` (TASK-024)
      exposes `hasAdmin`, no auth required; the api adapter's `needsSetup()` calls
      it and `app.js`'s `boot()` gates on the real answer. Verified against a
      seeded Docker stack: the wizard correctly stayed hidden.

## EPIC-005 — Production API And Docker 🔶 (stack + Makefile done; server-side writes open)

Add the production runtime path. (TASK-011 done, TASK-012 done, TASK-013 done,
TASK-021 done)

Acceptance criteria:

- [x] API exposes a dashboard read endpoint (`GET /api/dashboard`) — write
      endpoints (confirm order, complete setup, switch company) are scaffolded as
      a client-side contract (`erp-system-api-adapter.js`) but not yet implemented
      server-side.
- [x] API connects to PostgreSQL through configured `DATABASE_URL`
      (`src/server.ts`, `npm run server`).
- [x] Docker Compose starts `web`, `api`, and `db` — `docker-compose.yml`,
      `Dockerfile.api`, `web/Dockerfile`, `web/nginx.conf` (same-origin reverse
      proxy, no CORS needed); verified with a real build + run + teardown.
- [x] Migrations run against PostgreSQL — verified both on the host and inside the
      `api` container (`docker compose exec api npm run migrate`).
- [ ] Stock and finance writes are server-side transactions (needs the write
      endpoints above).
- [x] PostgreSQL concurrency test prevents stock over-sell — proven by
      `POSTGRES_URL=... npm run demo` (exactly 1 of 2 racing issues wins), verified
      live twice (TASK-011 host run, TASK-013).
- [x] `Makefile` and `scripts/setup.sh` targets work against the real compose assets
      — TASK-021 done 2026-07-17: `scripts/setup.sh` run for real end-to-end
      (fresh `.env` creation, build, health-wait, migrate, seed) plus every
      individual `make` target (`help`/`up`/`down`/`restart`/`logs`/`migrate`/
      `seed`/`reset`/`ps`/`psql`) exercised against a live, isolated stack —
      see docs/STATUS.md.

## EPIC-006 — CI, Testing, And Release 🔶 (CI/smoke/unit-tests all live; release checklist + device open)

Add repeatable validation and deployment checks. (TASK-014, TASK-015, TASK-020,
TASK-025 done; TASK-017 permanently blocked — needs a physical phone, no agent can
complete it)

Acceptance criteria:

- [x] CI runs root typecheck, web typecheck, and demo build — `.github/workflows/ci.yml`
      (TASK-014), triggered on every PR + push to main, separate from the deploy-only
      `deploy-pages.yml`.
- [x] CI can run transaction proof tests — same workflow runs `npm run demo`
      (PGlite proof) on every PR.
- [x] Unit tests (vitest) cover `src/modules/*` business logic (TASK-025 done
      2026-07-17 — 15 tests: `confirmSalesOrder` success/rollback/posting-error +
      explicit GL-balance assertion, `issueStock` deduct/insufficient/boundary,
      `getEffectiveTaxRate` dated-boundary cases; wired into CI).
- [x] Browser smoke test covers desktop and mobile demo load (TASK-015 done
      2026-07-17 — `scripts/smoke.mjs`, Playwright, wired into CI with browser
      caching; checks zero console/page errors and that the dashboard actually
      renders, not just "no crash").
- [ ] Release checklist distinguishes GitHub Pages demo and Docker production.
- [x] Docs stay aligned with package scripts and deployment assets — actively kept
      current through TASK-009…014.

## EPIC-007 — Data Seam Integrity ✅ (core acceptance criteria met)

Close the gap between the documented dual-mode design and the code: one adapter
interface, two backends, no silent schema drift. (TASK-019, TASK-020, TASK-026 done)

Acceptance criteria:

- [x] Frontend reads `VITE_DATA_MODE` and selects the demo (PGlite) or api (HTTP)
      adapter (`erp-system-data-adapter.js` / `erp-system-api-adapter.js`, mutually
      exclusive self-disable guards, chosen via `window.erpDataMode()`).
- [x] The api adapter exposes every method the demo adapter exposes with the same
      signature (`ready/reset/refresh/confirmOrder/completeSetup/switchCompany/mode/db`);
      every write currently rejects with a clear "not available yet" error since
      TASK-011's server doesn't have write endpoints — this is the documented
      contract for it to implement.
- [x] A repeatable check detects drift between `drizzle/0000_init.sql` and
      `web/public/db/erp-system-schema.sql`, and runs in CI (TASK-020 done
      2026-07-17 — `scripts/check-drift.mjs`, semantic table/column comparison,
      wired into `.github/workflows/ci.yml`). Does not yet cover
      `src/data/seed.ts` vs `erp-system-seed.sql` (only the schema, not the seed
      data) — worth a follow-up if seed drift becomes a real incident.
- [x] `confirmOrder`/`completeSetup`/`switchCompany` exist in exactly one place per
      runtime (demo adapter vs. api adapter), never both active at once.
- [x] `VITE_DATA_MODE=api` renders the real dashboard once a server is reachable
      (TASK-026 done 2026-07-16) — including a working company switcher
      (`switchCompany` re-fetches with a different scope, no new endpoint needed);
      other modules (inventory/sales/finance) still have no api-mode data source.

## EPIC-008 — Purchasing Module ✅ (core chain done; RFQ/quotes/returns/analytics stay mock)

First new domain built end-to-end after the sales chain: supplier → purchase order →
goods receipt (stock IN) → supplier invoice (GL). Replaces the mock purchasing screens
for that core chain specifically — RFQs, quotations, requisitions, purchase returns,
credit/debit notes, price lists, landed cost, vendor performance, and the purchasing
analytics reports have no schema and stay on sample data, same as every other
not-yet-converted module (see docs/STATUS.md). (TASK-022 done, TASK-023 done)

Acceptance criteria:

- [x] Drizzle migration adds supplier, purchase_order, purchase_order_line, goods_receipt
      (+ supplier_invoice) — `drizzle/0002_messy_slyde.sql`, 23 tables total, TASK-022.
- [x] Receiving stock increases `stock_level` and writes `stock_movement` in one
      transaction — `src/modules/purchasing/receiveGoods.ts`, upserts `stock_level`
      from zero on first receipt, guards against receiving the same PO twice.
- [x] Supplier invoice posts balanced GL (AP credit / inventory-expense debit + tax) —
      `src/modules/purchasing/postSupplierInvoice.ts`, gated on the PO already being
      received.
- [x] Purchasing screens read canonical data in demo mode for the core chain — TASK-023
      done 2026-07-17: suppliers/purchase-orders/goods-receipts/supplier-invoices lists
      render real data, the new-PO wizard and the "Receive goods"/"Post supplier
      invoice" row actions call the real adapter transactions (mirroring
      `confirmOrder`'s pattern) instead of fake toasts. Verified live: receiving goods
      visibly moves stock on the real Inventory > Stock on Hand screen; posting an
      invoice visibly balances on the real General Ledger screen.
- [x] `src/demo.ts` gains purchasing assertions — `runPurchasingScenario`, both engines,
      including both rollback guards, wired into the same `check()` block as sales.

## EPIC-009 — Auth And Users ✅

Replace the hardcoded Admin stub with real (but minimal) authentication. (TASK-024 done)

Acceptance criteria:

- [x] Login validates against `app_user`; passwords hashed (PBKDF2-HMAC-SHA256,
      100k iterations — `src/auth/password.ts`, cross-compatible browser-side via
      Web Crypto in the demo adapter).
- [x] Session carries `master_fn`/`company_fn`/role; company switcher respects
      `user_company` — `masterFn` is server-derived only, `companyFn` is only
      honored if the session's `user_company` rows allow it (verified via curl:
      an unauthorized company request silently falls back, no leakage).
- [x] Demo mode may auto-login a labeled demo user; production requires login —
      demo auto-logs in and supports switching between seeded users; production's
      `renderLogin()` is mode-aware (no prefill, no frictionless button).
- [x] Production locks the setup wizard once the first admin exists (ties to
      EPIC-004) — see EPIC-004's now-checked last item.

## EPIC-010 — CRM Module ✅

Second new domain after Purchasing (EPIC-008): opportunity pipeline → convert to
sales order, feeding the same Sales module Purchasing feeds Inventory into.
Replaces the mock CRM screens for that core chain. (TASK-027, TASK-028 both done)

Acceptance criteria:

- [x] Drizzle migration adds `opportunity` (linked to `customer`) and a lightweight
      activity log, tenant-scoped indexes — `drizzle/0003_fuzzy_ronan.sql`, 25 tables
      total, TASK-027.
- [x] Converting an opportunity creates a real `sales_order` in one transaction;
      converting the same opportunity twice is rejected (mirrors `receiveGoods`'s
      open/received status guard) — `src/modules/crm/convertOpportunityToSalesOrder.ts`,
      composed atomically with `confirmSalesOrder`'s newly-extracted
      `confirmSalesOrderWithin` core (a failure inside the composed transaction
      leaves the opportunity provably untouched, not half-converted).
- [x] CRM screens (pipeline board, new-opportunity wizard) read canonical PGlite
      data in demo mode; the "Convert to sales order" action is real, calling
      `window.ErpSystemDemo.convertOpportunityToSalesOrder` — TASK-028. Verified
      live in-browser: the converted order appears in Sales > Sales Orders (not
      just CRM), stock decrements, and GL stays balanced; the insufficient-stock
      guard was also exercised live (clear toast, opportunity left untouched).
      Customer-360 view was not part of TASK-027/028's schema scope and remains
      mock, consistent with how Purchasing left its own non-canonical sub-screens.
- [x] `src/demo.ts` gains CRM assertions, following the `runPurchasingScenario`
      pattern (success + two rollback/guard scenarios), proven on both PGlite and
      PostgreSQL.

## EPIC-011 — Item Master ✅

Converts the last mock-data screen in Inventory: `item-master` still reads
`web/public/assets/data-master.js`'s static `DB.items` and its create/edit form only
mutates that in-memory array. `screens-inv.js`'s `prepareCanonicalInventoryData()` —
already used by the Canonical Stock-on-Hand/Valuation/Movements screens — already
builds the same `DB.items` shape from real `product`/`stock_level`/
`stock_location_balance` data, but hardcodes `cat`/`reorder`/`roq` because `product`
has no category or reorder columns yet. (TASK-029, TASK-030)

Acceptance criteria:

- [x] `product` gains `category` (checked against the 5 values the UI already offers),
      `reorder_point`, `reorder_qty` and `version` columns via a Drizzle migration —
      `drizzle/0019_aromatic_wendigo.sql`; `src/modules/inventory/product.ts` provides
      tenant-scoped `createProductWithin`/`updateProductWithin` mirroring
      `createOpportunity.ts`/`activatePriceListWithin`'s conventions.
- [x] `inventory/products` is registered as a create+update (optimistic-locked)
      resource in `src/api/resources.ts`/`creates.ts`/`actions.ts`, gated on a new
      `inventory.write` permission.
- [x] `item-master` reads real data via `prepareCanonicalInventoryData()` instead of
      the mock file, and its create/edit form calls the real adapter actions; the
      3 already-Canonical screens sharing that function also stop showing fake
      `Unclassified`/`0` category/reorder values.
- [x] `item-master` moves to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES` in `app.js`.

## EPIC-012 — Customer 360 ✅

Converts CRM's remaining mock screen: `crm-customer` (Customer-360) was explicitly out
of scope for EPIC-010/TASK-027/028 and still reads a single hardcoded mock record
(`DB.cust0007`). This epic gives it real contacts, a real activity log shared with the
existing (previously unused) `activity` table, and real balance/overdue figures reusing
the AR-Aging report's existing Net-30 client-side formula rather than inventing new
credit-exposure logic. (TASK-031, TASK-032)

Acceptance criteria:

- [x] `customer` gains nullable `industry`/`owner_user_id`; a new tenant-scoped
      `contact` table links to `customer`; `activity.opportunity_id` becomes nullable
      and gains a nullable `customer_id` with a check that at least one target is set
      — `drizzle/0020_fast_naoko.sql`.
- [x] `src/modules/crm/contact.ts` and `src/modules/crm/activity.ts` provide
      tenant-scoped `createContactWithin`/`createCustomerActivityWithin`; `crm/contacts`
      and `crm/activities` are registered as create resources, alongside a
      `customerId` filter added to `sales/orders`, `sales/invoices` and
      `crm/opportunities` for customer-scoped reads.
- [x] `crm-customer` reads real customer/contacts/orders/opportunities/unpaid-invoices/
      activity data instead of `DB.cust0007`; "Log activity" and "Add contact" call
      the real adapter actions.
- [x] `crm-customer` moves to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES` in `app.js`.

## EPIC-013 — Item Master / Customer-360 Localization ✅

Item Master and Customer-360 (EPIC-011/012) landed Canonical for schema, writes and
permissions, but their UI strings are English-only — unlike most other Canonical
routes, which carry real multi-language coverage via a screen-local `copy()`
translation pack (see `screens-sales-front-canonical.js`). This epic closes that gap.
(TASK-033)

Acceptance criteria:

- [x] `item-master` (`screens-inv.js`) and `crm-customer` (`screens-crm.js`) each gain
      a local `copy()`-style translation pack (en/ms/zh/ja/vi), matching the exact
      shape already used by the sibling Canonical screens.
- [x] Existing global `t()`/`ts()`/`tf()` keys are reused wherever they already match
      (`inv.newitem`, `crm.newopp`, `common.cancel`, `common.export`, `common.items`,
      `nav.crm`, `st.*` status values via `statusBadge()`), not re-declared locally.
- [x] A missing `st.No stock` key is added to the shared `I18N` object (all 3 real
      languages) since Item Master's "No stock" status had no translation at all.
- [x] Customer-360's open-orders/open-opportunities status labels route through
      `ts()`/`statusBadge()` instead of the English-only `crmTitleCase()` bypass
      (removed as dead code).
- [x] Switching language (en/ms/zh) on both screens actually changes every visible
      label/button/toast, verified live in the browser, not just by code inspection.

## EPIC-014 — Single-Source Demo Seed ✅

`src/data/seed.ts` (the Node-side seed used by `npm run demo`) and
`web/public/db/erp-system-seed.sql` (hand-written SQL the browser demo executes on
first boot) were two independently-maintained copies of the same data — TASK-028's own
notes record a real incident where the SQL copy silently missed an insert `seed.ts`
already had. This epic eliminates the duplication by running `seedDemo()` itself in
the browser, the same way every Canonical write already runs real `src/modules/**`
TypeScript commands against in-browser PGlite instead of a hand-written SQL mirror.
(TASK-034)

Acceptance criteria:

- [x] `erp-demo-runtime-impl.ts` exposes `seedDemo` as a command; the browser adapter's
      `ensureSeeded()` calls it directly instead of fetching and executing
      `erp-system-seed.sql`.
- [x] The WH-SALES warehouse + opening-stock fixture (demo-only bonus content, not
      part of `seedDemo()` itself) moves into `erp-system-demo-txn.sql`, which already
      depends on it existing.
- [x] `erp-system-seed.sql` is deleted; `sw.js`'s precache list and `CACHE_VERSION` are
      updated so the service worker doesn't 404 trying to precache a deleted file.
- [x] A fresh browser boot produces identical seeded data to before, and additionally
      now has all 8 `role_permission` rows that were previously silently missing.

## EPIC-015 — Fixed Assets Module

Third domain converted from mock to real under Phase 7 "Module Expansion" (after
Purchasing/EPIC-008 and CRM/EPIC-010): asset register → depreciation run → balanced GL
posting, mirroring the exact `postSupplierInvoice`-style "one document, one balanced
journal" pattern. Unlike the mock, which stores a fabricated 5-year future schedule as
static data, the real version follows the same aggregate+ledger shape already proven
by Inventory (`stock_level`/`stock_movement`): `asset.accumulated_depreciation` is the
running total, `depreciation_run_line` is the real append-only posting history. The
mock also has no acquisition flow at all ("New Asset" is a toast stub) and its
asset-detail screen hardcodes a GL account code ("6400") that doesn't match any account
in its own chart of accounts — both fixed here. (TASK-035, TASK-036)

Acceptance criteria:

- [x] `asset`, `depreciation_run` and `depreciation_run_line` tables added via a
      Drizzle migration, following `purchasing.ts`'s tenant/versioning/check-constraint
      conventions. `src/modules/assets/` provides tenant-scoped
      `createAssetWithin`/`createDepreciationRunWithin`/`postDepreciationRunWithin`,
      the last posting one balanced `gl_entry` pair (Dr 6200 Depreciation Expense /
      Cr 1510 Accumulated Depreciation) per run via the same `accountIdByCode` lookup
      pattern `postSupplierInvoice.ts` uses — `drizzle/0021_busy_lilandra.sql`.
- [x] `assets/assets`, `assets/depreciation-runs` and `assets/depreciation-run-lines`
      are registered as resources (create + post-action) behind new `asset.read`/
      `asset.write` permissions (neither existed in the backend registry before this).
- [x] Seed adds the real `1500`/`1510`/`6200` accounts (matching the mock's own COA/
      PnL, not the inconsistent "6400" label baked into its screen) and a handful of
      seeded assets.
- [ ] `asset-register` reads real data and gains a real "New Asset" create form (no
      mock precedent existed — new UI); row-open passes a real per-asset id instead of
      always opening the same hardcoded record. `asset-detail` shows real acquisition
      fields and real posted depreciation history (not a fabricated future schedule).
      `depreciation` actually computes and posts a real run instead of re-announcing a
      hardcoded number.
- [ ] All 3 routes move to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES`.
