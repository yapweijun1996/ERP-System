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
Transfer/Dispose and HR-lite's payroll/compensation. `timesheet` stays mock, deferred
alongside `payroll-run`/`payslip`.

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
      removed, not fabricated. `timesheet` is unchanged (stays mock).
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

## EPIC-025 — Interactive Host Bootstrap (`scripts/setup.sh --interactive`)

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

- [ ] `docker-compose.yml`: `api` and `worker` services' `DATABASE_URL` becomes
      `${DATABASE_URL:-postgresql://${DB_USER:-erp}:${DB_PASSWORD:-erp_dev_password}@db:5432/erp}`
      — an explicit `.env` `DATABASE_URL` now genuinely overrides the bundled-container
      default instead of being silently ignored. `.env.example`'s own pre-filled
      `DATABASE_URL=postgres://erp:change-me@db:5432/erp` line (which made every fresh
      `.env` set it explicitly, defeating the fallback for everyone) is replaced with a
      comment explaining it's auto-derived unless set.
- [ ] `scripts/setup.sh` gains a `--interactive`/`-i` flag (only takes effect when `.env`
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
- [ ] When an external connection string is chosen, the script never starts or waits on
      the bundled `db` service (`docker compose up -d api web --no-deps`, not the
      unqualified `docker compose up -d`) and replaces the `db`-container `pg_isready`
      wait with a short retry loop directly against `docker compose exec -T api npm run
      migrate` (which fails fast and clearly if the external database isn't reachable,
      and is itself the real readiness proof once it isn't).
- [ ] `make setup-interactive` target added, calling the new flag. Existing `make
      setup`/bare `scripts/setup.sh` (no flag) behavior is completely unchanged — verified
      by re-running the existing non-interactive path for real after the
      `docker-compose.yml` change, not just by reading the diff.
- [ ] `docs/SETUP_WIZARD.md`'s Phase A "Future" list item 1 (interactive prompts) marked
      done; `docs/DEPLOYMENT.md` gains a short section on connecting to an
      already-provisioned external database.
- [ ] Verified live and end-to-end against real Docker, not just `docker compose config`:
      the bundled path (fresh `.env`, real `docker compose up`, migrate, seed, teardown)
      and the external path (a standalone `docker run postgres:16-alpine` standing in for
      an "already-provisioned" database, pointed at by the interactive script's external
      prompt, real migrate + seed succeeding against it, teardown) both complete cleanly.
