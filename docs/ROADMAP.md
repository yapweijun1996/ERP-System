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
results to PostgreSQL (⬜ — needs TASK-011/TASK-019; the demo-adapter `completeSetup()`
contract is defined and ready for an API adapter to implement the same shape).

## Phase 5 — Production Runtime 🔶 (stack + Makefile done; server-side writes open)

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
target against a live, isolated stack — see [STATUS.md](STATUS.md)). Remaining:
server-side stock and finance write endpoints (confirmOrder/completeSetup/
switchCompany/purchasing — client contract already defined, production
`completeSetup()` still explicitly rejects "not available yet").

Exit criteria: `docker compose up -d` starts all services; production transaction +
concurrency tests pass against PostgreSQL (TASK-013); browser writes stock/money
through API only.

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

## Phase 7 — Module Expansion 🔶 (purchasing done; CRM done)

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
3. HR-lite or Fixed Assets (whichever a real prospect asks for first).
4. Relabel or hide remaining mock screens so the demo never oversells (TASK-018 ✅
   done 2026-07-17 — see Phase 3; this item now means keeping that guarantee as
   Purchasing/CRM/HR convert one at a time, not a one-time sweep).

Exit criteria per module: no mock data files for that module remain; `src/demo.ts`
asserts its core transaction; screens work in demo and api modes.
