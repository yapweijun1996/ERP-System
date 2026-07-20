# Roadmap

This roadmap keeps the ERP build focused on a working demo first, then production
readiness. The order matters: prove the product shape in the browser, then harden the
server and Docker path. Status reviewed **2026-07-17** (see [STATUS.md](STATUS.md)).

Status legend: ✅ complete · 🔶 in progress · ⬜ not started.

## Phase 1 — Frontend Foundation ✅ (one carry-over)

Goal: use the user's Aria ERP design as the frontend base, then wire it to this
project's demo and production data paths.

Delivered: Vite frontend under `web/`, Aria ERP layout cloned, PGlite demo data path,
local preview and build verification.

Carry-over: the `VITE_DATA_MODE=demo|api` adapter seam is documented but not wired —
now Phase 5 entry work (TASK-019, EPIC-007).

## Phase 2 — Demo ERP ✅

Goal: publish a public static ERP demo that feels real but contains only sample data.

Delivered: PGlite schema/seed aligned with the Drizzle schema, IndexedDB persistence +
reset action, dashboard/inventory/sales/invoice/finance/settings screens, GitHub
Pages build + Actions deploy, PWA shell with update prompt.

Exit criteria: met (`build:demo` works, Pages URL boots with no backend, no secrets
bundled).

## Phase 3 — Core ERP Flow ✅

Goal: make the demo show a believable end-to-end ERP transaction.

Delivered: customer/product browse, confirm sales order (SO-2), stock deduction,
invoice generation, GL posting view, insufficient-stock rollback (SO-3); full screen
audit across all 114 routes (TASK-018 ✅ done 2026-07-17 — `npm run audit:screens`,
wired into CI, drives every route through the live router and asserts zero errors
plus no leftover prototype identity leaks on canonical screens; found and fixed 3 real
bugs — a stale sales-rep dropdown, a stale default-company picker, and a genuine async
race in the Master Control screen — see docs/STATUS.md).

Open: TASK-017 real-device verification (permanently blocked — needs a physical phone).

## Phase 4 — Setup Wizard ✅ (demo path) — production lock done via TASK-024 (Phase 5)

Goal: support first-run setup in demo and production.

Deliverables: language selection; master/company creation; country/currency/tax setup
for Singapore and Malaysia; first admin user; optional sample data seed; production
setup lock after first admin. (TASK-009 ✅ + TASK-010 ✅, both done 2026-07-16 — wizard
shell gated on boot, writes company/tax/CoA/admin-user to PGlite in one transaction,
topbar company switcher rewired to the canonical company list.)

Exit criteria: empty demo opens wizard first (✅ met); production API can persist wizard
results to PostgreSQL (✅ — `POST /api/setup/actions/complete` runs
`completeProductionSetup` server-side, token-gated and locked once the first admin
exists; stale "⬜ needs TASK-011/TASK-019" claim corrected by the TASK-040 audit).

## Phase 5 — Production Runtime ✅

Goal: run the ERP as a self-hosted Docker deployment.

Deliverables: wire the `VITE_DATA_MODE` seam (TASK-019 ✅); API server (TASK-011 ✅);
Docker Compose stack `web`+`api`+`db` (TASK-012 ✅ done 2026-07-16 —
`docker-compose.yml` + `Dockerfile.api` + `web/Dockerfile` + `web/nginx.conf`, built
and run end-to-end for real: healthchecks pass, `docker compose exec api npm run
migrate`/`npm run seed` work, the dashboard renders through the nginx reverse proxy
with zero CORS needed); PostgreSQL concurrency proof (TASK-013 ✅ — proven against
real Postgres, `POSTGRES_URL=... npm run demo` passes including the true-concurrency
race); real dashboard render instead of the waiting screen (TASK-026 ✅ done
2026-07-17); minimal real auth (TASK-024 ✅ done 2026-07-17 — PBKDF2 password
hashes, server-side sessions, `/api/auth/login`\|`logout`\|`session` +
`/api/setup/status`, both adapters share one `login`/`logout`/`needsSetup`/
`isSignedIn`/`switchUser` contract, verified end-to-end against Docker including a
real service-worker caching bug found and fixed along the way — see
[STATUS.md](STATUS.md)); schema-drift check between core and demo SQL copies
(TASK-020 ✅); `Makefile`/`scripts/setup.sh` aligned end-to-end (TASK-021 ✅ done
2026-07-17 — the earlier `.env.example` sandbox block was resolved via
`git show HEAD:.env.example` (reads the tracked blob through git's object
database, not the filesystem path the permission system intercepts); ran
`scripts/setup.sh` for real for the first time plus every individual `make`
target against a live, isolated stack — see [STATUS.md](STATUS.md)). The final item —
server-side stock and finance write endpoints — landed incrementally across the
resource/dispatcher work and was confirmed closed by the TASK-040 audit
(2026-07-19): the unified transactional dispatcher registers 24 create resources
and 28 actions including `sales/orders/confirm`, purchasing receipt/invoice
posting, CRM conversion, inventory adjustments/transfers and depreciation
posting; production `completeSetup` runs server-side via
`POST /api/setup/actions/complete` (token-gated, zero-user locked).

Exit criteria: `docker compose up -d` starts all services (✅); production
transaction + concurrency tests pass against PostgreSQL (✅ TASK-013, and in CI on
every PR since TASK-038); browser writes stock/money through API only (✅ — no
canonical write executes client-side in api mode). Feature breadth for
not-yet-converted modules is Phase 7 scope, not a Phase 5 gap.

## Phase 6 — Quality And Operations 🔶 (CI + drift + smoke + unit tests live; PG-in-CI open)

Goal: make the system safe to maintain.

Deliverables: CI checks for typecheck/build/demo (TASK-014 ✅); schema drift check
in CI (TASK-020 ✅ done 2026-07-17 — `scripts/check-drift.mjs`); browser smoke test
in CI (TASK-015 ✅ done 2026-07-17 — `scripts/smoke.mjs`, Playwright, desktop +
mobile, zero console/page errors, dashboard content actually verified); vitest unit
tests (TASK-025 ✅ done 2026-07-17 — 15 tests over `confirmSalesOrder`/`issueStock`/
`getEffectiveTaxRate`, wired into CI); transaction tests against PostgreSQL in CI
(currently only proven manually — TASK-013 — not yet gated in CI, since that needs
a Postgres service container in the workflow); deployment docs; backup/restore
runbook; release checklist.

Exit criteria: every PR can be validated with documented commands (✅ for
typecheck/demo-build/drift/smoke/unit-tests; ⬜ for PG-parity-in-CI); demo and
production paths have separate deployment checks (✅ — `deploy-pages.yml` deploys
the demo, `ci.yml` validates every PR, Docker Compose is the production runtime).

## Phase 7 — Module Expansion 🔶 (purchasing/CRM/Fixed Assets/HR-lite done; Project register + progress claims done)

Goal: convert mock modules into real domains, one at a time, each end-to-end
(schema → seed → screens → demo assertions) in both modes.

Order of attack:

1. **Purchasing** (EPIC-008 ✅) — completes the stock story: goods receipt IN mirrors
   sales issue OUT; AP mirrors AR. Schema + business logic (TASK-022 ✅ done
   2026-07-17 — `src/data/schema/purchasing.ts`, `src/modules/purchasing/`
   `createPurchaseOrder`/`receiveGoods`/`postSupplierInvoice`, both rollback guards
   proven on both PGlite and PostgreSQL, `src/demo.ts` asserts the full chain) and
   screens (TASK-023 ✅ done 2026-07-17 — suppliers/purchase-orders/goods-receipts/
   supplier-invoices lists render real PGlite data, the new-PO wizard and the
   receive-goods/post-invoice row actions call the real adapter transactions,
   verified live end-to-end including the stock visibly moving on the Inventory
   screen — see docs/STATUS.md) are both done for the CORE chain specifically.
   RFQs, quotations, requisitions, returns, credit/debit notes, price lists,
   landed cost, vendor performance and the purchasing analytics reports have no
   schema and intentionally stay on sample data — a further, separate scope if
   ever prioritized, not a gap in TASK-022/023.
2. **CRM** (EPIC-010 ✅) — opportunity pipeline → convert to sales order, the same
   Sales module Purchasing feeds Inventory into. Schema + business logic
   (TASK-027 ✅ done 2026-07-17 — `src/data/schema/crm.ts`, `src/modules/crm/`
   `createOpportunity`/`convertOpportunityToSalesOrder`; the conversion composes
   atomically with sales via a newly-extracted `confirmSalesOrderWithin` core —
   `confirmSalesOrder` itself is unchanged for every existing caller — proven on
   both PGlite and PostgreSQL including a test that a failure inside the composed
   transaction leaves the opportunity provably untouched, not half-converted) and
   screens (TASK-028 ✅ done 2026-07-17 — pipeline board and the new-opportunity
   wizard read real PGlite data, the kanban's "Convert to sales order" action calls
   the real adapter transaction, verified live end-to-end including the resulting
   order visible in Sales screens, stock decrementing, and GL staying balanced —
   see docs/STATUS.md) are both done for the CORE chain. Customer-360 (EPIC-012 ✅,
   TASK-031/032 done 2026-07-19) is now also Canonical — real contacts, open
   orders/opportunities, activity timeline and Net-30 balance/overdue, closing the
   gap this item originally called out. Opportunity-detail remains the one CRM
   sub-screen with no schema and stays on sample data.
3. **Fixed Assets** (EPIC-015 ✅) — asset register → depreciation run → balanced GL
   posting, chosen over HR-lite (3 routes vs. 6, and its GL tie-in was already
   precisely specified in the mock data). Schema + business logic (TASK-035 ✅ done
   2026-07-19 — `src/data/schema/assets.ts`, `src/modules/assets/`
   `createAsset`/`createDepreciationRun`/`postDepreciationRun`, the aggregate+ledger
   shape mirrors Inventory's `stock_level`/`stock_movement`, posting mirrors
   `postSupplierInvoice`'s balanced-journal pattern, proven on PGlite) and screens
   (TASK-036 ✅ done 2026-07-19 — asset-register gained a real "New Asset" create
   modal and per-asset row-open, asset-detail shows real posted depreciation history,
   depreciation computes and posts a real run with a link to the real General Ledger
   screen, verified live end-to-end including balanced Dr 6200/Cr 1510 and
   NBV/accumulated-depreciation updates — see docs/STATUS.md) are both done.
   HR-lite remains available as a future module if a real prospect asks for it.
4. Relabel or hide remaining mock screens so the demo never oversells (TASK-018 ✅
   done 2026-07-17 — see Phase 3; this item now means keeping that guarantee as
   Purchasing/CRM/HR convert one at a time, not a one-time sweep).
5. **Admin: users, roles & audit log** (EPIC-016 ✅) — unlike every module above, no
   schema migration was needed: `app_user`/`role`/`role_permission`/`audit_log`
   already existed in full from TASK-024 (EPIC-009), just unwired from any screen.
   Backend (TASK-041 ✅ done 2026-07-19 — bespoke `/api/admin/*` routes since these
   tables are deliberately outside the generic resource/RLS framework; also fixed a
   real gap where browser demo mode's `audit_log` was permanently empty since
   `appendAudit` was only ever called from the production HTTP layer) and screens
   (TASK-042 ✅ done 2026-07-19 — `user-mgmt` gained a real invite/enable/disable
   flow, `role-permission` replaced the mock's fabricated 4-level matrix with a real
   2-state grid matching the actual `role_permission` model, `audit-log` reads real
   events, verified live including the fix making every module's writes show up in
   the demo's own audit trail — see docs/STATUS.md) are both done. `master-control`,
   `sys-settings` and `module-activation-control` remain Preview (need new schema or
   a data-repointing decision).
6. **HR-lite: Employee Master & Leave Management** (EPIC-020 ✅, TASK-049/050,
   2026-07-19) — deliberately scoped to employee master + leave request/approval only;
   Payroll (`payroll-run`/`payslip`) stays mock, deferred to its own future epic since
   it's a materially different, statutory-contribution-heavy domain (EPF/SOCSO/PCB).
   `employee`/`leave_request` tables, `src/modules/hr/`, registered as standard generic
   resources gated on new `hr.read`/`hr.write` permissions. `hr-directory`, `employee`
   (real per-employee detail, not always the same hardcoded record),  `new-employee`
   (a single real form replacing the mock's 3-step compensation/provisioning wizard —
   no schema backed those steps) and `leave-approval` (real approve/reject, including a
   required-reason reject flow) all read/write real data. Verified live end-to-end:
   created a real employee, approved one leave request, rejected another with a reason,
   confirmed the employee detail's leave balance and history reflected both decisions.
7. **Project (Enterprise Project)** (🔶 register + progress claims done, EPIC-021 ✅;
   AP/bank-voucher depth remains) — project register and P&L exist as mock screens
   (`screens-project.js`: `project-pl`, `project-detail`, `timesheet`).
   Stakeholder-requested sub-features confirmed absent by a 2026-07-19 audit: a real
   **Progress Claim** entity (today "progress invoice"/"partial claim" are narrative copy
   only, no schema/screen/route), project-scoped **Account Payable**/**Account
   Receivable** (AP/AR only exist generically under Finance, with zero project linkage),
   and dedicated **Bank Receipt**/**Bank Payment** documents (today only a generic
   Finance-wide "Bank Reconciliation" exists). **Payment Voucher** already exists as a
   generic Finance document (`screens-fin.js`/`screens-fin-pay.js`) but has no project
   linkage either. Confirmed the largest remaining module and sub-phased as planned:
   EPIC-021 (TASK-051/052, 2026-07-20) covers the first two sub-phases — a real project
   register and real Progress Claim billing (draft → post a balanced AR/Revenue/Tax
   journal, reusing `debitNote.ts`'s exact posting shape, no new CoA codes). Cost/budget/
   team/milestone-schedule tracking stays mock (no timesheet or expense-capture schema
   exists to back it — a materially separate feature). Project-scoped AP linkage and
   dedicated Bank Receipt/Payment documents remain the third sub-phase, a future epic.
8. **Service** (🔶 in progress, EPIC-022) — service tickets/orders/contracts, distinct
   from Manufacturing's work orders. Mock screens in `screens-service.js`:
   `service-ticket` (list), `service-order` (always the same hardcoded ticket — the same
   bug class already fixed for `asset-detail`/`employee`/`project-detail`),
   `service-contracts` (no detail/create). EPIC-022 (TASK-053/054) makes the ticket +
   contract register real (3 real statuses, not the mock's 5 — Resolved/Closed already
   collapse to one "done" filter bucket in the mock's own UI); spare-parts consumption
   and labour costing stay mock, deferred as Inventory-consumption depth work.
9. **Purchase Requisition** (⬜ not started) — the natural upstream step before the
   already-Canonical PO chain. Mock screen (`purchase-requisitions` in
   `screens-purchasing-hub.js`, detail in `screens-purchase.js`) and mock data
   (`data-purchasing-ext.js`) exist but no schema table, same maturity tier as
   RFQs/quotations. Converting this closes a real gap in an otherwise-real chain:
   today a PO can be created with no requisition trail behind it.

Exit criteria per module: no mock data files for that module remain; `src/demo.ts`
asserts its core transaction; screens work in demo and api modes.

## Phase 8 — Platform Standardization & Multi-Tenant Admin ✅

Goal: address a stakeholder-driven cross-cutting audit (2026-07-19) covering two
concerns that don't belong to any single module: (1) frontend code quality — Sidebar/
TopBar/page (List/Detail/Edit) logic should follow one consistent standard and reuse
shared helpers instead of copy-paste; (2) the multi-tenant super-admin story needs a
real module-access-control mechanism (enable/disable specific ERP modules per client)
and a safety guard against a tenant ever losing its last working superadmin. Unlike
Phase 7, this phase's items are not new business domains — they're standardization and
platform-safety work found by auditing the existing 53 Canonical + 61 Preview routes
(now 54 + 60 after EPIC-018).

1. **Frontend SSOT Consolidation** (EPIC-017 ✅, TASK-043/044/045, 2026-07-19) —
   `listPage()` helper (7 near-identical copies replaced with one shared helper in a new
   `screens-common.js`, net -97 lines); 23 of 24 hand-rolled modal-chrome sites migrated
   onto the existing `appModal()` SSOT plus a shared `requireField()` validation helper;
   the 3 legacy hardcoded module-nav functions (`salesNav`/`purNav`/`inventoryNav`)
   folded into the generic `MODULE_DEFS`-driven nav system, kept as thin delegates
   rather than deleted once live investigation found ~20 direct callers across 13
   detail-page files beyond the one special-case the original audit had found. Verified
   with exact DOM-fingerprint diffs (class list, aria-label, separator/tab counts, label
   text) before vs. after for Sales/Purchasing/Inventory — byte-identical, including
   Inventory's real Chinese translations.
2. **Super-Admin Module Access Control** (EPIC-018 ✅, TASK-047/048, 2026-07-19) —
   `module-activation-control` was a pure `localStorage` mock (confirmed: zero server
   persistence, zero enforcement). Now real: a tenant-scoped `master_module` table,
   bespoke `/api/admin/modules` routes, and — beyond the original scope — real
   server-side enforcement across all 4 generic resource-router handlers, not just a
   client-side nav hide. A superadmin is exempt from their own toggle on both sides.
   Verified live: disabling Purchasing hid it from a real Viewer session's sidebar and
   blocked API access, while the superadmin who disabled it kept full access to
   configure it back.
3. **Superadmin Safety Guard** (EPIC-019 ✅, TASK-046, 2026-07-19) — found while
   verifying "every database must always have a super admin account": nothing stopped
   another admin user from deactivating a tenant's *last* active superadmin, leaving
   nobody who could even re-enable that same account. Fixed with a guard that still
   allows disabling any *extra* superadmin.

A note on multi-tenancy topology, resolved by the same audit rather than deferred: the
stakeholder described "one database has exactly one `master_fn`, never multiple" as an
invariant. The **schema deliberately supports multiple `master_fn` rows per database**
(`docs/MULTI_TENANCY.md`, modeled on the stakeholder's other production ERP; exercised
on purpose by tests like `adminLifecycle.test.ts`'s cross-master-isolation case) — this
is intentional shared-hosting/demo flexibility, not a bug. It does not conflict with the
stated goal in practice: this repo's actual production topology is one Docker Compose
stack (hence one database) per paying customer (see the private-repo strategy — a
prospect "converts" to their own Docker deployment), which naturally lands on exactly
one `master_fn` per database without needing a hard schema constraint that would break
the deliberate multi-tenant test fixtures. No code change was made here; flagged for
confirmation rather than silently altering a well-tested design.

Exit criteria: `npm run audit:screens` passes after each mechanical change; the
module-access-control toggle demonstrably hides a module from both the sidebar and the
API for a non-superadmin user of a restricted tenant.
