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
- [x] User can choose language (en/ms/zh/ja/vi; complete Canonical coverage is
      tracked by EPIC-057).
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

## EPIC-005 — Production API And Docker ✅

Add the production runtime path. (TASK-011 done, TASK-012 done, TASK-013 done,
TASK-021 done; last item closed by the TASK-040 audit — the claim that write
endpoints were client-contract-only had gone stale while the work landed
incrementally across the resource/dispatcher tasks.)

Acceptance criteria:

- [x] API exposes a dashboard read endpoint (`GET /api/dashboard`) — and the
      once-"scaffolded only" write endpoints are now implemented server-side:
      confirm order (`sales/orders/confirm`), complete setup
      (`POST /api/setup/actions/complete`, token-gated, zero-user locked) and the
      audited session company switch all run through the production API.
- [x] API connects to PostgreSQL through configured `DATABASE_URL`
      (`src/server.ts`, `npm run server`).
- [x] Docker Compose starts `web`, `api`, and `db` — `docker-compose.yml`,
      `Dockerfile.api`, `web/Dockerfile`, `web/nginx.conf` (same-origin reverse
      proxy, no CORS needed); verified with a real build + run + teardown.
- [x] Migrations run against PostgreSQL — verified both on the host and inside the
      `api` container (`docker compose exec api npm run migrate`).
- [x] Stock and finance writes are server-side transactions — audited 2026-07-19
      (TASK-040): the unified transactional dispatcher registers 24 create
      resources and 28 actions in `src/api/creates.ts`/`actions.ts`, covering
      sales confirmation/conversion/returns/credit-and-debit notes, purchasing
      receipt and supplier-invoice posting, CRM conversion, inventory
      adjustments/transfers, warehouse picking, manufacturing execution, quality
      disposition and fixed-asset depreciation posting. No stock or money write
      available in api mode executes client-side. Remaining gaps are feature
      breadth (e.g. manual journal entries, payment vouchers — their screens are
      still Preview), tracked under Phase 7 module expansion, not missing
      server-side transaction plumbing.
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
- [x] Release checklist distinguishes GitHub Pages demo and Docker production —
      [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) (TASK-039): shared quality
      gate + separate demo-bundle and Docker-production sections including backup,
      migrate-only-upgrades, health verification and rollback.
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
- [x] Follow-up (TASK-057, 2026-07-20): the same failure class recurred, single-source
      or not — `seedDemo()`'s own Viewer grant list simply never gained `manufacturing.read`
      when Manufacturing turned Canonical (2026-07-19), since nothing enforces that a new
      Canonical module's read permission gets added to the demo Viewer persona's grants.
      Fixed directly (Viewer now sees Manufacturing); no structural gap here to close since
      there's only one seed to update, but worth noting as this epic's failure mode is not
      fully closed by removing the duplicate copy alone.

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
- [x] `asset-register` reads real data and gains a real "New Asset" create form (no
      mock precedent existed — new UI); row-open passes a real per-asset id instead of
      always opening the same hardcoded record. `asset-detail` shows real acquisition
      fields and real posted depreciation history (not a fabricated future schedule).
      `depreciation` actually computes and posts a real run instead of re-announcing a
      hardcoded number.
- [x] All 3 routes move to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES`.

## EPIC-016 — Admin: Users, Roles & Audit Log

`user-mgmt`, `role-permission` and `audit-log` are the last mock-data screens whose
*backend already exists in full* — TASK-024 (EPIC-009) built real `app_user`/`role`/
`role_permission`/`audit_log` tables, `hasPermission()`, and a tested `src/auth/
lifecycle.ts` (invitations, password reset) — but no screen ever called any of it. This
epic wires the screens to that existing backend rather than adding new schema. Two real
design gaps found along the way, both closed here rather than deferred: (1) these admin
tables are deliberately excluded from the generic `resource()`/RLS-company-scope
framework (documented in `deploy/sql/production-rls.sql`) and structurally don't fit it
(non-`id` PKs, `role_permission`'s composite PK) — so this epic adds **bespoke** routes
mirroring `src/api/routes/auth.ts`'s existing style, not `ResourceDefinition` entries;
(2) `audit_log` was found to be **permanently empty in browser demo mode** — `appendAudit`
was only ever called from the production HTTP layer, never by the demo adapter's direct
`*Within` calls — fixed by wiring `appendAudit`-equivalent writes into the demo adapter's
own generic create/action dispatch, which also retroactively gives every existing module
a real audit trail in demo mode. The mock's 4-level (None/View/Edit/Full) permission
matrix doesn't match the real boolean-per-key `role_permission` model — the real screen
uses an honest 2-state (allowed/not-allowed) grid instead of forcing a fake 4th level.
`master-control`, `sys-settings` and `module-activation-control` stay mock (need new
schema or a data-repointing decision — out of scope for this pass). (TASK-041, TASK-042)

Acceptance criteria:

- [x] `src/auth/permissions.ts` gains `usersRead`/`usersManage`/`rolesRead`/
      `rolesWrite` keys; `src/auth/adminLifecycle.ts` (new — split out of
      `lifecycle.ts` so this file's import graph stays node:crypto-free and can be
      bundled into the browser; see below) gains tenant-scoped
      `setUserActiveWithin`/`setUserActive` (rejects self-disable), `createRoleWithin`/
      `createRole` (unique name per master), `setRolePermissionWithin`/
      `setRolePermission` (rejects editing the superadmin role, validates
      `permissionKey` against the real `PERMISSIONS` allowlist) — all audited, each
      following the same raw-exec-`...Within` + self-transacting-wrapper split every
      other module in this repo uses.
- [x] `src/api/admin.ts` (new, mirrors `src/api/dashboard.ts`'s plain-function shape)
      provides `listCompanyUsers` (real users + pending invitations), `listRoles`,
      `listRolePermissions`, `listAuditLog`; `src/api/routes/admin.ts` (new, mirrors
      `routes/auth.ts`) exposes them plus the write actions as `/api/admin/*`, mounted
      in `src/api/app.ts`.
- [x] Demo adapter (`erp-system-data-adapter.js` + `erp-demo-runtime-impl.ts`) gains
      matching bespoke dispatch for `admin/*` keys (not added to `RESOURCE_TABLES`) and
      real `appendAudit` calls in its generic create/action dispatch, fixing demo-mode's
      previously-always-empty audit log for every module, not just Admin. A demo-only
      `createInvitationRecordWithin` (Web Crypto token instead of node:crypto,
      `src/auth/adminLifecycle.ts`) replaces the real `createInvitation` for the browser
      path only — production still uses the real one.
- [x] `user-mgmt` reads real users+invitations; "Invite user" calls the real (already
      built, previously unused) `createInvitation`; a new enable/disable action is real.
- [x] `role-permission` shows a real 2-state permission grid per role; "Add role" and
      permission toggles are real writes; the superadmin role renders read-only.
- [x] `audit-log` reads real `audit_log` rows (bounded, client-side filters).
- [x] All 3 routes move to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES` (50 → 53).

## EPIC-017 — Frontend SSOT Consolidation ✅

A three-agent audit (2026-07-19) of every `web/public/assets/screens-*.js` file, requested
after stakeholder feedback that Sidebar/TopBar/page (List/Detail/Edit) logic doesn't
consistently follow one standard and that reusable functionality is copy-pasted instead
of shared. Findings: sidebar and topbar are already genuinely single-source (`renderSidebar()`
app.js, one topbar markup block); the real duplication is at the screen-helper level —
7 byte-identical `*ListPage` functions, 12 files hand-rolling modal-chrome markup instead
of the existing `appModal()` SSOT, zero shared field-validation helper, and 3 legacy
hardcoded module-nav functions (`salesNav`/`purNav`/`inventoryNav`) that `MODULE_DEFS`
doesn't even know about. This epic closes those specific, concretely-identified gaps —
not a speculative rewrite. (TASK-043, TASK-044, TASK-045)

Acceptance criteria:

- [x] A new `web/public/assets/screens-common.js`, loaded once right after `i18n.js` and
      before every `screens-*.js` file, exports one `listPage(resource, query)` helper
      replacing `crmListPage`/`assetListPage`/`financeListPage`/`inventoryListPage`/
      `purchasingListPage`/`salesListPage`/`adminListPage` at all ~40 call sites, with
      zero behavior change (verified: every `adminListPage` call site already passed no
      query argument, so unifying the default to `{limit:100}` changes nothing live).
- [x] The 12 files hand-rolling `<div class="modal-head">...</div>` markup are migrated
      onto the existing `appModal({icon,title,body,actions,width})` SSOT in `ui.js`
      (23 of 24 sites — one, the keyboard-shortcuts modal in `app.js`, uses a custom
      non-`modal-foot` footer and was deliberately left hand-rolled rather than
      force-fit). Titles that wrapped an interpolated value in `esc(...)` had that
      `esc()` stripped, since `appModal()` escapes the title internally — leaving it in
      would have double-escaped real data (verified live with a name containing
      `&"<>`).
- [x] A shared `requireField(value, message, focusTarget)` helper in `screens-common.js`
      replaces 11 of 12 copy-pasted `if(!x){toast(...);focus();return}` sites (the 12th,
      an email-format regex check, is a different kind of validation and stays inline),
      with each call site's exact message text and focus target preserved — including
      the 2 sites that focus via a modal-scoped `querySelector` rather than the global
      `$()`, which the helper supports by accepting either a selector string or an
      already-resolved element.
- [x] `salesNav`/`purNav`/`inventoryNav` and their section arrays fold into `MODULE_DEFS`,
      and the `moduleNav()` special-case in `app.js` that routes around them is deleted.
      Found mid-implementation that the original framing undersold the risk: these 3
      functions are called *directly* (not just through the deleted special-case) from
      ~20 sites across 13 detail-page files (individual quotations, sales returns,
      credit/debit notes, PO approvals, etc.), several with no defensive `typeof` guard
      — deleting them outright would have broken those pages. Kept them as thin
      delegates to the new generic `moduleNav('sales'|'purchasing'|'inventory', active)`
      instead of removing them, which is safe for every existing caller while still
      eliminating the duplicated rendering logic. `MODULE_DEFS.sales`/`purchasing` gained
      a new `sections` shape (grouped, with `ssub-sep` dividers) alongside the existing
      flat `items` shape, since their sub-nav genuinely has more structure than the other
      11 modules; `SALES_SECTIONS`/`PUR_SECTIONS`/`INVENTORY_SECTIONS` stay exactly where
      they were (also the sales/purchasing hub screens' tile-grid data source) and are
      referenced by `MODULE_DEFS`, not duplicated. Preserved a real i18n behavior the
      generic path's `tf('route.'+x,fallback)` convention doesn't actually support today
      (no `route.*` keys exist anywhere) — Inventory's nav labels use real translated
      `inv.nav.*` keys, so `MODULE_DEFS` items gained an optional explicit `labelKey`.
- [x] `npm run audit:screens` and a live desktop+375px browser check still pass with zero
      console errors after each mechanical change. For this task specifically, also
      diffed exact DOM fingerprints (class list, aria-label, group-separator count, tab
      count, ordered label text) captured before the change against the same fingerprint
      after, for Sales/Purchasing/Inventory — byte-identical in every case, including
      Inventory's real Chinese translations and a previously-unguarded direct-call detail
      page (Sales Return `RMA-DEMO-1`, the highest-risk call pattern).

## EPIC-018 — Super-Admin Module Access Control

Stakeholder requirement: a superadmin must be able to enable/disable specific ERP modules
per tenant (`master_fn`) — e.g. a client that only bought Sales should not see or be able
to call Purchasing/Manufacturing/etc. The `module-activation-control` screen already
exists but an audit (2026-07-19) found it is **100% browser-local**: `readModuleControl()`/
`writeModuleControl()` in `screens-admin.js` only call `localStorage`, keyed per
`currentMasterFn()`, explicitly labeled "Saved locally for demo" — nothing is persisted
server-side or enforced anywhere. This epic gives it a real tenant-scoped backend and
wires enforcement into both the client nav and server-side request handling, not just the
toggle UI. (TASK-047, TASK-048)

Acceptance criteria:

- [x] A new tenant-scoped `master_module` table (`master_fn` + `module_key` + `enabled`,
      following the composite-key style `role_permission` already uses) added via a
      Drizzle migration; module keys mirror the existing `MODULE_DEFS` set.
- [x] Business logic to list/set a master's enabled modules, audited, superadmin-gated
      (new `admin.modules.manage`-style permission key), mirroring `adminLifecycle.ts`'s
      raw-exec-`...Within` + self-transacting-wrapper split.
- [x] Bespoke `/api/admin/modules` routes (mirrors `routes/admin.ts`'s existing style) and
      matching demo-adapter wiring (`admin/modules` bespoke dispatch, not a generic
      resource — same reasoning as EPIC-016). Server-side enforcement also landed with
      the backend: the 4 generic resource-router handlers (list/get/create/action in
      `routes/resources.ts`) reject with `module_disabled` when the URL's `:module`
      prefix maps to a disabled module for the session's tenant, covering all 9 domains
      that have real generic resources today (assets/crm/finance/inventory/
      manufacturing/purchasing/quality/sales/warehouse). The `admin` module itself can
      never be disabled (would lock every superadmin out of re-enabling it).
- [x] `module-activation-control` reads/writes the real backend instead of `localStorage`.
- [x] A disabled module is hidden from the sidebar/module shell for non-superadmin users
      of that master (`renderSidebar()`/`routeAllowed()`/`moduleBlockedPanel()` all read
      the real state through `moduleState()`, unchanged from before except what backs it),
      AND rejected server-side if called directly (API mode) — a client-only toggle would
      not have met the stated requirement.
- [x] Superadmin's own access is never gated by this mechanism (it controls what a
      master's *other* users can reach, not the superadmin's own visibility) — enforced
      on both sides: server-side via `isSuperadminSession()` (`src/auth/permissions.ts`,
      same tenant-bounded lookup `hasPermission`'s bypass uses) in all 4 generic
      resource-router handlers, and client-side via `moduleState()` (not
      `readModuleControl()`, which the admin screen itself calls directly so it always
      shows the *true* state, never the exemption) checking `isModuleAdmin()`.

Design simplification made during TASK-048, found while reading the mock's own screen
code: the mock modeled two independent toggles per module (`visible` + `active`,
allowing a third "shown but blocked" state) with real, if minor, distinct behavior.
Nothing in the stated requirement calls for that third state — "turn off unnecessary
modules for a client" is inherently binary — so the real screen collapses this to the
one `enabled` boolean the backend already stores, matching the same
don't-fabricate-a-distinction-the-backend-doesn't-model principle EPIC-016 established
for `role-permission`'s 4-level-to-2-state simplification.

## EPIC-019 — Superadmin Safety Guard

Found by the same 2026-07-19 audit while verifying the stakeholder's "every database must
always have a super admin account" requirement: `setUserActiveWithin`
(`src/auth/adminLifecycle.ts`) only rejects a user disabling *themselves*
(`cannot_disable_self`) — any other user holding the independently-grantable
`admin.users.manage` permission can deactivate the last active superadmin, leaving a
tenant with zero working superadmins (the row still exists with `isActive=false`, but
nobody can act on it, including re-enabling it, without direct DB access). Small,
high-value, low-risk fix. (TASK-046)

Acceptance criteria:

- [x] `setUserActiveWithin` rejects deactivating a superadmin-role user when they are the
      *last active* superadmin for that `master_fn` (a second active superadmin may still
      be disabled).
- [x] Unit test covers: sole active superadmin cannot be disabled by another admin user;
      a superadmin CAN be disabled if at least one other active superadmin remains.
- [x] No change to the existing self-disable guard or to non-superadmin user toggling.

## EPIC-020 — HR-lite: Employee Master & Leave Management ✅

First Phase 7 module opened after Phase 8's platform work. Deliberately scoped to
**employee master + leave request/approval only** — the mock's Payroll screens
(`payroll-run`, `payslip`) and the onboarding wizard's compensation/pay-grade/
provisioning-checklist fields stay mock, matching how every prior module conversion
left schema-less siblings alone rather than expanding scope to "complete" a whole UI
area (Purchasing's RFQs, Sales' Commission, Assets' Transfer/Dispose). Payroll is a
materially different, statutory-contribution-heavy domain (EPF/SOCSO/PCB) that belongs
in its own future epic, not bundled into a "lite" pass. (TASK-049, TASK-050)

Acceptance criteria:

- [x] `employee` (self-referencing `manager_id`, tenant-scoped, no link to `app_user` —
      an HR record doesn't imply an ERP login) and `leave_request` tables added via a
      Drizzle migration, following `assets.ts`'s tenant/check-constraint conventions.
      Deliberately no compensation/salary column (out of scope) and no stored
      `decided_by_user_id` (the generic action-dispatcher's `execute()` doesn't receive
      an actor, matching `depreciation_run`'s precedent of not storing a `posted_by`
      either — the audit trail, not the row, is where "who" lives).
- [x] `src/modules/hr/employee.ts` (`createEmployeeWithin`/`createEmployee`) and
      `src/modules/hr/leaveRequest.ts` (`createLeaveRequestWithin`/`createLeaveRequest`,
      `decideLeaveRequestWithin`/`decideLeaveRequest` for the real approve/reject
      outcomes) mirror `createAsset.ts`'s plain-insert shape; `hr/employees` and
      `hr/leave-requests` registered as generic `ResourceDefinition`s (not bespoke
      routes — these fit the standard single-integer-PK shape cleanly, unlike Admin's
      tables), gated on new `hr.read`/`hr.write` permissions.
- [x] 16 new unit tests cover validation, tenant isolation, the self-referencing manager
      FK, inclusive leave-day computation, and the full approve/reject state machine
      (including "already decided" and "reject requires a reason").
- [x] `hr-directory`, `employee` (per-employee, not always the same hardcoded record),
      `new-employee` and `leave-approval` read/write real data through the standard
      audited idempotent Demo/API action dispatcher. `new-employee` is a single real
      form, not the mock's 3-step compensation/provisioning wizard — those steps had
      no schema to back them. Found and fixed one thing during implementation: the
      seed's first employee was named "Dana Reyes", which collided with the audit
      script's known-prototype-placeholder identity marker (unrelated to this repo's
      own demo data) — renamed to Farah Wong.
- [x] All 4 routes move to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES` (54 → 58).

## EPIC-021 — Project-lite: Register & Progress Claims ✅

Second Phase 7 module opened after HR-lite. ROADMAP.md flagged Project as "likely the
largest remaining module" and recommended sub-phasing (register → progress billing →
project-scoped finance documents) rather than one task pair. This epic deliberately
covers only the **first two** of those three: a real project register and real
**Progress Claim** billing documents — the one sub-feature the stakeholder explicitly
named as absent ("progress invoice"/"partial claim" were narrative copy only, no
schema). Project-scoped AP (linking `supplier_invoice` to a project), dedicated Bank
Receipt/Bank Payment documents and a real Payment Voucher backend all stay out of scope
for this epic — they are Finance-depth work spanning beyond Project, not gaps in the
register/billing slice this epic delivers, and remain future epics per ROADMAP.md item 7.

Cost/budget tracking, team allocation, milestone scheduling and physical "% complete"
also stay out of scope: the mock's cost-breakdown/team/milestone panels have no
transactional source (no timesheet or expense-capture schema exists, and building one
is a materially separate feature), so surfacing them for real would require fabricating
data the schema doesn't back — the same principle that dropped Fixed Assets'
Transfer/Dispose and HR-lite's payroll/compensation. This epic therefore left
`timesheet` as mock; EPIC-044 later closes that separately without adding payroll.

Progress claims reuse the exact posting shape `src/modules/sales/debitNote.ts` already
established (draft → post inserts balanced `gl_entry` legs: Dr `1100` AR / Cr `4000`
Revenue / Cr `2200` Output Tax, `journalRef` = the claim's `docNo`) — no new chart-of-
accounts codes needed. The project's `billed_to_date` running aggregate increments on
each posted claim, mirroring `asset.accumulated_depreciation`'s aggregate-plus-ledger
shape from EPIC-015.

Acceptance criteria:

- [x] `project` (register: `project_no`, `name`, nullable `customer_id` FK — null means
      an Internal project — `manager_name`, `status` open/on_hold/completed, dates,
      `contract_value`, running `billed_to_date`) and `progress_claim` (billing document:
      `doc_no`, `project_id` FK, draft/posted status, `version`, tax breakdown mirroring
      `sales_debit_note`) tables added via a Drizzle migration, following `assets.ts`'s
      tenant/check-constraint conventions. Deliberately no `type` column — Customer vs.
      Internal is derived from `customer_id` presence rather than stored redundantly.
- [x] `src/modules/project/project.ts` (`createProjectWithin`/`createProject`) and
      `src/modules/project/progressClaim.ts` (`createProgressClaimWithin`/
      `createProgressClaim`, `postProgressClaimWithin`/`postProgressClaim`) — posting
      rejects a project with no customer (can't bill an Internal project) and a project
      already `completed`. `project/projects` and `project/progress-claims` registered
      as generic `ResourceDefinition`s, gated on new `project.read`/`project.write`
      permissions.
- [x] Unit tests cover validation, tenant isolation, the no-customer/completed-project
      posting guards, and the balanced GL legs (mirroring `debitNote.test.ts`'s shape).
- [x] `project-pl` (portfolio list — real contract/billed/headroom KPIs, a real
      over-billed alert instead of the mock's fabricated "at risk" judgment, a real
      "New Project" create modal) and `project-detail` (real single-project view: real
      progress-claims panel with inline create + row-level post, real activity feed
      synthesized from real row timestamps, real "Related" linking to the actual linked
      customer) read/write real data. Cost breakdown, milestones, and team panels are
      removed, not fabricated. `timesheet` was unchanged in this slice and was later
      canonicalized independently by EPIC-044.
- [x] Both routes move to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES` (58 → 60). Live
      verification surfaced two real bugs neither unit tests nor `audit:screens` caught:
      PGlite/Drizzle return `date`/`timestamp` columns as JS `Date` objects, so naive
      template-literal interpolation rendered `Wed Mar 04 2026 08:00:00 GMT+0800…` instead
      of a clean date (fixed with a normalizer mirroring `screens-fin2.js`'s existing
      `financeDateValue`); and the client-side progress-claim numbering was scoped to the
      current project's own claims rather than the tenant's full claim list, so two
      different projects' first claims both tried `doc_no` `PC-2026-0001` and the second
      create leaked a raw SQL unique-constraint error to the user (fixed by numbering off
      an unfiltered, tenant-wide claim list instead). Also found and fixed in passing:
      writing a Progress Claim's `netAmount > 0` check as `!net.isPositive()` doesn't
      actually reject zero, because decimal.js's `isPositive()` treats zero as positive
      (sign-bit only) — the same latent bug already existed in five other files
      (`debitNote.ts` among them); fixed locally with `net.lte(0)` and flagged the rest as
      a separate follow-up rather than scope-creeping this epic.

(TASK-051, TASK-052, 2026-07-20.)

## EPIC-022 — Service-lite: Tickets & Contracts ✅

Third Phase 7 module. `screens-service.js` has no schema: `service-ticket` is a real
list rendering mock rows, but `service-order` always shows the same hardcoded ticket
(`SVC-26-0042`, the same bug class already fixed for `asset-detail`/`employee`/
`project-detail`), and `service-contracts` has no detail or create flow at all.

Scoped like every prior "lite" conversion — the register/lifecycle core goes real, a
materially separate depth feature stays mock:

- **Real**: `service_contract` (a customer's warranty/maintenance agreement register —
  plan, SLA response hours, assets covered, dates, annual value) and `service_ticket`
  (the ticket/repair record — customer, free-text asset/serial, issue, priority,
  coverage, optional linked contract, technician, status). Ticket lifecycle simplifies
  the mock's 5 statuses (Open/In Progress/Scheduled/Resolved/Closed) to 3 real ones
  (`open`/`in_progress`/`closed`) — the mock's own `service-ticket` filter chips already
  bucket Resolved+Closed together as one "done" state, and its own `service-order`
  footer button is already labeled "Resolve & close" as one combined action, so this
  isn't a new simplification, just making explicit what the mock's own UI already
  implied. "Scheduled" (a future-dated planned visit, a distinct concept from an active
  issue's status) is dropped, not fabricated forward.
- **Stays mock**: spare-parts consumption and labour costing (`service-order`'s parts
  table and cost panel) — these need a new stock-consumption transaction against
  Inventory, a materially separate feature from the ticket/contract register itself,
  the same reasoning that kept Fixed Assets' Transfer/Dispose and Project's cost
  tracking out of their own "lite" passes.

Acceptance criteria:

- [x] `service_contract` (`contract_no`, `customer_id` FK not null — every contract has
      a customer, no Internal-project-style nullable case — `plan` Gold/Silver/Bronze,
      nullable `sla_response_hours`, `assets_covered`, dates, `annual_value`) and
      `service_ticket` (`ticket_no`, `customer_id` FK not null, nullable `contract_id`
      FK, free-text `asset_description`/`serial_no`, `issue`, nullable `diagnosis`,
      `priority`, `coverage` in_warranty/contract/out_of_warranty, `status`
      open/in_progress/closed, nullable `technician_name`, `opened_at`, nullable
      `resolved_at`) tables added via a Drizzle migration, following `project.ts`'s
      conventions. Contract status (Active/Expiring/Expired) is computed from
      `expiry_date` vs. today, not stored — mirrors Project's over-billed alert and HR's
      `hrIsOnLeaveToday` computed-not-stored precedent.
- [x] `src/modules/service/serviceContract.ts` (`createServiceContractWithin`/
      `createServiceContract`) and `src/modules/service/serviceTicket.ts`
      (`createServiceTicketWithin`/`createServiceTicket`, `assignServiceTicketWithin`/
      `assignServiceTicket` — `open` → `in_progress`, sets `technician_name` —
      `resolveServiceTicketWithin`/`resolveServiceTicket` — any non-`closed` status →
      `closed`, requires non-empty `diagnosis`, sets `resolved_at`). `service/contracts`
      and `service/tickets` registered as generic `ResourceDefinition`s, gated on new
      `service.read`/`service.write` permissions (the client already referenced
      `service.read` in `app.js`'s `MODULE_READ_PERMISSION` map with nothing backing it
      server-side, the same gap HR-lite found for `hr.read`).
- [x] Unit tests cover validation, tenant isolation, the assign/resolve state-machine
      guards (including rejecting resolve on an already-closed ticket and rejecting a
      reason-less resolve), mirroring `leaveRequest.test.ts`'s shape.
- [x] `service-ticket` (list — real open/overdue KPIs replacing the mock's hardcoded
      "96%" SLA figure, real status filter chips, a real "New ticket" create modal),
      `service-order` (real per-ticket detail — not always the same hardcoded record —
      with real Assign and Resolve & close actions, a real SLA due-time computed from a
      linked contract's response hours where one exists) and `service-contracts` (real
      list with computed Active/Expiring/Expired status and a real "New contract" create
      modal) read/write real data. Parts/labour cost panels are removed, not fabricated.
- [x] All 3 routes move to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES` (60 → 63).

(TASK-053, TASK-054, 2026-07-20.) Also found and fixed two issues unrelated to Service
itself while implementing it: the Viewer role's seed permission grants were missing
`project.read` (a real gap left by EPIC-021 — the Demo Viewer persona could never see the
Project module, only missed because every live verification so far used the Admin/
superadmin persona, which bypasses permission checks entirely) — added alongside the new
`service.read` grant; and `vitest.config.ts` had no `exclude` pattern, so `npm test` was
silently pulling in roughly 100 `*.test.ts` files from concurrent background agents'
`.claude/worktrees/` checkouts and reporting their combined pass/fail state as this
checkout's own (a `npm test` run showed 41 failures across 9 files that did not reproduce
in isolation and did not correspond to any uncommitted change in `git status`; `git
worktree list` explained why) — fixed by excluding `**/.claude/worktrees/**`.

## EPIC-023 — Purchase Requisition: register, approval & real PO linkage ✅

Fourth Phase 7 module, and the last not-started item on the original Phase 7 list.
Unlike every prior "lite" module, this one is a **new table inside an existing, already-
Canonical domain** (Purchasing — `suppliers`/`purchase-orders`/`goods-receipts`/
`supplier-invoices` are already real from EPIC-008), not a new domain of its own. `
purchase-requisitions` renders real-looking rows today but off pure static mock data
(`DB.purchaseReqs`, no `prepare:` hook in its `makePurList` config, unlike its already-
Canonical siblings); `purchase-request` (singular, detail) always shows the same
hardcoded `PR-26-0142` record — the same bug class already fixed for `asset-detail`/
`employee`/`project-detail`/`service-order`.

RFQs, supplier quotations, purchase returns, and supplier credit/debit notes sit at the
same mock maturity tier and are explicitly **out of scope** — ROADMAP.md already flagged
Purchase Requisition specifically (not its siblings) as the one gap worth closing, since
it's the direct upstream of the already-real PO chain.

**Real, and the one thing that makes this more than a register:** a genuine
requisition → purchase order link. `purchase_order` gains a nullable `requisition_id` FK
(additive, backward-compatible — every existing caller of `createPurchaseOrderWithin`
that doesn't pass it is completely unaffected); passing it validates the requisition is
`approved` and not already converted, and the resulting PO is really tied to the
requisition that spawned it — closing the exact gap ROADMAP.md named: "today a PO can be
created with no requisition trail behind it." "Converted" is computed at read time (a
requisition is converted if any `purchase_order` references it), not stored — same
computed-not-stored precedent as Project's over-billed alert, Service's contract status,
and HR's on-leave-today check.

Acceptance criteria:

- [x] `purchase_requisition` (`req_no`, `requested_by_name`/`department` plain text — no
      user FK, matching Project's `manager_name` precedent — `needed_by_date`, `priority`
      Urgent/Project/Stock matching the mock's exact values, nullable `justification`,
      `status` submitted/approved/rejected — collapses the mock's Draft/Submitted/Pending
      Approval into one `submitted` state since nothing in the mock's own UI ever acted
      on that distinction differently, stored `estimated_value` computed once at create
      time mirroring `purchase_order`'s own denormalized-totals convention) and
      `purchase_requisition_line` (real product-linked lines: `product_id` FK, `qty`,
      `estimated_unit_cost` — replacing the mock's free-floating `lines:3`/`value:64200`
      with real, addable line items) tables added via a Drizzle migration into the
      existing `src/data/schema/purchasing.ts` (not a new schema file — this is the
      existing Purchasing domain, matching how that file already groups
      supplier/PO/GRN/invoice together). `purchase_order` gains a nullable
      `requisition_id` FK.
- [x] `src/modules/purchasing/purchaseRequisition.ts` (`createPurchaseRequisitionWithin`/
      `createPurchaseRequisition` — always starts `submitted`;
      `decidePurchaseRequisitionWithin`/`decidePurchaseRequisition` — mirrors
      `decideLeaveRequestWithin`'s shape exactly, requires a reason to reject).
      `src/modules/purchasing/createPurchaseOrder.ts` gains an optional `requisitionId`
      on `CreatePurchaseOrderInput`: when provided, validates the requisition is
      `approved` and not already linked to another PO before setting it on the new
      order. `purchasing/purchase-requisitions` and `purchasing/purchase-requisition-
      lines` registered as generic `ResourceDefinition`s gated on the **existing**
      `purchasing.read`/`purchasing.write` permissions — no new permission keys needed,
      unlike every prior module (Purchasing already has them).
- [x] Unit tests cover validation, tenant isolation, the approve/reject state-machine
      guards, and — in `createPurchaseOrder.test.ts` — the new requisition-linkage path:
      accepts a valid approved requisition, rejects a not-yet-approved one, rejects
      reusing an already-converted one, and confirms omitting `requisitionId` entirely
      (every pre-existing test) is completely unaffected.
- [x] `purchase-requisitions` (real KPIs/filter chips including a computed "Converted"
      bucket, a real "New requisition" create modal with real product-linked lines) and
      `purchase-request` (real per-requisition detail — not always the same hardcoded
      record — with real Approve/Reject actions and, for an approved-and-unconverted
      requisition, a real "Convert to PO" handoff into the existing `new-purchase-order`
      wizard) read/write real data. The wizard gains a small optional `requisitionId`
      param it silently threads into its existing create payload when reached this way.
- [x] Both routes move to `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES` (63 → 65).

(TASK-055, TASK-056, 2026-07-20.) Unlike every prior "lite" module this one extended an
already-Canonical domain rather than standing up a new one — no new permission keys, no
seed.ts Viewer-grant change, and the new tables joined the existing `purchasing.ts`
schema file. The one genuinely new mechanism, a real `purchase_order.requisition_id`
link validated in `createPurchaseOrder.ts`, is what turns this from a register into a
closed procurement trail: converting a requisition rejects if it's not `approved` or is
already linked to another order, and every pre-existing `createPurchaseOrder` caller
that omits `requisitionId` stays completely unaffected. Live testing caught one real bug
before it shipped: the requisition detail's "Related" panel initially showed the
requisition's own *estimated* value next to the linked PO, not the PO's *real* total —
easy to miss since both numbers look plausible on their own — fixed by looking up the
actual `DB.purchaseOrders` row via `convertedOrderId` instead of reusing the estimate.

## EPIC-024 — Project Finance Depth: Bank Receipt, Payment Voucher & Project-Scoped AP ✅

Closes Project's third and final deferred sub-phase (`docs/ROADMAP.md` item 7): a real
**Bank Receipt** against a progress claim's AR, a real **Payment Voucher** settling
supplier invoices' AP, and **project-scoped AP linkage** (`purchase_order`/
`supplier_invoice` gain a nullable `project_id`). All three were previously mock or
entirely absent — `payment-voucher`/`new-payment-voucher` (`screens-fin.js`/
`screens-fin-pay.js`) write nothing real today (the wizard's "open invoices" list is
**fabricated** from a hash of the supplier code, never reads `supplier_invoice`; "Post
payment" is a toast, no adapter call at all); nothing in `src/` has ever transitioned a
`supplier_invoice` to `'paid'`. `bank-rec` (Finance-wide bank reconciliation, a different
and materially larger feature — matching bank-statement lines against the GL) stays
mock/Preview; ROADMAP only asks for dedicated receipt/payment *documents*, not a full
reconciliation engine, so it's explicitly out of scope here.

Real, and the reason this isn't just two document types: `purchase_order` gains a
nullable `project_id` (additive, mirrors EPIC-023's `requisition_id` exactly — every
existing caller that omits it is unaffected), settable from the `new-purchase-order`
wizard; `postSupplierInvoiceWithin` copies it onto the resulting `supplier_invoice`
automatically (no new user input in that screen's existing one-click "Post invoice" row
action) — a project's real cost trail becomes visible without a second data-entry step.
Bank Receipt deliberately only settles a progress claim's AR (not generic sales
invoices) — this is Project's own outstanding-receivable, not a Finance-wide feature —
one receipt per claim, full amount only (matching this codebase's established
one-document-settles-one-thing convention: `receiveGoods`, `postSupplierInvoice`).
Payment Voucher settles one or more of one supplier's unpaid invoices in full per line
(no partial-payment tracking — a materially separate feature, deferred). Both are new
Treasury/Finance documents in `src/data/schema/finance.ts` (alongside `account`/
`gl_entry`, which they post into) even though they reference `progress_claim`
(Project) / `supplier_invoice` (Purchasing) by FK — cross-domain schema references are
already an established pattern (`purchasing.ts` already imports `product`/`warehouse`
from `inventory.ts`).

Acceptance criteria:

- [x] `bank_receipt` (`doc_no`, `progress_claim_id` FK not null, `received_date`,
      nullable `bank_ref`, `amount`) and `payment_voucher` (`doc_no`, `supplier_id` FK,
      `payment_date`, nullable `bank_ref`, `total_amount`) + `payment_voucher_line`
      (`payment_voucher_id` FK, `supplier_invoice_id` FK, `amount`) tables added to
      `src/data/schema/finance.ts`. `purchase_order` and `supplier_invoice` each gain a
      nullable `project_id` FK in `src/data/schema/purchasing.ts`. A new `1000` Cash/Bank
      account is seeded (fixes a currently-dead `screens-fin2.js` GL tile that already
      computes `get('1000')+get('1010')` against accounts that don't exist yet).
- [x] New `src/modules/finance/` module (first business-logic module in this domain —
      GL has been read-only until now): `bankReceipt.ts` (`createBankReceiptWithin` —
      requires the claim `posted` and not already receipted, requires the amount to
      exactly match the claim's `total_amount`, posts Dr `1000` Cash / Cr `1100` AR) and
      `paymentVoucher.ts` (`createPaymentVoucherWithin` — requires every referenced
      invoice to belong to the named supplier and be `unpaid`, posts Dr `2100` AP / Cr
      `1000` Cash for the summed total, flips every referenced invoice to `paid`).
      `createPurchaseOrder.ts` gains an optional `projectId` (mirrors `requisitionId`'s
      validate-then-set shape); `postSupplierInvoiceWithin` copies the originating PO's
      `project_id` onto the new invoice with no new input. New `finance.write`
      permission (Finance has only ever had `finance.read`); `finance/bank-receipts`,
      `finance/payment-vouchers` and `finance/payment-voucher-lines` registered as
      generic `ResourceDefinition`s.
- [x] Unit tests cover: bank receipt happy path, rejecting a not-yet-posted claim,
      rejecting a second receipt against an already-receipted claim, rejecting an
      amount that doesn't match the claim total; payment voucher happy path across
      multiple invoices with a correctly summed balanced GL posting, rejecting an
      invoice that belongs to a different supplier, rejecting an already-paid invoice;
      `createPurchaseOrder`'s new `projectId` path and `postSupplierInvoice` correctly
      propagating it, with every pre-existing test in both files still passing
      unchanged.
- [x] `payment-voucher` (real per-voucher detail) and `new-payment-voucher` (a real
      2-step wizard: pick a supplier, see that supplier's *real* unpaid invoices — not
      a fabricated list — select which to pay in full, submit) read/write real data.
      `project-detail` gains a real "Record receipt" action on any posted,
      not-yet-receipted progress claim, and a real "Project costs" panel listing linked
      supplier invoices (via the new `project_id`) with their paid/unpaid status and
      running total. `new-purchase-order` gains an optional "Project" field in step 1.
- [x] Both `payment-voucher` and `new-payment-voucher` move to
      `CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES`; `bank-rec` is unaffected (stays
      Preview, out of scope).

(TASK-058, TASK-059, 2026-07-21.) This closes Phase 7's last open item — every
originally-scoped module is now real; only a hypothetical future depth pass (partial
payments, bank reconciliation, full expense/timesheet tracking) remains, and none of it
was ever promised. Live testing produced a clean, mathematically verifiable proof: after
posting one Payment Voucher (settling S$1,220.80 across two real unpaid invoices,
including one from the pre-existing SO-1/PO-1 demo proof chain, not just this epic's own
seed row) and one Bank Receipt (S$54,500 against the seeded posted progress claim), the
General Ledger's new `1000` Cash & Bank account read exactly S$53,279 — the net of both
postings — while Accounts Payable and Accounts Receivable both moved by the exact settled
amounts. That same GL screen had shown a permanently-$0 Cash & Bank tile since long
before this epic (`screens-fin2.js` already summed account codes `1000`+`1010`, but
neither existed) — seeding the missing account fixed a pre-existing dead tile as a
side effect of giving Payment Voucher and Bank Receipt somewhere real to post into.

## EPIC-025 — Interactive Host Bootstrap (`scripts/setup.sh --interactive`) ✅

Closes the smaller of the two "Future" items `docs/SETUP_WIZARD.md` itself already names
under Phase A (host bootstrap): today `make setup`/`scripts/setup.sh` is one-command but
zero-prompt — it copies `.env.example` to `.env` verbatim (shipping the literal
`DB_PASSWORD=change-me` placeholder and blank `ERP_SETUP_TOKEN`/`ERP_TOKEN_ENCRYPTION_KEY`
unless the installer remembers to hand-edit them first) and always provisions the bundled
`db` container — there is no way to point at a database an installer has already
provisioned themselves (a managed RDS/Cloud SQL/Supabase instance, for example) without
manually editing `.env` and understanding `docker-compose.yml`'s service graph. The other
named Future item — a full desktop installer with Docker Desktop detection — stays out of
scope; this epic is deliberately the small, low-risk half.

Explicitly **not** the larger, riskier idea floated in earlier planning notes (a live
in-app "connect to any database and provision it" web flow): that's architecturally
impossible as a web UI anyway, since `src/server.ts` hard-requires `DATABASE_URL` before
Express starts — there's no running server yet to serve such a page. Everything here stays
a **pre-boot script**, matching Phase A's existing, already-validated design; it never
touches Phase B (the in-app wizard) at all.

Real, not cosmetic: `docker-compose.yml`'s `api`/`worker` services currently *ignore* the
`DATABASE_URL` line `.env.example` itself documents — they always reconstruct their own
connection string from `DB_USER`/`DB_PASSWORD`, silently. That's a live, standalone bug
(confirmed via `docker compose config`, not just reading the file) fixed as part of this
epic regardless of whether the interactive flag is ever used: `DATABASE_URL` becomes a real
override, falling back to the constructed default when unset (Compose v2's nested
`${VAR:-default}` interpolation, verified working on this engine's v2.40).

Acceptance criteria:

- [x] `docker-compose.yml`: `api` and `worker` services' `DATABASE_URL` becomes
      `${DATABASE_URL:-postgresql://${DB_USER:-erp}:${DB_PASSWORD:-erp_dev_password}@db:5432/erp}`
      — an explicit `.env` `DATABASE_URL` now genuinely overrides the bundled-container
      default instead of being silently ignored. `.env.example`'s own pre-filled
      `DATABASE_URL=postgres://erp:change-me@db:5432/erp` line (which made every fresh
      `.env` set it explicitly, defeating the fallback for everyone) is replaced with a
      comment explaining it's auto-derived unless set.
- [x] `scripts/setup.sh` gains a `--interactive`/`-i` flag (only takes effect when `.env`
      doesn't exist yet, matching the script's existing idempotent/never-overwrite
      contract). Prompts, in order: (1) bundled PostgreSQL container vs. an
      already-provisioned external connection string; (2a) for bundled, a database
      password (blank auto-generates a strong one via `openssl rand -hex 20` instead of
      shipping `change-me`); (2b) for external, the full `postgres://` connection string,
      validated by prefix before continuing; (3) `ERP_SETUP_TOKEN` (blank
      auto-generates); (4) `ERP_TOKEN_ENCRYPTION_KEY` (blank auto-generates, both via
      `openssl rand -base64 32`, matching the exactly-32-bytes-after-decode contract
      `.env.example` already documents); (5) `ERP_PUBLIC_URL`; (6) a real port-collision
      check against WEB_PORT/API_PORT/(DB_PORT if bundled) — reusing TASK-021's own
      documented pain point (a real verification run hit a taken port) — offering an
      alternate port instead of failing later at `docker compose up`. Writes a real `.env`
      derived from `.env.example` with the collected keys substituted in.
- [x] When an external connection string is chosen, the script never starts or waits on
      the bundled `db` service (`docker compose up -d api web --no-deps`, not the
      unqualified `docker compose up -d`) and replaces the `db`-container `pg_isready`
      wait with a short retry loop directly against `docker compose exec -T api npm run
      migrate` (which fails fast and clearly if the external database isn't reachable,
      and is itself the real readiness proof once it isn't).
- [x] `make setup-interactive` target added, calling the new flag. Existing `make
      setup`/bare `scripts/setup.sh` (no flag) behavior is completely unchanged — verified
      by re-running the existing non-interactive path for real after the
      `docker-compose.yml` change, not just by reading the diff.
- [x] `docs/SETUP_WIZARD.md`'s Phase A "Future" list item 1 (interactive prompts) marked
      done; `docs/DEPLOYMENT.md` gains a short section on connecting to an
      already-provisioned external database.
- [x] Verified live and end-to-end against real Docker, not just `docker compose config`:
      the bundled path (fresh `.env`, real `docker compose up`, migrate, seed, teardown)
      and the external path (a standalone `docker run postgres:16-alpine` standing in for
      an "already-provisioned" database, pointed at by the interactive script's external
      prompt, real migrate + seed succeeding against it, teardown) both complete cleanly.

**Done 2026-07-21 (TASK-060).** All six criteria verified live, not just read from a
diff — three full real-Docker cycles (plain non-interactive, `--interactive` bundled,
`--interactive` external against a standalone `docker run postgres:16-alpine` container),
each with a genuine build, `docker compose up`, migrate, seed, curl + browser check, and
clean teardown. Port-collision detection was proven against *real* live collisions on the
dev machine (another project's containers already held 3000/3001/5432), not a contrived
test. One real gap was caught and fixed mid-verification: a manually-typed
`ERP_TOKEN_ENCRYPTION_KEY` that didn't decode to exactly 32 bytes crashed the `api`
container at boot with no hint pointing back to `.env` — `setup.sh` now validates it
up front against `tokenCrypto.ts`'s exact contract (64-char hex or 32-byte base64) before
writing `.env` at all.

Real-Docker testing also surfaced a second, much larger, entirely pre-existing bug,
unrelated to this epic's own diff: the `web` service's Docker build context has been
scoped to `web/` alone since TASK-012, but `erp-demo-runtime-impl.ts` has imported
business modules directly from `../../src` since its creation (commit `389376a`,
2026-07-18) — unreachable inside that isolated context, and some of those modules
transitively need root-only packages like `decimal.js`. This means `docker compose up`'s
`web` build has been silently broken for this entire multi-epic standardization
initiative; nobody caught it because local dev, typecheck, and `npm run build:demo` all
run from the repo root, where the relative paths resolve fine regardless. Fixed in a
separate commit (`870fc08`, outside this epic's own diff) by widening `web`'s build
context to the repo root, mirroring the pattern `Dockerfile.api` already established for
the identical cross-workspace-import problem.

## EPIC-026 — Payroll: Run, Payslip & Statutory Contributions (SG CPF + MY EPF/SOCSO/EIS/PCB) ✅

EPIC-020 (HR-lite) deliberately deferred Payroll (`payroll-run`, `payslip`) as "a
materially different, statutory-contribution-heavy domain," not a lite extension of
employee master. This epic closes that deferral. Confirmed by direct research before
scoping (not assumed):

- **`employee` has zero compensation data today** — no salary, wage, or pay-rate column
  anywhere in `src/data/schema/hr.ts`. Payroll cannot compute anything until this exists.
- **The mock data is Malaysia-only.** `DB.payrollRun`/`DB.payslip1042` in
  `web/public/assets/data-hr.js` use exclusively Malaysian statutory terms (EPF, SOCSO,
  EIS, PCB) — Singapore's CPF appears nowhere in the mock. Worse, `src/data/seed.ts`
  only seeds employees for the Singapore company (`C-SG`); the Malaysia company (`C-MY`)
  — the one whose statutory scheme the mock actually demonstrates — has no employees at
  all. User confirmed scope (2026-07-21, asked directly rather than assumed): **support
  both countries**, matching this repo's existing dual-country architecture (the
  `TaxEngine`/`GstEngine`/`SstEngine` pattern already does exactly this for GST/SST) —
  not a Malaysia-only first pass that would leave the Singapore company, the *only*
  company with real seeded employees today, still unable to run its own payroll.
- **A real, reusable GL-posting shape already exists.**
  `src/modules/assets/depreciationRun.ts`'s draft → post pattern (compute a draft run
  with per-line detail, lock + guard on `status`, post one balanced aggregate journal via
  `accountIdByCode`, mark `posted`) is structurally exactly what a payroll run needs —
  reused directly, not reinvented. The mock's own "Approve & lock run" copy ("Locking
  posts the payroll journal... and releases net pay...") already describes this as one
  combined action, matching Depreciation Run's single-step post rather than a two-step
  accrue-then-disburse workflow — no evidence in the mock or docs asks for the latter.
- **No payroll GL accounts exist** in the seeded chart of accounts (confirmed by reading
  the full seed insert — nothing in the `2xxx`/`6xxx` ranges relates to payroll). New
  accounts are required.
- **No payroll-specific permission exists** — only the general `hr.read`/`hr.write` pair,
  which also gates the leave-approval flow. Compensation data is materially more
  sensitive than the employee directory; this epic adds dedicated `payroll.read`/
  `payroll.write` keys rather than overloading `hr.write`.

**Explicitly out of scope, stated up front so it isn't mistaken for compliance-grade
payroll**: this models statutory contributions as **simple flat-rate approximations**
(matching the mock's own already-implied flat rates for Malaysia), not the real gazetted
bracket/wage-band tables EPF, SOCSO, EIS, PCB and CPF actually use, and not age-banded
CPF tiers (`employee` has no date-of-birth field to key them on anyway). No real
government e-filing/remittance file formats (SG CPF e-Submission, MY Borang e-PCB), no
annual EA/IR8A form generation, no payslip email delivery, and no wage-type modeling
(hourly/piece-rate) beyond a flat monthly base salary — every employee, regardless of
`employmentType`, is treated as having one flat period base salary. This mirrors exactly
how GST/SST model real tax *mechanics* without building the F5/MyInvois compliance
artifacts (`docs/LOCALIZATION.md`) — real domain shape, deliberately not full regulatory
depth. A later epic can deepen any of this without changing the schema shape below.

Acceptance criteria:

- [x] `employee` gains a required `baseSalary` (numeric, > 0) column — one flat period
      base salary per employee regardless of `employmentType`. Existing `createEmployee`
      validation extended to require it; no other `employee` schema change.
- [x] New `src/data/schema/payroll.ts`: `payrollRun` (tenant-scoped, `docNo`,
      `periodStart`/`periodEnd`/`payDate`, `status: 'draft'|'posted'`, aggregate totals,
      `postedAt`, optimistic-concurrency `version` — mirrors `depreciation_run` exactly)
      and `payrollRunLine` (`payrollRunId` FK, `employeeId` FK, `lineNo`, `grossPay`
      snapshotted from `employee.baseSalary` at run time — tax-snapshotted, matching
      `progress_claim`'s "don't recompute from a since-changed source" convention —
      `employeeStatutoryDeduction`, `incomeTaxDeduction`, `employerStatutoryContribution`,
      `employerAdditionalContribution`, `netPay`).
- [x] New `src/modules/payroll/statutory.ts`: a pluggable per-country engine — a
      Singapore (CPF: flat below-55-bracket employee/employer rates + an approximate
      flat-rate SDL) and a Malaysia (EPF employee/employer + a combined flat-rate
      SOCSO/EIS approximation + a flat-rate PCB approximation) implementation,
      dispatched by the run's company's `country`, returning the four contribution
      figures for a given `baseSalary`. Built as a plain function + rate-table dispatch
      (not a class hierarchy) — confirmed during implementation that no `TaxEngine`/
      `GstEngine`/`SstEngine` class actually exists in this codebase to mirror; real GST/
      SST tax lookups are data-driven via `taxRule` + `getEffectiveTaxRate`, so this
      module follows that same plain-function spirit instead. SG lines correctly show
      zero income-tax withholding (Singapore does not withhold monthly income tax on
      resident payroll the way Malaysia's PCB does) — not a fabricated non-zero number.
- [x] New `src/modules/payroll/payrollRun.ts`, mirroring `depreciationRun.ts`'s exact
      two-function-pair shape: `createPayrollRunWithin`/`createPayrollRun` (computes one
      line per active employee in scope using the statutory engine, inserts the draft
      run + lines, no GL touched) and `postPayrollRunWithin`/`postPayrollRun` (row-locks
      the run via `for('update')`, guards `status !== 'draft'`, posts one balanced
      aggregate journal: `Dr 6100` Salary & Wages Expense + `Dr 6110` Employer Statutory
      Contributions Expense / `Cr 2310` Statutory Contributions Payable (employee +
      employer sides combined — matches real-world practice of remitting both portions
      to EPF/CPF in one payment) + `Cr 2320` Income Tax Payable (PCB, skipped when zero
      so SG runs don't post a spurious $0 leg) + `Cr 1000` Cash & Bank for total net pay,
      tagged `journalRef: run.docNo`; marks `status: 'posted'`). New `6100`/`6110`/
      `2310`/`2320` chart-of-accounts rows seeded for both C-SG and C-MY (C-MY had zero
      accounts at all before this epic).
- [x] New `payrollRead: 'payroll.read'` / `payrollWrite: 'payroll.write'` permission
      keys (`src/auth/permissions.ts`), registered as generic resources
      (`payroll/runs`, `payroll/run-lines`) gated on them — separate from `hr.read`/
      `hr.write` so a role can see the employee directory without seeing compensation.
- [x] `src/data/seed.ts`: every existing (`C-SG`) seeded employee gains a real
      `baseSalary`; two new employees seeded for `C-MY` (previously zero) with their
      own `baseSalary`; one posted payroll run seeded per company so both a Singapore
      and a Malaysia payslip are viewable immediately without first creating a run.
- [x] `payroll-run` screen: real list of payroll runs via a run picker (replacing the
      single hardcoded "June 2026" row), a real "New payroll run" action (period + pay
      date, computes a real draft via `createPayrollRun`), and a real "Approve & lock
      run" action calling `postPayrollRun` — no more toast-only fake posting. Every
      employee row opens that employee's real payslip (fixing the mock's hardcoded
      "only Marcus Silva's row navigates" bug), not just one.
- [x] `payslip` screen: reads one real `payrollRunLine` (plus its `employee` and
      `payrollRun`), replacing the single fabricated Marcus Silva document. "Year to
      date" is computed for real (sum of that employee's posted `payrollRunLine` rows
      within the current calendar year, matching this tenant's Jan–Dec fiscal year), not
      the mock's `×6` multiplication of one period's figures.
- [x] `payroll-run`/`payslip` move from Preview to Canonical
      (`CANONICAL_SCREEN_ROUTES`/`API_SCREEN_ROUTES` in `app.js`); the stale "58
      Canonical / 56 Preview" comment in `docs/STATUS.md` corrected to the real current
      count (69/45, confirmed via `npm run audit:screens`) while this is touched anyway
      (already stale before this epic, confirmed against the live route count).
- [x] `docs/SPEC.md`'s stale "Planned domains (schema does not exist yet): purchasing,
      then CRM, HR, etc." line corrected — HR schema has existed since EPIC-020; noticed
      while reading SPEC.md for this epic's research, unrelated to payroll itself but
      trivial to fix in the same pass.
- [x] Verified live end-to-end in demo mode: a real payroll run created and posted for
      each of the Singapore and Malaysia companies, GL balanced (`Dr = Cr`) confirmed
      directly against `gl_entry` for both (SG: Dr=Cr=S$30,602.25, 4 legs, no spurious
      $0 tax leg; MY: Dr=Cr=RM11,072.55, 5 legs incl. PCB), a real payslip open for an
      employee in each company showing that country's correct statutory labels (CPF vs
      EPF/SOCSO+EIS/PCB) and a non-fabricated YTD figure. **Caveat found during this
      verification, not a payroll-specific regression**: browser demo mode does not
      enforce `role_permission` grants at the screen level for *any* module today (only
      the production API server does — see `erp_system_demo_mode_permission_enforcement_gap`
      in project memory, a pre-existing, already-documented gap) — so "Viewer denied
      access to payroll-run/payslip" could not be demonstrated in demo mode specifically;
      server-side gating on the new `payroll.read` permission is wired identically to
      every other resource in `resources.ts` and was not separately re-verified against
      a live production API server in this pass.
      Also found and fixed two real bugs during this verification: the "New payroll
      run" button read `created.id` instead of `created.data.id` from
      `ErpSystemData.create()`'s actual `{data, meta}` return shape (would have shown an
      empty run immediately after every future creation until a page reload), and the
      run-number generator didn't embed the year like every other document series in
      this codebase (fixed to `PAY-YYYY-NNNN`).

## EPIC-027 — Canonical CRM Opportunity Detail

**Goal:** close CRM's final registered Preview route by composing the existing
canonical CRM and Sales resources instead of inventing a second opportunity model.

Acceptance criteria:

- [x] Every pipeline card opens `opportunity` with its real opportunity id; the detail
      route reads bounded opportunity, customer, contact, activity and sales-order data
      through `ErpSystemData` in Demo and API modes, with honest empty states.
- [x] Opportunity activity creation accepts an opportunity target or customer target,
      validates both targets when supplied, and links the detail timeline to Customer
      360 without allowing a cross-customer mismatch.
- [x] A shared `markOpportunityLostWithin` command requires a reason, locks and scopes
      the opportunity, rejects won/lost records, increments its version and appends the
      system activity in the same transaction.
- [x] `crm/opportunities/mark-lost` is a registered RBAC, audit and idempotency action in
      both the production dispatcher and Demo ESM runtime; conversion continues to use
      the existing atomic CRM→Sales command.
- [x] The page provides five-language copy, real lifecycle/action visibility and related
      Customer 360/Sales Order navigation; `opportunity` moves to Canonical and Demo/API.
- [x] Domain and authenticated HTTP tests cover targeting, tenant mismatch, loss reason,
      terminal-state guards, idempotent replay and audit output. Desktop, Chinese and
      375px browser verification plus the complete 114-route audit pass at 70/44.

## EPIC-028 — Purchasing Sourcing: RFQ → Supplier Quotation → Purchase Order

**Goal:** replace Purchasing's sample-only RFQ and supplier-quotation registers with a
real, tenant-scoped sourcing chain that awards exactly one quotation into the existing
canonical purchase-order flow without creating premature stock or accounting entries.

Acceptance criteria:

- [x] Drizzle migration adds versioned `purchase_rfq`, `purchase_rfq_line`,
      `purchase_rfq_supplier`, `supplier_quotation` and `supplier_quotation_line`
      tables. A purchase order may link to one winning quotation through nullable
      `supplier_quotation_id`; the quote-to-PO relation is unique per tenant.
- [x] RFQs may source one approved, unconverted requisition or carry ad-hoc lines.
      Creation validates tenant-owned products and invited suppliers; issuing requires
      at least one line and supplier. A requisition already sourced by RFQ cannot bypass
      comparison through direct PO conversion.
- [x] Only an invited supplier may submit a complete, exactly-once response. Quote
      totals use Decimal and an effective tax-rate snapshot; all invited responses move
      the RFQ to `responded`.
- [x] Award is one atomic, idempotent action: create one linked pending-approval PO, mark the winner
      `converted`, reject competing quotes and mark the RFQ `awarded`. The sourcing
      stages write no stock movement or GL entry.
- [x] Five purchasing resources, two creates and three actions are registered for both
      Demo ESM and production API with existing `purchasing.read/write` RBAC, optimistic
      versions, idempotency and audit policies.
- [x] `rfqs` and `supplier-quotations` render bounded real data in Demo/API, provide
      five-language create/issue/close/respond/compare/award flows, and move to
      Canonical. The shared `pur-txn-view` stays Preview because it also hosts still-
      sample purchase returns and supplier notes.
- [x] Domain and authenticated HTTP tests cover requisition guards, invited/complete
      responses, tenant isolation, idempotent issue/award, audit correlation, one-winner
      conversion and the no-stock/no-GL invariant. Live desktop/Chinese verification
      plus the complete 114-route desktop/375px audit pass at 72/42.

## EPIC-029 — Purchase Return → Supplier Credit Note

**Goal:** replace the sample-only purchase-return and supplier-credit registers with a
tenant-scoped inverse procure-to-pay transaction that returns real stock and reverses
the matching AP, inventory and input-tax amounts atomically.

Acceptance criteria:

- [x] Add versioned `purchase_return`/`purchase_return_line` and immutable
      `supplier_credit_note`/`supplier_credit_note_line` tables with real links to the
      goods receipt, supplier invoice, purchase-order line, supplier and product.
- [x] Return creation accepts only a receipt and its still-unpaid supplier invoice,
      snapshots Decimal purchase cost/tax, rejects duplicate source lines and prevents
      cumulative quantities from exceeding the received quantity.
- [x] `ship-and-credit` is one idempotent transaction: issue the returned stock through
      `stock_movement`, create one posted supplier credit and balanced Dr AP / Cr
      Inventory / Cr Input Tax GL legs, then move the request to `credited`. Any stock,
      tracking, account or state failure rolls every effect back.
- [x] Production API and Demo ESM expose four bounded resources, one create and two
      audited actions under existing Purchasing RBAC; production RLS covers all four
      tables and the migration-generated PGlite schema remains aligned.
- [x] `purchase-returns` and `supplier-credit-notes` use real Demo/API resources,
      five-language create/ship/reject/detail flows and no shared sample `pur-txn-view`.
      Posted supplier credits are explicitly immutable and cannot be created directly.
- [x] Complete live in-app browser proof for create → ship/credit, Chinese rendering,
      stock/GL traceability and 375px layout, then run every release gate and close
      TASK-065 at 74 Canonical / 40 Preview.

## EPIC-030 — Supplier Debit Note and Net AP Settlement

**Goal:** replace Purchasing's sample-only supplier-debit register with a real
invoice-linked supplier claim, while correcting settlement so supplier credits and
debits reduce the amount actually paid instead of allowing an AP overpayment.

Acceptance criteria:

- [x] Add a versioned `supplier_debit_note` table linked to one still-unpaid supplier
      invoice. Creation snapshots Decimal tax and stores a draft without stock or GL
      impact; posting is immutable and cannot exceed the invoice's remaining payable.
- [x] Posting is one idempotent transaction with balanced Dr AP / Cr Purchase Variance /
      Cr Input Tax legs. It creates no stock movement because a commercial claim is not
      itself a physical return or inventory revaluation.
- [x] Introduce one shared invoice-outstanding calculation used by debit-note posting,
      purchase-return crediting and Payment Voucher. A voucher settles original invoice
      total less every posted supplier credit/debit, preventing overpayment and negative AP.
- [x] Production API and Demo ESM expose the bounded resource, create and post action
      under Purchasing RBAC, version, audit and idempotency policies; migration and RLS
      remain aligned. The same migration idempotently backfills account `1000` for
      pre-TASK-058 tenants so upgraded databases can actually settle the net payable.
- [x] `supplier-debit-notes` becomes a five-language Canonical Demo/API route with real
      create, post and detail flows. The shared sample `pur-txn-view` remains Preview.
- [x] Domain/API/browser proof covers amount caps, duplicate posting, net payment, balanced
      GL, no-stock invariant, Chinese rendering and 375px layout. All release gates pass at
      75 Canonical / 39 Preview.

## EPIC-031 — Landed Cost Allocation and Inventory Revaluation

**Goal:** replace Purchasing's sample-only Landed Cost register with a real,
receipt-linked allocation that capitalizes freight, duty, handling and other costs into
current inventory while keeping the inventory valuation and General Ledger equal.

Acceptance criteria:

- [x] Add versioned `landed_cost` and immutable `landed_cost_line` tables linked to a
      real goods receipt, purchase order, supplier, source PO lines and products.
- [x] Draft creation snapshots the received goods value and allocates the entered costs
      exactly by received value or quantity using Decimal arithmetic and deterministic
      residual rounding; tax is explicitly outside this document.
- [x] `allocate` is one idempotent transaction: lock the draft, products and current
      stock balances; require positive on-hand; increase each product's moving-average cost
      by its exact share over current on-hand; post balanced Dr Inventory / Cr Landed
      Cost Accrual; write no `stock_movement` because quantity does not change.
- [x] Production API and Demo ESM expose bounded header/line resources, create and
      audited allocate action under Purchasing RBAC/version/idempotency policies;
      production RLS and migration-derived PGlite schema stay aligned.
- [x] Existing and newly provisioned companies receive account `2300` Landed Cost
      Accrual without overwriting tenant configuration.
- [x] `landed-cost` becomes a five-language Canonical Demo/API route with real create,
      allocation preview, posted detail, inventory-valuation and GL trace links.
- [x] Domain/API/browser proof covers exact rounding, duplicate allocation, tenant and
      zero-stock guards, atomic rollback, cost/GL equality, Chinese and 375px layout.

## EPIC-032 — Purchase Order Approval Gate

**Goal:** replace Purchasing's sample-only approval queue/detail with a real,
auditable gate between PO creation and goods receipt, without inventing inventory or
accounting effects at approval time.

Acceptance criteria:

- [x] Migration 0034 adds one tenant-scoped, versioned
      `purchase_order_approval` per purchase order; every newly-created PO and every
      RFQ-awarded PO starts `pending_approval` with a pending approval row in the same
      transaction.
- [x] Shared `approve`/`reject` commands lock and scope both rows, require a non-empty
      decision note, validate the deciding active user and company assignment, snapshot
      actor name/time, increment versions and reject terminal or cross-tenant decisions.
- [x] Approval is stock- and GL-neutral. Approve opens the PO for receiving; reject
      closes it as rejected. `receiveGoods` continues to accept only `open` orders, so
      a pending or rejected PO cannot bypass the gate.
- [x] Production API and Demo ESM expose the bounded approval resource and audited,
      idempotent approve/reject actions under Purchasing RBAC. RLS and generated PGlite
      schema remain aligned.
- [x] `po-approvals` and `po-approval` use bounded real Demo/API data, five-language
      copy, an auditable decision modal and honest inventory/accounting timing. Both
      routes move to Canonical.
- [x] Domain/API/browser proof covers missing note, inactive/cross-company actor,
      Viewer denial, replay, audit, reject/duplicate-state guards, receipt gating and
      no-stock/no-GL impact. Desktop, Chinese and 375px checks plus the complete
      114-route audit pass at 78 Canonical / 36 Preview.

## EPIC-033 — Canonical Purchasing Transaction Details

**Goal:** replace the fixed sample goods-receipt and supplier-invoice documents with
record-specific, read-only workspaces backed by the existing canonical procure-to-pay
facts, without adding a parallel detail schema or browser-side posting logic.

Acceptance criteria:

- [x] Every row in `goods-receipts` and `supplier-invoices` navigates with its real
      record ID; neither route special-cases an old prototype document number or falls
      through to `pur-txn-view`.
- [x] Goods-receipt detail joins the canonical receipt, purchase order and PO lines for
      presentation and shows only linked `stock_movement` facts (`ref_type =
      goods_receipt`, matching receipt ID).
- [x] Supplier-invoice detail joins the canonical invoice, PO, receipt and PO-line
      snapshots, computes its real outstanding balance and shows the linked journal
      with account names and an explicit debit/credit balance proof.
- [x] Both screens state posted-document immutability, offer navigation rather than
      fabricated write buttons, use bounded formal resources in Demo/API and include
      en/ms/zh/ja/vi copy.
- [x] CI smoke creates and approves a PO, receives it, posts its supplier invoice and
      asserts one receipt movement plus three balanced AP journal legs render on the
      two Canonical detail routes. The full 114-route desktop/375px audit passes at
      80 Canonical / 34 Preview.
- [x] The active purchasing sub-navigation remains visible after a live
      desktop-to-375px resize; the route audit includes this lifecycle regression.

## EPIC-034 — Supplier Contracts and Derived Vendor Performance

**Goal:** replace Purchasing's sample supplier contracts and manually-curated vendor
ratings with effective-dated canonical pricing plus a scorecard rebuilt from real
procure-to-pay facts.

Acceptance criteria:

- [x] Migration 0035 adds tenant-scoped, versioned `supplier_price_list` headers and
      quantity-tier lines linked to real suppliers and products, with date, currency,
      lead-time and positive-value constraints.
- [x] Shared Decimal commands create draft contracts, reject cross-company or duplicate
      tiers, prevent ambiguous active product/date overlap, and activate once through an
      audited idempotent action. Existing purchase documents remain immutable snapshots.
- [x] Vendor performance has no independent KPI table or curated score. A shared bounded
      read model derives receipt rate, quoted-lead on-time rate, actual lead days, invoiced
      spend, credited-return rate, exact invoice match and active-contract coverage from
      canonical orders, receipts, invoices, returns, quotations and price lists.
- [x] Demo ESM and production API expose the two contract resources plus the derived
      performance resource under Purchasing RBAC; production RLS and migration-generated
      PGlite schema remain aligned.
- [x] `supplier-price-lists` and `vendor-performance` are five-language Canonical Demo/API
      routes. Domain/API/browser and full release gates pass at 82 Canonical / 32 Preview.

## EPIC-035 — Canonical Purchasing Analytics and Sourcing Documents

**Goal:** close Purchasing's remaining Preview boundary without introducing a parallel
KPI store or fabricating supplier-invoice lines that the domain does not own.

Acceptance criteria:

- [x] Add bounded `purchasing/analytics` and `purchasing/price-variance` derived
      resources under Purchasing read permission, tenant scope and keyset-style cursors.
- [x] Dashboard and reports derive supplier spend, real approval-actor buyer value,
      order/receipt/invoice/requisition status, net AP and contract coverage directly
      from canonical facts with Decimal arithmetic.
- [x] Price variance compares immutable invoice and PO headers and explicitly discloses
      that line variance is unavailable; no fake item rows, budgets or export actions.
- [x] `pur-txn-view` becomes a record-specific RFQ/quotation workspace with real lines,
      invited suppliers, responses and registered issue/respond/compare/convert actions.
- [x] All eight Purchasing routes are five-language Canonical in Demo/API; CI smoke,
      301-test suite, schema/drift, desktop/375px and 114-route audit pass at 90/24.

## EPIC-036 — Direct Sales Order Authoring and Approval Gate

**Goal:** replace Sales' sample new-order form and disconnected approval queue with one
real, auditable commercial-document boundary before inventory or accounting begins.

Acceptance criteria:

- [x] Migration 0036 adds one tenant-scoped, versioned `sales_order_approval` per order
      and constrains sales-order lifecycle states to pending approval, draft, confirmed,
      rejected or cancelled.
- [x] Direct orders validate real company customers/products, snapshot effective tax with
      Decimal arithmetic and atomically create their lines plus one pending approval.
- [x] Approve/reject locks both records, requires a note, validates the active company
      actor, snapshots the decision and changes only order/approval state. Approval writes
      no stock movement, delivery, invoice or GL entry.
- [x] Accepted quotations now create the same pending approval boundary rather than an
      immediately confirmable draft; confirmation remains restricted to approved drafts.
- [x] `new-sales-order` and `so-approvals` use bounded real Demo/API resources, five-language
      copy and responsive Canonical UI. Domain/API/live-browser proof covers tax totals,
      tenant and actor guards, replay, Viewer denial, audit and the no-stock/no-GL boundary.
- [x] Full release gates pass at 92 Canonical / 22 Preview with 37 migrations and 110
      exported tables.

## EPIC-037 — Canonical Sales Analytics

**Goal:** replace Sales' sample dashboard, targets, forecasts and report shells with
bounded analytics rebuilt from canonical commercial documents.

Acceptance criteria:

- [x] `sales/analytics` derives recognized revenue, open receivables, open commercial
      work, monthly revenue, customer/owner revenue and document-status facts directly
      from invoices, credit/debit notes, orders, enquiries, returns, quotations and
      deliveries. No independent KPI, target or forecast table is introduced.
- [x] Decimal calculations subtract posted credits and add posted debits at summary,
      month and customer levels; tenant isolation and bounded cursor reads are covered
      by domain and authenticated API tests.
- [x] `sales-home`, `sales-reports`, `report-sales-customer`, `report-sales-rep`,
      `report-quote-conversion` and `report-generic` use the formal resource in Demo/API,
      remove fake export/run actions and include en/ms/zh/ja/vi copy.
- [x] CI smoke creates a real confirmed sale, proves positive analytics and visits all
      six Canonical routes. The full desktop/375px audit passes at 98 Canonical / 16
      Preview without page, action-bar or active-subnav overflow.

## EPIC-038 — Canonical Sales Commission

**Goal:** replace the sample commission list with effective-dated plans and immutable,
auditable source-document calculation runs without pretending approval is payroll.

Acceptance criteria:

- [x] Migration 0037 snapshots salesperson ownership onto orders/invoices and adds
      tenant-scoped, versioned plans plus immutable run, line and source tables with
      production RLS and migration-generated PGlite alignment.
- [x] Shared Decimal commands enforce one non-overlapping active plan per salesperson,
      non-overlapping run periods, source-level rounding and invoice minus posted-credit
      plus posted-debit reconciliation without silently dropping unattributed sources.
- [x] Approval requires `sales.commission.approve`, a note, audit and idempotency; it
      freezes the decision without creating payroll, payout, inventory or GL records.
- [x] Demo/API resources expose bounded plans, runs, lines, sources and company users;
      domain and authenticated API tests prove tenant isolation, Viewer denial,
      ownership snapshots, replay and immutable historical results.
- [x] `sales-commission` is a five-language Canonical route with real create, activate,
      calculate, trace and approve flows. Smoke and full desktop/375px audit pass at
      99 Canonical / 15 Preview.

## EPIC-039 — Canonical Sales Enquiry Transaction Workspace

**Goal:** close Sales' final Preview route without retaining a second document model or
passing mutable presentation records between screens.

Acceptance criteria:

- [x] `txn-view` stores only an enquiry ID and re-reads the selected tenant-scoped
      enquiry, customer and uniquely linked quotation through formal Demo/API resources.
- [x] `sales/quotations` exposes an allowlisted positive `enquiryId` filter with unit and
      authenticated HTTP coverage; unsupported or zero identifiers remain rejected.
- [x] The enquiry register opens the record workspace. Conversion delegates to the
      existing audited/idempotent command; quotation and all later sales documents keep
      their dedicated Canonical detail routes.
- [x] Fabricated activity, actors, PDF/payment/export actions and toast-only state changes
      are removed from the route. Only timestamps, ownership, status and relationships
      present in canonical records are displayed.
- [x] The five-language workspace, Demo/API build, browser smoke and full desktop/375px
      audit pass at 100 Canonical / 14 Preview.

## EPIC-040 — Canonical Manual Journal Posting and Reversal

**Goal:** replace the sample new-journal form with one tenant-scoped, balanced and
auditable finance command boundary whose posted history can only be corrected by a
separately numbered reversal.

Acceptance criteria:

- [x] Migration 0038 adds versioned `journal_header` and immutable `journal_line`
      tables with tenant/company/document uniqueness, status/type checks, exact-one-side
      line checks, reversal linkage, production RLS and generated PGlite alignment.
- [x] Shared Decimal commands create GL-neutral drafts, validate real company accounts
      and calendar dates, post exactly balanced dated GL legs once, and create a linked
      reversal by swapping every debit and credit without mutating the original facts.
- [x] Demo/API resources expose bounded headers/lines plus audited, idempotent post and
      reverse actions. Domain and authenticated HTTP tests cover rollback, cross-company
      accounts, Viewer denial, replay, duplicate posting/reversal and date guards.
- [x] `new-journal-entry` and the existing journal detail use real five-language data and
      actions. The composer exposes loading/error/empty states; posted/reversal details
      have no fake edit/export path and no Preview fallback.
- [x] CI smoke creates, posts and reverses a balanced manual journal. The full desktop/
      375px audit passes at 101 Canonical / 13 Preview.

## EPIC-041 — Canonical Bank Reconciliation

**Goal:** replace the sample bank-reconciliation interaction with imported statement
facts and one-to-one links to immutable bank-account GL legs, without silently creating
accounting entries.

Acceptance criteria:

- [x] Migration 0039 adds versioned tenant-scoped `bank_statement` and immutable
      `bank_statement_line` tables with document/line/matched-GL uniqueness, period,
      status, non-zero amount checks, production RLS and generated PGlite alignment.
- [x] Shared Decimal commands validate statement footing, dates, asset-account tenancy
      and exact signed GL amount; one GL leg cannot be reused and a completed statement
      cannot be unmatched or changed.
- [x] Demo/API resources expose bounded statements/lines and account-filtered GL entries.
      Import plus idempotent audited match/unmatch/reconcile actions have domain and
      authenticated HTTP tests for rollback, Viewer denial, tenant and state guards.
- [x] `bank-rec` is a five-language Canonical Demo/API workspace with real CSV import,
      exact candidate matching, explicit journal hand-off for missing activity and no
      fake auto-booking or toast-only completion.
- [x] CI smoke performs real journal → statement → match → reconcile. Full desktop/375px
      audit passes at 102 Canonical / 12 Preview.

## EPIC-042 — Canonical Management Reporting and Stock Activity Aging

**Goal:** replace the three sample BI surfaces with one bounded, tenant-scoped read model
that reconciles directly to Canonical commercial, purchasing, inventory and ledger facts.

Acceptance criteria:

- [x] `bi/analytics` derives recognized revenue, receivables, open sales/purchase value,
      net unpaid payables, cash and total inventory value without storing a KPI table.
- [x] Product-category analysis uses real invoice lines less product-linked posted credit
      lines. Header-only debit notes remain in company recognized revenue but are not
      falsely allocated to a category.
- [x] Stock aging reads current positive product/warehouse balances and labels age as
      days since the latest inbound movement. It explicitly does not claim FIFO layer age
      because the current schema stores no inventory cost layers.
- [x] The derived resource is bounded/keyset-paginated, tenant-isolated and protected by
      `reporting.read`; Demo and API share the same TypeScript query path.
- [x] `bi-dashboard`, `sales-analysis` and `stock-aging` are five-language Canonical
      routes with honest loading/error/empty semantics and no fake export/report action.
      Smoke and the desktop/375px route audit pass at 105 Canonical / 9 Preview.

## EPIC-043 — Canonical Product Master Creation

**Goal:** replace the separate sample `new-item` composer with the same tenant-scoped
product command used by Item Master, while preserving the inventory movement ledger as
the only source of physical quantity.

Acceptance criteria:

- [x] `new-item` creates only the real `product` fields through `ErpSystemData` in Demo
      and API modes; it never mutates `DB.items` or exposes fabricated accounting, tax,
      shelf-life, negative-stock or costing-method fields.
- [x] SKU uniqueness is enforced atomically per master/company and maps to a useful 409;
      validation maps to 422, tenant override to 400 and Viewer writes to 403.
- [x] New products have no `stock_level` or `stock_movement` row. The five-language UI
      explains that initial stock must enter through Purchase Receipt or Stock Adjustment.
- [x] Authenticated API tests prove tenant scope, audit, read access, permissions and the
      zero-stock boundary; Demo smoke creates through the rendered form and verifies the
      persisted Decimal planning fields.
- [x] The route is Canonical in Demo/API, service worker advances to v67 and full
      desktop/375px audit passes at 106 Canonical / 8 Preview.

## EPIC-044 — Canonical Project Timesheet

**Goal:** replace the sample weekly grid with signed-in-user project-time facts that
can be corrected without deleting audit history or fabricating approval/payroll state.

Acceptance criteria:

- [x] Migration 0040 adds tenant/company/actor/project-scoped `project_time_entry`
      rows with real dates, Decimal hours, version, active/void state, required void
      metadata, production RLS and generated PGlite alignment.
- [x] Shared create/void commands require an active company user and open tenant project;
      actor scope comes from Session, and correction row-locks then preserves the original
      hours while marking the entry void instead of deleting it.
- [x] Demo/API resources expose bounded actor-owned weekly reads and audited writes.
      Domain and authenticated HTTP tests prove date/precision/state validation, tenant
      and actor isolation, Viewer denial, audit and idempotent void replay.
- [x] `timesheet` is a five-language Canonical route with real create/void workflows,
      active-only totals, visible void history and no fake capacity, copy or approval.
- [x] Demo smoke, live in-app browser and the full desktop/375px route audit pass with
      348 tests plus one expected skip, 41 migrations, 119 tables and maturity 107/7.

## EPIC-045 — Canonical Sanitized Integration Delivery Log

**Goal:** replace the sample integration-log table with a tenant-scoped operational
read model over the existing transactional outbox without exposing message contents,
credentials or worker infrastructure details.

Acceptance criteria:

- [x] `integration/events` reads only explicit safe columns from `outbox_event`, scopes
      every query by Session master/company and provides newest-first keyset pagination
      with a maximum page size of 100.
- [x] The response never includes payload, email/token material, raw worker errors or
      lock-owner/host identity. Raw failures collapse to a small safe error vocabulary.
- [x] Demo and API use the same TypeScript read path protected by `integration.read`;
      authenticated HTTP tests cover tenant isolation, authentication, unsupported
      offset rejection and the sanitized response contract.
- [x] `integration-logs` is a five-language Canonical read-only workspace with honest
      loading/error/empty states, filters and safe details. It does not invent manual
      replay, export or connector-configuration writes.
- [x] Demo smoke seeds a secret-bearing outbox event and proves the topic renders while
      the secret does not. The full desktop/375px audit passes at 108 Canonical / 6 Preview.

## EPIC-046 — Canonical Bounded Customer CSV Import

**Goal:** replace the sample import wizard with a real, deliberately bounded customer
CSV workflow that validates first, preserves row-level evidence and commits valid rows
atomically in both Demo and production API modes.

Acceptance criteria:

- [x] Migration 0041 adds tenant-scoped/versioned `import_job`, normalized
      `import_job_row` and append-only `import_row_error` facts with production RLS and
      generated PGlite alignment.
- [x] The shared command accepts only `code,name,industry`, rejects tenant fields and
      files over 250 rows, normalizes customer codes and persists duplicate/validation
      decisions before any customer write.
- [x] A validated job runs once in one transaction, uses an explicit update-or-skip
      policy and rolls back every customer/row/job change if any ready row is corrupt.
      The run action is permission-gated, audited and idempotent.
- [x] Demo/API expose newest-first keyset-paginated jobs plus bounded row/error reads;
      authenticated tests prove tenant isolation, Viewer read-only access, query guards,
      audit and replay.
- [x] `data-import` is a five-language Canonical workspace with file/paste input,
      template download, validation summary, row errors and explicit customer-only/
      small-file boundaries. Smoke and desktop/375px audit pass at 109/5.

## EPIC-047 — Canonical Actor-Owned Personal Activity

**Goal:** replace the fictional personal account feed with a private, sanitized view of
the current user's recorded application writes for the active company.

Acceptance criteria:

- [x] `account/activity` filters exact Session master/company/actor scope, returns newest
      first with keyset pagination and uses an actor-leading audit index.
- [x] The public row shape contains only id, bounded category/entity/action vocabulary,
      entity reference and timestamp. It never returns before/after payloads, request ID,
      actor identity, raw internal names, device/IP or security/session information.
- [x] Demo and API call the same TypeScript query; the API uses an opaque cursor and
      rejects offset, unknown filters, malformed cursors and limits above 100.
- [x] `my-activity` is a five-language Canonical read-only workspace with explicit scope,
      loading/error/empty behavior and no invented export, sign-in, comments or session
      controls. The Enquiries register also follows the approved Suppliers-list layout.
- [x] Lint, dual typecheck, 365 tests plus one expected skip, 43-migration/122-table
      alignment, PGlite/PostgreSQL parity, smoke, live in-app browser and all 114
      desktop/375px routes pass at 110 Canonical / 4 Preview.

## EPIC-048 — Canonical Actor-Addressed Notifications

**Goal:** replace the fictional notification feed and browser-local read state with a
first-class delivery model owned by one recipient in one active company.

Acceptance criteria:

- [x] Migration 0043 adds tenant/company/recipient-scoped `app_notification` facts with
      bounded kind/severity vocabulary, delivery/read/dismiss timestamps, versioning,
      an actor-leading feed index, production RLS and generated PGlite alignment.
- [x] Server-only delivery validates an active company recipient; public reads expose
      only safe notification content and never tenant/user identifiers. The notification
      model is independent of operational outbox delivery and append-only audit history.
- [x] Demo/API use shared TypeScript list/read/dismiss commands. Authenticated actions
      require explicit permissions, CSRF, idempotency and audit, while cross-user and
      cross-company rows remain unavailable.
- [x] The bell and five-language `notifications` workspace read the same canonical feed;
      read/dismiss state persists in the database, company switching reloads it, and no
      localStorage state, fake preference or sample fallback remains.
- [x] The route follows the approved KPI/filter/rounded-list visual standard and moves
      maturity to 111 Canonical / 3 Preview with 371 tests plus one expected skip,
      44 migrations, 123 tables and service-worker v72.

## EPIC-049 — Final Canonical Control Plane

**Goal:** remove the final three Preview routes without introducing browser-held
production secrets or a misleading cross-tenant administration surface.

Acceptance criteria:

- [x] Migration 0044 adds tenant-scoped connector, company-policy, document-sequence
      and accounting-period tables with generated PGlite alignment and production RLS.
- [x] Production connector configuration encrypts credentials with AES-GCM; public
      responses omit the envelope and offline Demo refuses to store secrets.
- [x] Master Control exposes only the Session tenant’s real companies, active-company
      users, roles and module state. System Settings provides audited policy, sequence
      and period actions plus effective-dated tax facts.
- [x] Demo/API use shared TypeScript commands behind RBAC, CSRF, tenant validation and
      append-only audit. First-run setup creates usable control-plane defaults.
- [x] Five-language route copy, service-worker v73, 379 tests plus one expected skip,
      45 migrations/127 tables, builds, smoke, in-app browser proof and all 114 routes
      pass at 114 Canonical / 0 Preview.

## EPIC-050 — Stable Async Navigation Feedback

**Goal:** keep the shared async loading shell visually and semantically stable with the
page that replaces it, without exposing internal hash-route slugs to users.

Acceptance criteria:

- [x] Loading and error headings resolve from translated module/navigation metadata.
- [x] Module home routes use the module label; other known routes use their declared
      navigation label; unknown routes fall back to readable title case.
- [x] The desktop and 375px route audit proves the Purchasing loader says `Purchasing`
      before the asynchronous page resolves.
- [x] The PWA cache version advances and the standard local quality gates pass.

## EPIC-051 — Transaction-list UI SSOT

**Goal:** make the approved Suppliers/Enquiries register layout a real page-level
contract instead of a visual convention that each module may reconstruct differently.
Canonical data maturity and visual-layout compliance remain separate metadata.

Delivery slices:

- [x] **TASK-087 — foundation + Work Orders pilot.** `transactionListPage()` owns
      the KPI/filter/toolbar/table/empty/pagination regions, composes `modulePage()`
      with `buildTable()`/`wireTable()`, and emits
      `data-layout="transaction-list-v1"`. `SCREEN_META.layout` and the desktop/375px
      runtime audit enforce the declared structure. Work Orders is migrated without
      changing its real data or commands; service worker v75 delivers the UI.
- [x] **TASK-088 — Sales/Purchasing.** Migrate both register families, then remove
      their duplicated high-level page chrome while retaining real row actions.
- [x] **TASK-089 — manufacturing operations.** Migrate qualifying Inventory,
      Warehouse, Manufacturing and Quality registers without force-fitting intentional
      master-detail or document-detail workspaces.
- [x] **TASK-090 — back office/platform.** Migrate Finance, CRM, HR, Projects,
      Service, Assets, Admin and Integration registers with their permission and
      sanitization boundaries intact.
- [x] **TASK-091 — enforcement/cleanup.** Classify every route layout, delete the
      obsolete list factories and reject new page-level hand-authored list chrome.
- [x] **TASK-092 — Sales Orders correction.** Reclassify the Sales Orders register
      from master-detail to `transaction-list-v1`, retain real detail navigation and
      row actions, and remove its unsupported Filter/Export and inline preview chrome.
- [x] **TASK-093 — Inventory master-detail register SSOT.** Extend the shared list
      contract with an optional desktop detail pane/mobile drawer, then migrate Stock
      on Hand and Item Master off their hand-built page heads, toolbars and tables.
      Both routes declare `master-detail-register-v1`; the list audit validates all
      six required regions at desktop and 375px.
- [x] **TASK-094 — Inventory Valuation report-list SSOT.** Add the analytical
      `report-list-v1` specialization of the list contract and migrate Inventory
      Valuation from its hand-built parameter/result split. Retain canonical valuation
      facts, KPIs and category filtering while removing unsupported report controls.
- [x] **TASK-095 — Warehouse Picking operational-workspace SSOT.** Add
      `operational-workspace-v1` for one active execution task, then migrate Picking
      onto its shared progress, work area, context rail, responsive actions and
      retryable error regions without changing canonical warehouse commands.
- [x] **TASK-096 — Project Timesheet transaction-list SSOT.** Correct the
      data-canonical Timesheet route that remained under the unstructured `workspace`
      exemption. Render loading, error, empty and populated weekly states through
      `transactionListPage()`, preserve actor-owned create/void behavior, replace its
      hand-built KPI/toolbar/document-table chrome with the standard list regions and
      add five-language/state audit coverage. Service worker v94 delivers the change.
- [x] **TASK-097 — Employee master-detail editor SSOT.** Reclassify the canonical
      employee profile from the unstructured `document-detail` exemption to
      `master-detail-editor-v1`. Reuse `masterDetailEditorPage()` for the standard
      overview/main/context/actions regions, add optional structured avatar support,
      replace read-only contact inputs and duplicate employment chrome with display
      facts, bound leave-history scrolling, and add five-language/state enforcement.
      Service worker v95 delivers the change without changing HR data or commands.
- [x] **TASK-098 — Employee profile action hierarchy polish.** Extend the shared
      master-detail editor with optional page-header actions, then move Employee's
      Review leave action beside its status. Remove the redundant employee number,
      Back button and visible footer action bar while preserving the hidden actions
      region, Directory navigation and five-language behavior. Service worker v96
      delivers the corrected hierarchy.
- [x] **TASK-099 — Payroll run modal correctness and responsiveness.** Restore the
      native hidden contract for inline alerts, constrain shared modal widths to the
      viewport and generate Payroll period defaults from the local calendar instead
      of UTC-converted local midnight. Align the modal error with its form and extend
      desktop/375px Payroll audits to cover initial, invalid and clickable states.
      Service worker v97 delivers the fix without changing payroll commands or data.
- [x] **TASK-100 — Service Order case-detail SSOT.** Reclassify Service Order from
      the unstructured `document-detail` exemption to `case-detail-v1`. Extend the
      shared Case Detail renderer with an optional structured lifecycle, migrate the
      overview/diagnosis/SLA/contract/actions surface, fix Customer 360 targeting and
      remove the `.dt` title collision that caused mobile clipping. Static and
      five-language state audits enforce the corrected desktop/375px layout, while
      Service worker v98 delivers the change without altering service commands.
- [x] **TASK-101 — List-row interaction SSOT and Service Contract detail.** Add an
      explicit `rowAction` contract so only rows with a real route, detail pane or
      dialog receive pointer/hover/selection and keyboard affordances. Migrate all
      42 shared lists, remove toast-only and wrong-target opens, and add the missing
      read-only `service-contract` route through `master-detail-editor-v1`.
      Mouse, Enter and Space share one action while nested controls are isolated.
      Focused list/master-detail audits and service worker v99 enforce the change.
- [x] **TASK-102 — Depreciation master-detail register SSOT.** Reclassify the
      canonical Depreciation run page from the unstructured `workspace` exemption
      to `master-detail-register-v1`. Replace the hand-built report split with the
      shared KPI/filter/table/detail regions, expose bounded Draft/Posted/Cancelled
      history, move creation and confirmed posting into responsive recoverable
      modals, and retain the existing straight-line and GL commands. Five-language
      state audits and service worker v100 enforce the desktop/375px contract.
- [x] **TASK-103 — Asset Detail master-data SSOT.** Reclassify the canonical
      Asset Detail page from the legacy `master-detail` exemption to
      `master-detail-editor-v1`. Replace hand-built document chrome and read-only
      form controls with the shared overview/main/context/actions regions, preserve
      real posted depreciation history and book-value calculations, and constrain
      history through the standard responsive table. Five-language state audits and
      service worker v101 enforce the desktop/375px contract.
- [x] **TASK-104 — Purchase Order Approval case-detail SSOT.** Reclassify the
      canonical Purchase Order Approval detail from the unstructured
      `document-detail` exemption to `case-detail-v1`. Render order identity, four
      approval facts, controlled lines, financial totals, the decision record and
      pending Approve/Reject commands through the standard five regions. Remove
      duplicate Back navigation and legacy footer chrome while preserving the real
      note validation, idempotent command and audited decision refresh. Five-language
      state audits and service worker v102 enforce the desktop/375px contract.
- [x] **TASK-105 — Goods Receipt posting-detail SSOT.** Reclassify the immutable
      Canonical Goods Receipt from the unstructured `document-detail` exemption to
      `posting-detail-v1`. Broaden the shared Posting Detail description to include
      operational stock postings, then render receipt identity, four source facts,
      controlled document lines, inventory movement evidence, stock-effect context
      and one header navigation action through the standard regions. Remove duplicate
      Back/footer chrome while preserving all Canonical receipt and movement reads.
      Five-language state audits and service worker v103 enforce the desktop/375px
      contract.

## EPIC-052 — Employee Self-Service Identity & My Work (In progress)

Build the identity boundary required for employee-owned leave, receipt and expense
workflows. This epic extends the current email/single-role account model without
changing the maturity of any existing route until Demo/API parity is proven.

Confirmed product decisions: employees sign in with organisation code + an
organisation-unique username; HR chooses the username (default employee number) and
creates a one-time password. HR may reveal the encrypted temporary password only
before first activation, with every reveal audited. First login requires a password
change and an email address, but email verification, MFA and step-up authentication
remain optional by explicit product decision. One user may hold multiple roles in one
company, and every self-service resource derives the employee identity from Session.

- [x] **TASK-106 — Add organisation username login and multi-role assignments.**
      Add organisation login codes, organisation-scoped usernames, nullable
      pre-activation email, multiple company-role grants and a non-destructive
      migration for existing email accounts and single-role assignments. Delivered
      through migration 0046, the organisation-first production login, explicit
      audited role-union management and service worker v104.
- [x] **TASK-107 — Link Employee to app_user and implement HR account lifecycle.**
      Create the company-unique employee/user link, encrypted activation credential,
      audited pre-activation reveal, forced first-login completion, HR one-time
      password reset and immediate session revocation on offboarding. Delivered by
      migration 0047, company-scoped HR endpoints, a five-language activation/account
      UI and PWA v105; offboarding transfers current responsibility without rewriting
      historical attribution.
- [x] **TASK-108 — Add actor-owned `/api/my/*` contracts.** Resolve employee identity
      from the authenticated Session, reject client-supplied employee impersonation,
      expose only self-owned leave facts and keep management resources behind separate
      permissions and hierarchy scopes. Delivered by migration 0048 and PWA v106:
      API and Demo expose actor-derived context, own leave and privacy-redacted team
      leave. Claims/receipts declare `not_modelled` until EPIC-054/055 rather than
      fabricating records.
- [x] **TASK-109 — Build the five-language My Work shell.** Five Preview routes now
      reuse `transaction-list-v1`: My Leave reads only the Session actor's real leave,
      My Claims and My Receipts disclose their governed `not_modelled` boundary, and
      Team Calendar/My Approvals appear only when `/api/my/context` grants team scope.
      Team rows remain privacy-redacted and approval is deliberately read-only until
      TASK-113/114. Employee-only API accounts can boot the restricted My Work shell
      without `dashboard.read`; PWA v107 delivers all five-language assets. Existing
      Canonical maturity remains 115 while the accepted shell adds five Preview routes.
- [x] **TASK-110 — Prove identity migration, access and security boundaries.** Covers
      cross-organisation username reuse, same-organisation collisions, multi-role
      permission union, first activation, temporary-secret destruction, HR reset,
      offboarding, hierarchy scope and the accepted no-MFA/unverified-email risks.
      Migration 0049 adds role-grant provenance; reporting lines now automatically
      maintain only their own Manager grant, while manual Manager authorization is
      preserved and locked in User Management. PWA v108 and `docs/SECURITY.md`
      document and prove the boundary without promoting the five Preview routes.

## EPIC-053 — Full Leave Management (In progress)

Replace the current HR-lite three-type/calendar-day request model with versioned leave
policy, immutable entitlement facts, multi-stage approval and a team calendar. Existing
leave rows remain historical facts: their stored day count is preserved under a
Legacy Policy marker and is never silently recomputed.

- [x] **TASK-111 — Add working calendars, holidays, leave types and policy versions.**
      Support country/region holiday presets that HR confirms, company holidays,
      full-day/half-day units, effective-dated entitlements, accrual, carry-forward,
      expiry, evidence rules, staffing controls and encashment policy. Delivered by
      migration 0050 and PWA v109: five tenant-scoped policy tables, confirmed-only
      historical resolvers and deterministic working-day/half-day calculation.
      Official imports remain inert drafts until HR confirms them; existing HR-lite
      leave rows remain unchanged Legacy snapshots.
- [x] **TASK-112 — Add the immutable leave balance ledger.** Migration 0051 records
      grant, accrual, pending reservation, use, release, cancellation, adjustment,
      carry-forward, expiry and encashment as tenant-scoped append-only entries.
      Database mutation is rejected, entry keys make replay idempotent and paid
      reservation serializes per employee. Pending reserves balance; approval or
      rejection appends use/release, while insufficient balance returns an explicit
      paid/unpaid split. PWA v110; no route maturity change.
- [x] **TASK-113 — Add complete leave application lifecycle and evidence.** Migration
      0052 adds governed request headers, immutable revisions/events, evidence metadata
      and approved-cancellation decisions. Actor-derived My Leave now creates and opens
      real drafts through `transaction-list-v1` and `case-detail-v1`; every command uses
      optimistic versioning, CSRF, idempotency and audit. Pending reserves entitlement,
      withdrawal/rejection releases it, approval consumes it and approved cancellation
      restores it. Employee “delete” is a reasoned Void tombstone, never physical
      erasure; legacy rows remain read-only snapshots. Medical content remains deferred
      to DocumentStorageProvider, while evidence-required/state metadata is privacy
      redacted for managers. PWA v111.
- [x] **TASK-114 — Add configurable approval, delegation and capacity controls.**
      Migration 0053 implements effective-dated, versioned approval policies with
      employee/department/type/day/amount/currency conditions and ordered direct
      manager, named employee or permission steps. Workflow instances snapshot the
      original authority; immutable decisions/events distinguish direct, delegated
      and escalated actors, while self-approval is rejected. Delegation is bounded,
      revocable and historically retained; reminder/escalation notifications are
      idempotent. Capacity snapshots re-evaluate department coverage and warn, append
      a policy approval level or block. `my-approvals` is now a five-language
      privacy-redacted Canonical Demo/API workspace with real decisions and delegation
      management. PWA v112.
- [x] **TASK-115 — Add `calendar-workspace-v1` and optional outbound calendar sync.**
      Migration 0054 adds optional tenant-scoped outbound connections and revision-keyed
      delivery jobs. Team Calendar is now a five-language Canonical month/week/list
      workspace with direct-report default scope, authorised hierarchy expansion,
      department/status filters, conflict indicators, responsive detail and strict
      reason/evidence redaction. Final approval, approved change and cancellation enqueue
      idempotent one-way delivery; workers supersede stale jobs and reuse the external
      event identity while ERP remains authoritative. A persistent-Demo upgrade
      signature repair prevents stale schema markers. PWA v114.
- [x] **TASK-116 — Connect leave to Payroll and migrate HR-lite safely.** Migration
      0055 adds immutable, revision-linked unpaid-leave/cancellation/encashment sources,
      one-time run mappings and base/leave snapshots on every payroll line. Approved
      unpaid leave feeds deductions and policy-approved encashment feeds earnings while
      legacy request day snapshots and old route aliases remain unchanged. The exact
      26-day half-up formula, balance gate, overlap replay and append-only triggers
      prevent duplicate effects. Persistent Demo SQL is versioned and post-verified so
      stale service-worker assets cannot write a false schema marker. PWA v116.

## EPIC-054 — Receipt & Secure Document Processing (In progress)

Create the reusable document boundary for leave evidence, expense receipts, card
proof and tax evidence. PostgreSQL/PGlite byte storage is the default confirmed
deployment; a server-filesystem provider is optional and explicitly single-node.

- [x] **TASK-117 — Introduce DocumentStorageProvider and receipt metadata.** Migration
      0056 stores tenant ownership, immutable version/SHA-256/MIME/size facts,
      retention and legal hold independently from content. PostgreSQL/PGlite `bytea`
      is the default cluster-safe provider; an explicitly configured filesystem root
      is single-node and stores only opaque content plus a database-owned locator.
      Both providers enforce identical owner/manager/cross-tenant authorization and
      verify content integrity on read. PWA v117.
- [x] **TASK-118 — Add secure upload and mobile offline capture.** Accept JPEG, PNG,
      HEIC and PDF up to 20 MB/20 pages, validate magic bytes, stream bounded content,
      support camera/crop/rotate/compress and clear unsynced local drafts after an
      explicit logout warning.
- [x] **TASK-119 — Add quarantine, scanning and asynchronous extraction.** Fail closed
      when malware scanning is unavailable or uncertain; default to local OCR and
      allow external BYOK Vision only after company opt-in with provider, region and
      retention metadata. Migration 0058 adds retry-safe jobs/outbox signals,
      upgrade backfill, encrypted-connector policy controls and PWA v119.
- [x] **TASK-120 — Add confidence-governed receipt inbox and auto-submit.** Migration
      0059 persists immutable field source/model/confidence candidates, prior uploader
      authorization and a governed receipt inbox. Company policy defaults auto-submit
      off and cannot set its threshold below 98%. Safety, critical-field validity,
      confidence, conflict, amount and exact-duplicate checks must all pass; otherwise
      explicit human review is required. A successful system submission records both
      the uploader authorization and `receipt-auto-submit-v1` system actor. PWA v120.
- [x] **TASK-121 — Add document void, retention and purge governance.** Migration
      0060 permits governed physical deletion only for an unsubmitted draft; submitted
      or approved records require reasoned Void, while posted or sealed facts require
      an immutable correction/reversal version. Legal hold, tax finalisation and
      paper-original custody block purge. Records Manager initiation plus a distinct
      Finance review is required after retention; execution removes operational
      content and metadata while retaining a permanent hash/version tombstone. PWA v121.
- [x] **TASK-122 — Audit document access and storage parity.** Migration 0061 adds
      append-only, purge-surviving access facts for every view/download/print/export:
      tenant, actor, declared purpose, document/version/hash, stable retry key and
      timestamp. The content API fails closed before a clean scan, enforces owner or
      explicit manager access, integrity-checks bytes and records a single event per
      retry key. Database and filesystem providers pass the same authorization,
      retention, SHA-256, privacy and tenant proofs. PWA v122.

## EPIC-055 — Expense Claims & Accounting (Planned)

Add employee reimbursement, company-paid evidence and policy-driven non-receipt
expenses without treating employees as suppliers or mixing reimbursement into payroll.
An authenticated upload may authorise 98%-confidence system submission; final finance
approval is the accounting boundary.

- [x] **TASK-123 — Add effective-dated expense, tax, FX and GL policy.** Migration
      0062 adds confirmed non-overlapping category policy versions for evidence,
      base-currency limits, payment sources, tax treatment/recovery, expense/input-tax
      and employee-payable/company-clearing accounts plus table-rate or actual-bank FX.
      Submission creates an immutable Decimal-exact original/base policy snapshot.
      Only Finance may attach clean immutable evidence and record an append-only actual
      bank-charge override; ordinary line facts are never rewritten. PWA v123.
- [x] **TASK-124 — Add multi-line claims, receipt inbox and allocation.** Migration
      0063 adds employee-owned multi-line drafts, linked governed receipt inbox items
      and Decimal-exact department/cost-centre/project allocation by amount or
      percentage. Session-derived My Claims commands enforce owner-only draft changes
      and final submission. System submission additionally requires immutable prior
      employee authorization plus an eligible employee-authorized system-submitted
      receipt on every line. Submitted facts, authorization, revisions and events are
      database-protected from mutation. PWA v124.
- [x] **TASK-125 — Add line-level approval, duplicate and budget control.** Migration
      0064 starts one governed approval per submitted line, defaults to direct Manager
      then Finance and may insert a configured budget-exception step before Finance.
      Approve/reject/return decisions are line-specific; self-approval and employee-fact
      edits remain forbidden. Immutable assessments combine exact file hash,
      provider-generated visual fingerprint and merchant/date/gross/tax-number signals.
      High-risk final approval requires a Finance-permission override with a reason.
      Effective policy applies budget warning, extra approval or transactional block.
      PWA v125.
- [x] **TASK-126 — Add corporate-card statement reconciliation.** Migration 0065
      atomically imports one exact eight-column CSV/XLSX worksheet bounded to 5 MB and
      1,000 rows after validating source schema, tenant, dates, amounts and duplicate
      external/fingerprint facts. Holder/date/currency/amount matching persists up to
      three explainable confidence-ranked candidates but requires Finance acceptance
      or rejection. Unknown holders, missing receipts and rejected suggestions create
      persistent assigned follow-up; resolve/waive actions and every review state are
      append-only audited. PWA v126.
- [x] **TASK-127 — Add mileage, per diem and cash advances.** Migration 0066 snapshots
      confirmed effective mileage/per-diem rate, unit, policy version, Decimal result
      and formula evidence while explicitly requiring no receipt. Finance approval is
      separate from the employee owner. Cash-advance issue, approved-source application
      and exact employee repayment reconcile before close; balanced paired GL entries,
      employee-payable difference, applications and lifecycle events remain immutable
      and tenant scoped. PWA v127.
- [x] **TASK-128 — Post approved expenses and employee payables.** Migration 0067
      transactionally couples final Finance approval to one immutable, period-valid
      posting. Employee-paid lines credit Employee Payable; company-paid lines credit
      the snapshotted bank/card-clearing account, with eligible verified bank-charge
      overrides retained. Stable journal identity, linked immutable GL legs and
      abandoned incomplete API request claims make replay and recoverable failure safe.
      PWA v128.
- [x] **TASK-129 — Deliver five-language expense SSOT screens and proof.** Use standard
      list/case-detail regions for My Claims, My Receipts and approvals; cover partial
      decisions, foreign currency, duplicate override, allocation, budget, posting
      failure and privacy at desktop and 375px. Employee reads are owner-derived and
      suppress cross-claim duplicate identifiers/hashes; approval work is read-only
      except for the existing governed decision and Finance override commands. A
      dedicated five-language fixture audit plus the 122-route desktop/mobile audit
      proves the standard layouts, failure states and zero page overflow. PWA v129.

## EPIC-056 — Reimbursement Payments & Tax Evidence (Complete)

Complete the employee-expense chain with encrypted payout details, maker/checker bank
files and immutable tax-support packages. This epic does not call bank APIs and does
not submit returns directly to IRAS or LHDN.

- [x] **TASK-130 — Add encrypted employee payout profiles.** Migration 0068 stores
      normalized bank facts only inside an AES-256-GCM envelope while ordinary
      self-service and HR/Finance reads expose masked holder/account projections.
      Reveal requires a separate permission, explicit purpose, audited no-store
      response; an independent HR/Finance actor verifies the profile and every owner
      modification invalidates that verification. The batch-read boundary rejects
      unverified profiles and immutable events record every change/reveal. PWA v130.
- [x] **TASK-131 — Add maker/checker reimbursement payment batches.** Migration 0069
      reserves only posted open employee payables whose same-currency payout profile
      remains verified. The preparer alone may replace draft membership; a distinct
      checker cannot release a batch containing their own claim. Release re-locks
      every profile version, snapshots only its encrypted envelope, hashes the complete
      release facts and freezes both batch and membership with database triggers.
      PWA v131.
- [x] **TASK-132 — Export bank files and import payment outcomes.** Provide configured
      bank templates, immutable release snapshot, bank reference/result capture,
      partial-success handling and retry of failed lines without duplicate payment;
      post Dr Employee Payable / Cr Bank only for successful lines.
- [x] **TASK-133 — Build the Tax Evidence Center and report jobs.** Filter by period,
      category, project, tax status and evidence completeness; generate a register,
      merged PDF, XLSX/CSV, original-file ZIP and SHA-256 manifest from one snapshot.
- [x] **TASK-134 — Add tax-pack finalisation and corrections.** Seal immutable versions,
      create superseding correction packs with an explicit difference report, retain
      SG records for at least five years and MY records for at least seven years,
      enforce longer company policy/legal hold and never silently overwrite evidence.
- [x] **TASK-135 — Prove the complete employee-to-tax chain.** Verify account
      activation → leave → payroll effect and receipt → claim → approval → balanced
      posting → maker/checker payment → bank result → immutable tax package across
      Demo/API, five languages, tenant/privacy boundaries and all release gates.
      The executable evidence index is
      `docs/EMPLOYEE_TO_TAX_RELEASE_PROOF.md`; the final proof passed 506 tests plus
      one expected skip, real PostgreSQL 16 forced RLS, 226-table parity, both builds,
      desktop/375px smoke, five-language expense states and all 122 Canonical routes.

## EPIC-057 — Canonical UI Internationalization ✅

Replace the mixed global/module-local translation approach with one safe, lazy-loaded
five-language UI contract across every Canonical route. Business data and exported or
statutory documents retain their own source/locale rules.

- [x] **TASK-136 — Lock the i18n contract and task breakdown.** Reconcile browser-local
      language persistence, English fallback, UI/company localization boundaries,
      atomic loading, live-switch state preservation, formatting, API-message and
      release-gate documentation before runtime implementation starts.
- [x] **TASK-137 — Implement the locale, message and formatting engine.** Added canonical
      module-namespaced packs, lazy non-English loading, atomic async switching,
      interpolation/plurals, unified formatting, compatible API-error parameters and
      runtime PWA caching while preserving the global API surface.
- [x] **TASK-138 — Migrate all Canonical UI to live bindings.** Migrated module-local copy
      packs and hardcoded system text, bind shared shell/routes/dialogs/ARIA/formatting
      to in-place updates and preserve every open form, filter, page, scroll and focus.
- [x] **TASK-139 — Prove five-language Canonical release quality.** Enforced resource,
      placeholder, unsafe-markup and new-hardcoded-copy gates; audit all Canonical
      routes in five languages and verify representative desktop/phone interactions,
      offline cache and zero overflow/runtime errors.

## EPIC-058 — End-User ERP Quality Audit & Remediation (In progress)

Exercise the product as real users across the isolated Demo and production API paths,
then turn every evidence-backed defect, ERP capability gap and material usability
problem into an executable remediation backlog. This epic is audit-first: TASK-140
does not repair product code or reinterpret a blocked physical-device check as passed.

- [x] **TASK-140 — Run a dual-mode end-user ERP audit and register every confirmed
      finding.** Completed 2026-07-27 at `a9fdb07`: published the reusable UAT manual
      and dated audit, ran the isolated dual-mode/role/company/language/viewport matrix,
      retained the API stack for review and registered nine evidence-backed root causes.
- [x] **TASK-141 — Initialize and reconcile paid-leave balances for new employees.**
      Migration 0074 and the shared employee-opening command make UI, API, imports,
      Staff activation and the immutable leave ledger agree through every release path.
- [x] **TASK-142 — Allow invitations for every eligible tenant role.** Dynamic,
      company-scoped roles now flow through invitation, acceptance and effective access.
- [ ] **TASK-143 — Remediate or formally accept high dependency advisories.**
- [x] **TASK-144 — Make document queue tests independent of wall-clock date.** Explicit
      clocks keep availability, retry and lease assertions deterministic.
- [x] **TASK-145 — Derive shell navigation and quick actions from effective permissions.**
      Active-company actions/scopes/modules now drive shell visibility while APIs keep 403.
- [x] **TASK-146 — Stabilize integration-test setup under supported parallel load.** The
      supported full suite now completes with 518 passing tests and one expected skip.
- [ ] **TASK-147 — Guard PostgreSQL demo proof against seeded databases.**
- [ ] **TASK-148 — Deduplicate expected My Work identity conflicts.**
- [x] **TASK-149 — Name icon-only user administration controls.** Localized action-and-user
      names are available to keyboards and assistive technology.

Audit evidence: `docs/audits/END_USER_AUDIT_2026-07-27.md`. No product fix is part
of TASK-140; TASK-141–149 are independently testable remediation work.

## EPIC-059 — Employee Access, Enterprise Demo & Customer Onboarding ✅

Deliver company-level roles/actions/scopes/modules, atomic Staff onboarding, a separate
deterministic enterprise Demo and a setup-gated production import/Go Live workflow.
The authoritative specification is
`docs/EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md`.

- [x] **TASK-150 — Lock specification, permission catalogue and compatibility migration.**
- [x] **TASK-151 — Implement company roles, templates and module dependencies.**
- [x] **TASK-152 — Implement atomic Staff onboarding and credential lifecycle.**
- [x] **TASK-153 — Enforce action permissions and data scopes server-side.**
- [x] **TASK-154 — Deliver deterministic enterprise Demo and 12 real personas.**
- [x] **TASK-155 — Deliver production onboarding, atomic imports and Go Live.**
- [x] **TASK-156 — Complete five-language UI and operator documentation.**
- [x] **TASK-157 — Prove dual-mode release quality and performance.**

Completed 2026-07-27. Phase 41 passed every TASK-150–157 acceptance gate with 518
tests plus one expected skip, forced-RLS PostgreSQL proof, 122 routes × five languages ×
desktop/375px, cross-browser critical workflows and the Chrome performance budget.
Physical-phone verification remains blocked under TASK-017.
