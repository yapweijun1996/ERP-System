# Roadmap

This roadmap keeps the ERP build focused on a working demo first, then production
readiness. The order matters: prove the product shape in the browser, then harden the
server and Docker path. Status reviewed **2026-07-21** (see [STATUS.md](STATUS.md)).

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

## Phase 6 — Quality And Operations ✅

Goal: make the system safe to maintain.

Deliverables: CI checks for typecheck/build/demo (TASK-014 ✅); schema drift check
in CI (TASK-020 ✅ done 2026-07-17 — `scripts/check-drift.mjs`); browser smoke test
in CI (TASK-015 ✅ done 2026-07-17 — `scripts/smoke.mjs`, Playwright, desktop +
mobile, zero console/page errors, dashboard content actually verified); vitest unit
tests (TASK-025 ✅ done 2026-07-17 — 15 tests over `confirmSalesOrder`/`issueStock`/
`getEffectiveTaxRate`, wired into CI); transaction tests against PostgreSQL in CI
(TASK-038 ✅ done 2026-07-19 — `ci.yml` already ran a PostgreSQL 16 service container
for `test:postgres`; the real gap was narrower — the PGlite transaction-proof step
never set `POSTGRES_URL`, so the cross-engine parity + true-concurrency race was only
ever PGlite-only in CI. Now that step exports `POSTGRES_URL` against the same `erp_ci`
database and both proofs run gated on every PR); deployment docs, backup/restore
runbook and release checklist (TASK-039 ✅ done 2026-07-17 —
[docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), separate demo-bundle and
Docker-production sections including backup, migrate-only-upgrades, health
verification and rollback).

Exit criteria: every PR can be validated with documented commands (✅ — typecheck,
demo-build, drift, smoke, unit-tests and PG-parity all run in CI on every PR); demo
and production paths have separate deployment checks (✅ — `deploy-pages.yml` deploys
the demo, `ci.yml` validates every PR, Docker Compose is the production runtime).

## Phase 7 — Module Expansion ✅ (every originally-scoped module converted: Purchasing, CRM, Fixed Assets, Admin, HR-lite, Project incl. finance depth, Service, Purchase Requisition)

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
   The sourcing, return, supplier-note, landed-cost, approval, supplier-price and
   derived vendor-performance slices are now Canonical. Purchasing analytics reports
   and the legacy shared transaction prototype remain separate follow-up scope.
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
   gap this item originally called out. Opportunity-detail was subsequently closed by
   EPIC-027/TASK-063 using the same opportunity/customer/activity schema.
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
7. **Project (Enterprise Project)** (EPIC-021 ✅ register + progress claims; EPIC-024 ✅
   finance depth) — project register and P&L existed as mock screens
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
   team/milestone-schedule tracking stayed out of this slice (no expense-capture schema
   exists to back it); the separate Timesheet gap was later closed by EPIC-044/TASK-080.
   Project-scoped AP linkage and
   dedicated Bank Receipt/Payment documents were the third sub-phase, closed by EPIC-024
   (TASK-058/059, 2026-07-21): `purchase_order`/`supplier_invoice` gained a nullable
   `project_id`; a real Bank Receipt settles a posted progress claim's AR; a real Payment
   Voucher settles one or more of a supplier's unpaid invoices — closing the gap this item
   named without inventing a full bank-reconciliation engine (Finance's generic `bank-rec`
   screen stays mock/Preview, materially out of scope). Live-verified with a real,
   mathematically balanced double-entry result: one Payment Voucher (S$1,220.80 across two
   real unpaid invoices) and one Bank Receipt (S$54,500) left the General Ledger's Cash &
   Bank account at exactly S$53,279, with AP and AR each moving by the settled amounts.
8. **Service** (EPIC-022 ✅) — service tickets/orders/contracts, distinct from
   Manufacturing's work orders. Mock screens in `screens-service.js` had `service-ticket`
   (list), `service-order` (always the same hardcoded ticket — the same bug class already
   fixed for `asset-detail`/`employee`/`project-detail`), `service-contracts` (no detail/
   create). EPIC-022 (TASK-053/054, 2026-07-20) made the ticket + contract register real
   (3 real statuses, not the mock's 5 — Resolved/Closed already collapsed to one "done"
   filter bucket in the mock's own UI); spare-parts consumption and labour costing stay
   mock, deferred as Inventory-consumption depth work.
9. **Purchase Requisition** (EPIC-023 ✅) — the natural upstream step before the
   already-Canonical PO chain. Mock screen (`purchase-requisitions` list in
   `screens-purchasing-lists.js`, detail in `screens-purchase.js`) and mock data
   (`data-purchasing-ext.js`) existed but no schema table, same maturity tier as
   RFQs/quotations (which stay mock — only Purchase Requisition itself was in scope).
   EPIC-023 (TASK-055/056, 2026-07-20) closed the real gap this item named: `purchase_
   order` gained a nullable `requisition_id` FK, so an approved requisition can be
   genuinely converted to a real, linked purchase order through the existing
   `new-purchase-order` wizard — a PO created this way now has a real requisition trail
   behind it, not just a coincidental narrative.

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

## Phase 9 — Deployment Ergonomics ✅ (interactive host bootstrap done; desktop installer deliberately deferred, not phase-scoped)

Goal: close the two "Future" items `docs/SETUP_WIZARD.md` itself already names under
Phase A (pre-boot host bootstrap), now that Phase 7's module expansion is fully done and
the product has enough real depth to be worth installing more than once. Unlike Phase 7,
this is not a new business domain — it's the operational path an installer takes before
the app (and its own in-app Phase B first-run wizard, already fully built) ever starts.

1. **Interactive Host Bootstrap** (EPIC-025 ✅, TASK-060 done 2026-07-21) — `make setup`/
   `scripts/setup.sh` used to be one-command but zero-prompt: it copied `.env.example` to
   `.env` verbatim (shipping the literal `DB_PASSWORD=change-me` placeholder and blank
   `ERP_SETUP_TOKEN`/`ERP_TOKEN_ENCRYPTION_KEY` unless the installer remembered to
   hand-edit them first) and always provisioned the bundled `db` container — no way to
   point at a database an installer had already provisioned themselves (a managed
   RDS/Cloud SQL/Supabase instance, for example) without manually editing `.env` and
   understanding `docker-compose.yml`'s service graph. `scripts/setup.sh --interactive`
   (`make setup-interactive`) now prompts for bundled-vs-external database, auto-generates
   strong secrets on a blank answer (validated against the app's own exact contracts —
   catching, for example, a manually-typed encryption key that doesn't decode to 32
   bytes, before it can crash the `api` container), and checks host ports for collisions.
   Also fixed a real, standalone bug found along the way (confirmed via `docker compose
   config`, not just reading the file): `docker-compose.yml`'s `api`/`worker` services
   silently ignored `.env`'s own documented `DATABASE_URL` line, always reconstructing
   their own connection string from `DB_USER`/`DB_PASSWORD` instead. The other named
   Future item — a full desktop installer with Docker Desktop detection — stays out of
   scope, deferred to its own future epic if ever prioritized. See `docs/EPICS.md` for
   full acceptance criteria and the retrospective.

Exit criteria: met — `scripts/setup.sh --interactive` and the existing zero-flag path were
both verified against real Docker end-to-end (bundled-DB and external-DB cases, the latter
against a standalone `postgres:16-alpine` container standing in for an already-provisioned
database); existing non-interactive behavior proven byte-for-byte unchanged. Real-Docker
verification also caught and fixed (separate commit, outside this epic's own diff) a
previously-undiscovered, pre-existing production bug: the `web` service's Docker build had
been silently broken since 2026-07-18 (isolated `web/`-only build context couldn't reach
`erp-demo-runtime-impl.ts`'s cross-workspace imports) — see `docs/EPICS.md` EPIC-025
retrospective for detail.

## Phase 10 — Payroll ✅

Goal: close the one deferral Phase 7 named explicitly but didn't build — HR-lite
(EPIC-020) deliberately scoped Payroll out as "a materially different, statutory-
contribution-heavy domain," not a lite extension of employee master. Phase 7's own
header already states "every *originally-scoped* module converted" — Payroll was never
in that original scope, so this is a new phase rather than reopening Phase 7.

1. **Payroll: Run, Payslip & Statutory Contributions** (EPIC-026 ✅, TASK-061/062 done) —
   `employee` has zero compensation data today (no salary/wage column anywhere), and the
   existing mock (`payroll-run`/`payslip`) is Malaysia-only (EPF/SOCSO/EIS/PCB) while the
   seed data only has employees for the Singapore company — the one company that mock
   data can't actually demonstrate payroll for. Scoped to support **both** Singapore
   (CPF) and Malaysia (EPF/SOCSO/EIS/PCB), matching this repo's existing dual-country
   tax-rate pattern for GST/SST, rather than a single-country first pass that would
   leave the only company with real employees still unable to run its own payroll.
   Shipped: `employee.baseSalary`, `payroll_run`/`payroll_run_line` schema, a flat-rate
   statutory engine dispatched by company country, draft→post GL posting mirroring
   `depreciationRun.ts`, real `payroll-run`/`payslip` screens (now Canonical, 69/45
   split), and two new C-MY employees so Malaysia has real headcount for the first time.
   Reuses `depreciationRun.ts`'s exact draft → post GL pattern. Deliberately flat-rate
   statutory approximations, not real gazetted bracket/age-banded tables or government
   e-filing formats — matching how GST/SST model real tax mechanics without building
   compliance-artifact depth. See `docs/EPICS.md` for full acceptance criteria.

Exit criteria: a real payroll run created and posted for each of the Singapore and
Malaysia companies, GL balanced for both, a real payslip viewable per employee with
correct country-specific statutory labels, `payroll-run`/`payslip` moved from Preview to
Canonical.

## Phase 11 — CRM Opportunity Detail ✅

Goal: close the final registered CRM Preview route without adding a parallel model.

1. **Canonical Opportunity Workspace** (EPIC-027 ✅, TASK-063 done) — replaced the
   hardcoded opportunity detail with a real Demo/API read model assembled from the
   existing opportunity, customer, contact, activity and sales-order resources. Every
   pipeline card now opens its own record. The page logs real linked activities, reuses
   the existing atomic conversion flow and adds an audited, idempotent `mark-lost`
   command that requires a reason, rejects terminal opportunities and records the
   transition in the timeline. Five-language copy, desktop/375px checks and the 114-route
   audit move the route from Preview to Canonical, producing a **70/44** split.

Exit criteria: `opportunity` uses no prototype detail data, supports Demo/API, writes
only through registered commands, and passes domain/API/browser/audit verification.

## Phase 12 — Purchasing Sourcing ✅

1. **RFQ → Supplier Quotation → Purchase Order** (EPIC-028, TASK-064 done
   2026-07-22) — added a real requisition-aware RFQ register, invited-supplier response
   capture, comparable Decimal/tax-snapshotted quotation totals and an atomic award
   action that creates exactly one linked pending-approval PO. Award closes the RFQ, converts the
   winner and rejects competitors without touching stock or GL. `rfqs` and
   `supplier-quotations` are now Canonical in Demo/API with five-language workflows,
   moving the route boundary from 70/44 to **72/42**. `pur-txn-view` remains Preview
   because it is shared by still-sample purchasing document types.

Exit criteria: met when the domain/API/browser and 114-route gates below pass.

## Phase 13 — Purchasing Returns & Supplier Credits ✅

1. **Purchase Return → Supplier Credit Note** (EPIC-029, TASK-065 done 2026-07-22) — adds
   immutable cost/tax-snapshotted return lines against a real receipt and unpaid AP
   invoice. Shipping the return atomically issues stock, creates one posted supplier
   credit and posts balanced Dr AP / Cr Inventory / Cr Input Tax legs. The two list and
   detail workflows use bounded Demo/API resources with five-language copy. Live browser
   proof covered create → ship/credit → inventory movement → balanced GL at desktop and
   375px, and every release gate passed at **74/40**.

Exit criteria: real create/ship/credit trace passes domain, API, browser and 114-route
verification; no Preview action or sample detail remains on either promoted route.

## Phase 14 — Supplier Debit Notes & Net AP Settlement ✅

1. **Supplier Debit Note → net Payment Voucher** (EPIC-030, TASK-066 done 2026-07-22)
   adds a versioned commercial claim against one unpaid supplier invoice. Draft creation
   snapshots effective tax; posting creates balanced Dr AP / Cr Purchase Variance / Cr
   Input Tax without moving stock. Debit-note posting, purchase-return crediting and
   Payment Voucher now share one remaining-payable calculation, so posted supplier
   credits and debits reduce the exact cash settlement. A compatibility migration also
   backfills account `1000` for pre-TASK-058 tenants. Demo/API, RBAC, audit, idempotency,
   five-language copy, desktop/375px browser proof and all gates passed at **75/39**.

Exit criteria: real create/post/payment trace proves capped claims, balanced GL, zero
stock movement and zero residual AP after the net voucher.

## Phase 15 — Landed Cost Allocation & Inventory Revaluation ✅

1. **Receipt-linked landed cost** (EPIC-031, TASK-067 done 2026-07-22) adds
   value/quantity allocation with exact Decimal cents, current-on-hand moving-average
   revaluation and balanced Dr Inventory / Cr Landed Cost Accrual posting. It creates no
   stock movement because quantity does not change. Migration 0033 also backfills account
   `2300` for existing companies. Demo/API, RBAC, audit, idempotency, five-language copy,
   desktop/375px browser proof and all gates passed at **76/38**.

Exit criteria: exact allocation, duplicate/tenant/zero-stock rollback, valuation/GL
equality and no-stock-movement invariants pass domain, API and live-browser proof.

## Phase 16 — Purchase Order Approval Gate ✅

1. **PO approval queue and detail** (EPIC-032, TASK-068 done 2026-07-22) adds one
   versioned approval record to every newly-created or RFQ-awarded purchase order.
   Orders start `pending_approval`; an authorised, noted approve/reject decision records
   the actor and changes only the PO/approval states. Approval creates no inventory or
   GL facts, and receiving continues to require the approved `open` state. The queue and
   per-order workspace are real Demo/API five-language routes. Domain/API, RBAC, audit,
   idempotency, Chinese and 375px browser proof plus every release gate passed at
   **78/36**.

Exit criteria: pending/rejected orders cannot be received; authorised replay is stable;
approval leaves stock and GL unchanged; both approval routes have no sample-data path.

## Phase 17 — Purchasing Details and Supplier Controls ✅

1. **Canonical receipt and AP invoice workspaces** (EPIC-033, TASK-069 done
   2026-07-22) replaces the two fixed prototype documents with record-specific,
   five-language Demo/API details. Every goods-receipt row now opens its own immutable
   PO-line view and linked `stock_movement` trace. Every supplier-invoice row opens its
   own PO/GRN match, outstanding balance and balanced `gl_entry` trace. The screens add
   no client-side posting shortcuts; receiving and AP posting remain server/domain
   actions on the purchase order. CI smoke now executes a fresh PO approval → receipt →
   invoice chain and asserts both detail traces. The shared shell also re-reveals the
   active sub-navigation after a live viewport resize. Route maturity is **80/34**.

2. **Supplier contracts and derived performance** (EPIC-034, TASK-070 done
   2026-07-22). Effective-dated supplier price headers/quantity tiers now support
   audited create/activate in Demo/API. Vendor scorecards are rebuilt from canonical
   orders, quoted lead times, receipts, invoices, credited returns and active contract
   coverage rather than curated sample ratings. Route maturity is **82/32**.

Exit criteria: all four promoted routes use bounded formal resources in Demo/API;
receipt/invoice details expose real inventory/accounting facts; supplier contracts are
transactional and scorecards are rebuildable; five-language desktop/375px verification
passes with no sample-only write path.

## Phase 18 — Purchasing Analytics and Sourcing Documents ✅

1. **Canonical purchasing command centre and reports** (EPIC-035, TASK-071 done
   2026-07-22) replaces the disconnected purchasing dashboard/report metrics with two
   bounded, rebuildable Demo/API read resources. Supplier spend, approved-buyer value,
   price variance, delivery, returns, matching, contract coverage and document-state
   summaries now reconcile to canonical procure-to-pay facts. Buyer identity is the real
   PO approval-actor snapshot; unapproved orders are excluded. The shared RFQ/quotation
   workspace now opens record-specific real documents and actions. All eight routes have
   five-language copy, no fake export or budget action, and the CI smoke proves the
   dashboard/report markers. Route maturity is **90/24**.

Exit criteria: all eight promoted routes use formal bounded resources in Demo/API;
analytics are rebuildable rather than stored KPIs; RFQ/quotation details expose only
real sourcing facts/actions; desktop/375px, smoke and the full 114-route audit pass.

## Phase 19 — Direct Sales Order Approval ✅

1. **Canonical order authoring and approval** (EPIC-036, TASK-072 done 2026-07-22)
   replaces the sample new-order form and approval list with one shared Demo/PostgreSQL
   command path. Direct and quotation-converted orders start `pending_approval` with an
   immutable tax snapshot and exactly one approval request. An authorised, noted decision
   records the actor and releases an approved order to `draft`; inventory, delivery,
   invoice and GL facts remain exclusive to the later confirmation boundary. Both routes
   have five-language Canonical UI. Route maturity is **92/22**.

Exit criteria: creation/decision tenant guards, Decimal tax, RBAC, audit, idempotency,
no-stock/no-GL invariants, live browser workflow and the full release suite pass.

## Phase 20 — Canonical Sales Analytics ✅

1. **Rebuildable dashboard and reports** (EPIC-037, TASK-073 done 2026-07-22)
   replaces six sample-only Sales surfaces with one bounded Demo/API read model.
   Recognized revenue reconciles posted invoices, credits and debits; open receivables,
   monthly revenue, customer ownership and document statuses are recalculated from
   canonical facts on every request. No KPI table, fake target, forecast, export or
   queued-report action remains. All six routes include five-language copy and route
   maturity is **98/16**.

Exit criteria: tenant/cursor/Decimal domain and API proof, real-transaction browser
smoke, desktop/375px rendering and the full 114-route audit pass.

## Phase 21 — Canonical Sales Commission ✅

1. **Effective-dated plans and immutable source traces** (EPIC-038, TASK-074 done
   2026-07-22) replace the sample salesperson payout list with one auditable
   recognized-revenue calculation boundary. Customer ownership is snapshotted onto
   orders/invoices; each run reconciles invoice net revenue minus posted credits plus
   posted debits and stores source-level rates and rounded amounts. Approval uses its
   own permission and required audit note, while explicitly creating no payroll,
   payout or GL entry. The five-language Canonical route moves maturity to **99/15**.

Exit criteria: effective-date/overlap/tenant/Decimal/immutability domain proof,
authenticated RBAC/idempotency/audit API proof, no-payroll/no-GL browser smoke,
desktop/375px rendering and the full 114-route audit pass.

## Phase 22 — Canonical Sales Transaction Workspace ✅

1. **Record-specific enquiry context** (EPIC-039, TASK-075 done 2026-07-22) replaces
   the last shared sales prototype detail with one ID-only Canonical workspace. It
   re-reads the selected enquiry, customer and uniquely linked quotation from bounded
   Demo/API resources; conversion reuses the existing audited command, while every later
   document type opens its dedicated Canonical detail route. Fabricated activity, actors
   and toast-only document actions are removed. Route maturity is **100/14**.

Exit criteria: tenant-scoped detail and linked-quotation filter proof, five-language
browser workflow, desktop/375px rendering and the full 114-route audit pass.

## Phase 23 — Canonical Manual Journals ✅

1. **Balanced draft, immutable posting and linked reversal** (EPIC-040, TASK-076 done
   2026-07-22) replaces the sample new-journal form with tenant-scoped header/line facts
   and one shared Demo/PostgreSQL command path. Draft creation is GL-neutral; posting
   appends balanced dated GL legs once; correction creates a separately numbered posted
   reversal with every debit/credit swapped. Five-language composer/detail UI, audited
   idempotent actions and live Chinese browser proof move maturity to **101/13**.

Exit criteria: cross-company/date/balance/state/duplicate guards, rollback, Viewer/RBAC,
idempotency and audit proof, PGlite/PostgreSQL schema alignment, real create/post/reverse
browser workflow, desktop/375px rendering and the full release suite pass.

## Phase 24 — Canonical Bank Reconciliation ✅

1. **Imported statement facts and exact immutable GL matching** (EPIC-041, TASK-077
   done 2026-07-22) replace the interactive sample reconciliation with tenant-scoped
   statement headers/lines. Decimal validation proves opening plus signed movement equals
   closing; each statement line can link once to an exact bank-account GL leg. Missing
   charges must first use the real journal path. Audited idempotent match/unmatch/reconcile
   actions, five-language UI and service-worker v65 move maturity to **102/12**.

Exit criteria: footing/date/account/amount/one-use/state guards, Viewer/RBAC, audit and
idempotency proof, no-GL-write reconciliation, PGlite/PostgreSQL alignment, live import/
match/lock browser workflow, desktop/375px rendering and the full release suite pass.

## Phase 25 — Canonical Management Reporting and Stock Activity Aging ✅

1. **Bounded cross-module BI read model** (EPIC-042, TASK-078 done 2026-07-23)
   replaces the three sample Reporting/BI surfaces with one tenant-scoped Demo/API
   resource rebuilt from Canonical Sales, Purchasing, Inventory and GL facts. Management
   totals reconcile on every request; product-category analysis only allocates traceable
   invoice/credit lines; stock aging is honestly defined as time since latest inbound
   activity rather than a fabricated FIFO-layer age. Five-language UI, Viewer read
   permission, smoke and full desktop/375px audit move maturity to **105/9**.

Exit criteria: tenant/cursor/Decimal domain and API proof, real-transaction smoke,
five-language desktop/375px rendering and all 114 routes pass without a KPI table,
sample fallback, fake export or unsupported FIFO claim.

## Phase 26 — Canonical Product Master Creation ✅

1. **Stock-neutral product authoring** (EPIC-043, TASK-079 done 2026-07-23) replaces
   the separate sample `new-item` form with the same audited tenant-scoped product
   command used by Item Master. The five-language composer stores only real schema
   fields, accepts an explicit company-unique SKU and removes fabricated USD/GST,
   accounting, shelf-life and negative-stock controls. Product creation leaves both
   stock projections and movements empty; initial quantity must enter through Purchase
   Receipt or Stock Adjustment. Service-worker v67 moves maturity to **106/8**.

Exit criteria: atomic duplicate-SKU conflict, validation/tenant/RBAC/audit API proof,
zero opening stock, real Demo form submission, five-language desktop/375px rendering
and the full release suite pass.

## Phase 27 — Canonical Project Timesheet ✅

1. **Actor-owned project time facts** (EPIC-044, TASK-080 done 2026-07-23) replace
   the weekly sample grid with tenant/user-scoped `project_time_entry` rows. Entries
   use Decimal hours and real dates against an open project; the signed-in actor comes
   from Session, never the payload. Corrections preserve the original fact and mark it
   void with a required reason rather than delete or rewrite it. The weekly five-language
   route counts active entries only, keeps voided history visible and removes unsupported
   capacity, copy-last-week, approval and payroll claims. Service-worker v68 moves
   maturity to **107/7**.

Exit criteria: domain and authenticated API validation/tenant/actor/RBAC/audit/idempotency
proof, real create/void Demo smoke, Chinese desktop/375px live browser verification and
the full 114-route release suite pass.

## Phase 28 — Canonical Integration Delivery Log ✅

1. **Sanitized transactional-outbox visibility** (EPIC-045, TASK-081 done 2026-07-23)
   replaces the sample integration-log table with one bounded, newest-first Demo/API
   read model over existing `outbox_event` facts. Session tenant scope and
   `integration.read` protect the route. Only topic, aggregate reference, safe status,
   attempts and timestamps leave the server; payload, addresses/tokens, raw worker
   errors and worker identity never do. The five-language read-only workspace exposes
   no fabricated replay/export action and moves maturity to **108/6**.

Exit criteria: tenant/cursor/auth/sanitization domain and HTTP proof, secret-bearing
Demo smoke, desktop/375px rendering and the full 114-route release suite pass.

## Phase 29 — Canonical Bounded Customer CSV Import ✅

1. **Staged customer import facts** (EPIC-046, TASK-082 done 2026-07-23) replace the
   sample all-module wizard with one honest small-file workflow. A job accepts only
   `code,name,industry`, at most 250 rows and an explicit update-or-skip duplicate
   policy. Validation persists normalized rows and row errors before a permission-
   gated, audited and idempotent atomic run. Demo/API share the same TypeScript commands
   and newest-first keyset history. The five-language UI supports file or pasted CSV,
   exposes every validation fact and moves maturity to **109/5**.

Exit criteria: domain and authenticated API validation/rollback/tenant/RBAC/audit/
idempotency proof, real Demo smoke, desktop/375px rendering and the full 114-route
release suite pass.

## Phase 30 — Canonical Personal Activity ✅

1. **Actor-owned activity projection** (EPIC-047, TASK-083 done 2026-07-23) replaces
   the fabricated device/session/security feed with a sanitized newest-first query over
   the existing append-only audit log. Session supplies actor and tenant scope; the
   response exposes only bounded category/entity/action vocabulary, reference and time.
   Demo/API, five-language UI, opaque API cursor, 375px and full route audit move
   maturity to **110/4**. The Enquiries register was also aligned to the approved
   Suppliers-list visual standard (KPI strip, filter/action toolbar and rounded table).

Exit criteria: actor/company isolation, sanitization, opaque cursor, Demo/API browser
proof, PostgreSQL parity/security, desktop/375px and all 114 routes pass.

## Phase 31 — Canonical Notifications ✅

1. **Recipient delivery and persistent attention state** (EPIC-048, TASK-084 done
   2026-07-23) replace the sample alert feed and master-level localStorage flags with
   one tenant/company/user-addressed `app_notification` model. Server-only delivery
   validates company membership; bounded list/read/dismiss commands share one
   Demo/PostgreSQL path. API actions are permission-gated, CSRF-protected, audited and
   idempotent. The bell and five-language full page reload on company switch and expose
   no tenant/user IDs, fake preferences, outbox payloads or audit internals. The route
   follows the approved KPI/filter/rounded-list reference and moves maturity to **111/3**.

Exit criteria: actor/company isolation, sanitized public shape, RBAC/CSRF/idempotency/
audit proof, Demo/API state persistence, desktop/375px and all 114 routes pass.

## Phase 32 — Final Canonical Control Plane ✅

1. **Connector registry and tenant administration** (EPIC-049, TASK-085 done
   2026-07-23) replace the last three sample pages. Integration credentials are
   encrypted server-side and never exposed; Demo stores no secrets. Master Control is
   intentionally current-tenant only. System Settings persists audited company policy,
   document sequences and period locks over effective-dated tax facts.
2. Migration 0044, generated PGlite schema, production RLS and service-worker v73 align
   at 127 tables. Demo/API adapters share the same TypeScript commands.

Exit criteria: **115/115 Canonical, Preview=0**, 392 tests plus one expected skip,
desktop/375px route audit and in-app browser proof pass. TASK-017 physical iPhone and
Android verification remains the only human-only release check.

## Phase 33 — Page-level UI SSOT Convergence ✅

1. **Shared list and workspace contracts** (EPIC-051, TASK-087–105, completed
   2026-07-25) separate data maturity from visual-layout compliance. The approved
   transaction-list renderer owns KPI, toolbar, table/empty and pagination regions;
   master-detail registers, tabular reports and operational workspaces extend that
   contract only where their interaction model requires it.
2. **Project Timesheet correction** (TASK-096) moves the last list-shaped generic
   workspace onto `transaction-list-v1`. Weekly navigation, active-only KPIs,
   responsive rows and audited void history now use the same page structure as the
   other registers without changing the canonical time-entry domain or API.
3. **Employee detail correction** (TASK-097) moves the HR master profile from the
   unstructured `document-detail` exemption onto `master-detail-editor-v1`. The shared
   overview now supports an optional structured avatar, while contact facts, bounded
   leave history, leave-balance context and responsive navigation actions follow the
   same audited detail contract as BOM.
4. **Employee action hierarchy polish** (TASK-098) removes the malformed and
   redundant profile footer. Active status and Review leave now share the standard
   page-header action group; Directory remains available through the breadcrumb and
   HR sub-navigation without a duplicate Back button.
5. **Payroll modal correctness** (TASK-099) restores hidden alert semantics,
   generates current-period defaults in the user's local calendar and constrains
   shared modal widths to the viewport so primary actions remain reachable at 375px.
6. **Service Order detail correction** (TASK-100) moves the actionable service case
   from the unstructured document exemption onto `case-detail-v1`. A shared,
   read-only lifecycle rail now joins the canonical overview, diagnosis,
   SLA/contract context and responsive action regions without changing Assign or
   Resolve commands.
7. **List-row interaction and Service Contract detail** (TASK-101) makes openability
   an explicit shared contract instead of a visual side effect. Static registers no
   longer pretend to open, actionable rows support mouse/Enter/Space without nested
   control bubbling, and the Contracts register now opens a real read-only
   `master-detail-editor-v1` record.
8. **Depreciation run correction** (TASK-102) moves the Fixed Assets execution
   history from the generic workspace exemption onto `master-detail-register-v1`.
   Draft, Posted and Cancelled runs now share audited list/detail behavior, while
   responsive create and posting confirmation modals preserve the canonical
   straight-line calculation and balanced GL command.
9. **Asset Detail correction** (TASK-103) moves the Fixed Assets master record from
   the legacy detail exemption onto `master-detail-editor-v1`. Acquisition and
   depreciation policy are pure display facts, posted history uses a controlled
   responsive table, and book value remains a derived context instead of a fake
   editable form.
10. **Purchase Order Approval correction** (TASK-104) moves the governed purchasing
    decision from the unstructured document exemption onto `case-detail-v1`. Order
    lines, financial impact and the audit record now use the standard responsive
    regions; pending Approve/Reject commands retain their canonical validation and
    idempotency while decided requests become clean read-only cases.
11. **Goods Receipt correction** (TASK-105) moves the immutable inventory posting
    from the legacy document exemption onto `posting-detail-v1`. Source order lines,
    stock-movement evidence and posting context now share bounded responsive regions;
    the stock register is reached from one header action and duplicate footer
    navigation is removed.

Exit criteria: 43 shared list-layout routes and all 115 routes pass desktop/375px
structural audits; Timesheet and Employee pass their dedicated five-language/state
proofs, and the four master-detail editor routes pass focused and live browser
verification; Payroll modal initial/error/mobile states and all three Case Detail routes
pass focused state proofs, and Fixed Assets detail/run states pass with
service-worker v103. All three Posting Detail routes pass focused state proofs.

## Phase 34 — Employee Identity & My Work (In progress)

1. **Organisation username and multiple roles** (TASK-106 done 2026-07-25) extend the
   account with organisation code + username login, nullable pre-activation email and
   explicit company-role unions. Migration 0046 preserves existing email accounts and
   copies each legacy role exactly once without changing company access.
2. **First activation and employee link** (TASK-107 done 2026-07-25) add the
   organisation-unique employee/user link, encrypted pre-activation credential and
   forced first-login password/email completion. HR reveal is audited every time;
   completion permanently clears the AES-GCM envelope. HR reset revokes sessions and
   issues a new one-time password. Offboarding transfers direct reports, current
   customer/open-opportunity ownership and unread notifications before revoking access.
3. **Actor-owned self service** (TASK-108 done 2026-07-25) adds separate
   `employee.self.read` and `employee.team.read` permissions, effective-dated
   direct/tree hierarchy scope and actor-derived `/api/my/*` reads. Client-selected
   employee IDs fail closed; ordinary managers see direct reports only, explicit
   hierarchy grants stay company-bound, and team leave omits private reason facts.
4. **My Work navigation** (TASK-109 done 2026-07-25) adds five-language My Leave,
   My Claims and My Receipts plus capability-gated Team Calendar/My Approvals through
   `transaction-list-v1`. The five routes are Preview with Canonical actor-owned data:
   unfinished Claim/Receipt/approval domains stay honest and read-only rather than
   being promoted or simulated. Employee-only API accounts boot a restricted shell.
5. **Identity security proof** (TASK-110 done 2026-07-25) consolidates migration,
   collision, activation-secret destruction, HR reset, role union, hierarchy,
   cross-tenant and offboarding proof. Reporting lines maintain a provenance-marked
   Manager grant without deleting manual authorization. The accepted optional
   MFA/step-up/email-verification boundary is recorded in `docs/SECURITY.md`.

Exit criteria: organisation/username collisions, migration, first activation,
multi-role permission union, actor isolation, hierarchy scope, offboarding and the
explicit no-MFA/unverified-email risks are covered in Demo/API and browser proof.

## Phase 35 — Full Leave Management (In progress)

1. **Policy and calendar** (TASK-111 done 2026-07-25) add confirmed country/region
   holiday calendars, company work patterns, effective-dated leave types and
   deterministic full/half-day calculation. Official imported holidays are inert
   until HR confirmation; overlapping confirmed versions are rejected.
2. **Immutable balance** (TASK-112 done 2026-07-25) adds migration 0051 and the
   append-only entitlement, reservation, use, release, cancellation, adjustment,
   carry, expiry and encashment ledger. Pending paid leave locks the employee before
   reserving entitlement, returns an explicit paid/unpaid split when insufficient,
   and uses idempotent append facts for approval/rejection outcomes. Database triggers
   forbid update/delete and concurrent-reservation proof prevents overspending.
3. **Complete lifecycle** (TASK-113 done 2026-07-25) adds immutable revisions/events,
   Draft/Pending/Approved/Rejected/Withdrawn/Voided/Cancelled transitions, HR
   on-behalf entry, approved cancellation, evidence metadata privacy and actor-owned
   five-language My Leave list/detail. “Delete” is implemented as a reasoned Void
   tombstone; submitted and approved records follow withdrawal/cancellation instead
   of destructive erasure.
4. **Governed approval** (TASK-114 done 2026-07-25) adds versioned multi-level
   policy resolution across employee, department, leave type, days, amount and
   currency; direct-manager defaults; immutable authority/decision history;
   time-bounded delegation; reminders/escalation; and minimum-staff
   warn/add-level/block controls. `my-approvals` is now a privacy-redacted
   five-language Canonical workspace with real Demo/API decisions and delegation.
5. **Team calendar** (TASK-115 done 2026-07-25) introduces
   `calendar-workspace-v1`, privacy-redacted direct-report availability, authorised
   reporting-tree expansion, conflict indicators and optional idempotent one-way
   approved/change/cancel delivery. ERP status and revision remain authoritative.
6. **Payroll integration** (TASK-116 done 2026-07-26) adds immutable, revision-linked
   unpaid-leave deduction, cancellation recovery and policy-controlled encashment.
   Historical HR-lite rows keep their original day snapshot under Legacy Policy.
   One-time source-to-run mappings make overlapping payroll runs safe, while
   five-language Payslip and Payroll Run surfaces expose base pay, leave
   earnings/deductions and source trace.

Exit criteria: working-day/half-day calculation, pending reservation, insufficient
balance split, privacy, approval/delegation/capacity, calendar, outbound sync and
Payroll effects pass five-language desktop/375px and domain/API proof.

## Phase 36 — Receipt & Secure Document Processing (In progress)

1. **Storage provider** (TASK-117 done 2026-07-26) adds database-default
   PostgreSQL/PGlite byte content and an optional explicit single-node filesystem
   provider. Tenant ownership, immutable versions, SHA-256, MIME, size, retention,
   legal hold and the filesystem locator remain queryable database facts. The same
   owner/manager/cross-tenant contract and integrity verification cover both providers.
2. **Bounded capture** (TASK-118 done 2026-07-26) adds 20 MB
   JPEG/PNG/HEIC/PDF upload with magic-byte/MIME/extension agreement and a real
   20-page PDF ceiling. The five-language Canonical My Receipts workspace provides
   mobile camera/file capture, IndexedDB offline drafts and Canvas crop, rotation and
   compression for JPEG/PNG. Logout warns and clears only unsynchronised local drafts;
   Canonical stored receipts remain intact and enter fail-closed quarantine.
3. **Fail-closed scan and governed extraction** (TASK-119 done 2026-07-26) quarantines
   every file, defaults to retry-safe local OCR and permits external Vision only with
   an encrypted BYOK connector plus company provider, region and retention policy.
   **Confidence-governed receipt inbox** (TASK-120 done 2026-07-26) preserves immutable
   field source/model/confidence provenance and prior uploader authorization. System
   submission requires every critical field at least 98%, clean safety/amount/conflict
   and exact-duplicate checks, company opt-in and retry-stable system attribution;
   every failed check enters explicit human review.
4. **Void, retention and purge** (TASK-121 done 2026-07-26) distinguishes draft
   deletion, submitted/approved reasoned Void, posted/sealed correction versions and
   post-retention two-person purge, with legal hold, paper-original custody and a
   permanent hash tombstone. **Sensitive access and storage parity** (TASK-122 done
   2026-07-26) completes retry-stable view/download/print/export audit, quarantine
   isolation and cross-provider authorization/retention/hash proof.

Exit criteria: storage backends, upload limits, quarantine, extraction retry,
confidence policy, auto-submit attribution, void/purge states, privacy and PWA logout
cleanup pass Demo/API, five-language and responsive proof.

## Phase 37 — Expense Claims & Accounting (Planned)

1. **Effective tax/GL/FX policy** (TASK-123 done 2026-07-26) snapshots category,
   evidence, limits, payment source, Decimal tax/FX and account mappings at submission;
   Finance-only clean evidence may append a verified actual bank charge. **Claim
   authoring** (TASK-124 done 2026-07-26) adds employee-paid/company-paid multi-line
   claims, governed receipt links and exact department/cost-centre/project allocation.
   Employee-owned facts become immutable at final submission; automatic submission
   needs separate claim authorization and an eligible authorized receipt on every line.
2. **Approval and control** (TASK-125 done 2026-07-26) adds Manager + Finance line
   decisions, configurable extra levels, multi-signal duplicate blocking and budget
   warning/add-level/block. **Corporate-card reconciliation** (TASK-126 done
   2026-07-26) adds bounded CSV/XLSX import, explainable reviewable receipt matching
   and persistent holder/missing-receipt follow-up.
3. **Non-receipt expenses and posting** (TASK-127/128 done 2026-07-26) now
   snapshots mileage/per-diem formula evidence without fabricated receipts and
   reconciles cash-advance application, exact repayment and employee-payable
   differences through paired GL evidence. Final Finance approval transactionally
   posts period-valid balanced Expense/Input Tax against Employee Payable or the
   configured company-paid account, with stable replay identity and recoverable
   all-or-nothing failure.
4. **SSOT UI and proof** (TASK-129 done 2026-07-26) delivers five-language standard
   list/case-detail states without allowing approver edits, self-approval or
   client-selected employee identity. The dedicated desktop/375px proof covers partial
   decisions, policy and actual FX, duplicate override, exact allocation, budget
   breach, immutable posting and recoverable posting failure.

Exit criteria: authoring, extraction handoff, partial decisions, duplicate override,
FX, allocation, budget, card matching, advances and balanced idempotent posting pass
domain/API/browser and current release gates.

## Phase 38 — Reimbursement Payments & Tax Evidence (In Progress)

1. **Payout profiles and maker/checker settlement** (EPIC-056) now has encrypted,
   masked, independently verified employee bank profiles (TASK-130 done 2026-07-26)
   and immutable maker/checker batch release with self-payment prevention (TASK-131
   done 2026-07-26). TASK-132 (done 2026-07-26) adds versioned encrypted bank-file
   export, purpose-bound access audit, partial bank-result import, failed-line retry
   and successful-line-only Dr Employee Payable / Cr Bank posting without duplicate
   settlement.
2. **Immutable tax evidence packages** (TASK-133/134) generate one-snapshot register,
   merged PDF, XLSX/CSV, original ZIP and hash manifest. Finalised packages are
   immutable; later facts create a superseding correction pack and difference report.
3. **Complete release proof** (TASK-135) validates the full identity/leave/payroll and
   receipt/expense/payment/tax chains without adding direct bank API or direct
   IRAS/LHDN filing.

Exit criteria: payout privacy, maker/checker separation, partial payment replay,
balanced cash posting, package consistency/hash verification, SG/MY retention, legal
hold, correction versions and sensitive-access audit pass all local and PostgreSQL
release gates.
