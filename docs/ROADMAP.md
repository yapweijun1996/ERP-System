# Roadmap

This roadmap keeps the ERP build focused on a working demo first, then production
readiness. The order matters: prove the product shape in the browser, then harden the
server and Docker path. Status reviewed **2026-07-16** (see [STATUS.md](STATUS.md)).

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

## Phase 3 — Core ERP Flow ✅ (audit open)

Goal: make the demo show a believable end-to-end ERP transaction.

Delivered: customer/product browse, confirm sales order (SO-2), stock deduction,
invoice generation, GL posting view, insufficient-stock rollback (SO-3).

Open: TASK-017 real-device verification, TASK-018 screen audit for sample-shape crashes.

## Phase 4 — Setup Wizard ✅ (demo path) — production lock is Phase 5 work

Goal: support first-run setup in demo and production.

Deliverables: language selection; master/company creation; country/currency/tax setup
for Singapore and Malaysia; first admin user; optional sample data seed; production
setup lock after first admin. (TASK-009 ✅ + TASK-010 ✅, both done 2026-07-16 — wizard
shell gated on boot, writes company/tax/CoA/admin-user to PGlite in one transaction,
topbar company switcher rewired to the canonical company list.)

Exit criteria: empty demo opens wizard first (✅ met); production API can persist wizard
results to PostgreSQL (⬜ — needs TASK-011/TASK-019; the demo-adapter `completeSetup()`
contract is defined and ready for an API adapter to implement the same shape).

## Phase 5 — Production Runtime 🔶 (`docker compose up -d` works; writes + polish open)

Goal: run the ERP as a self-hosted Docker deployment.

Deliverables: wire the `VITE_DATA_MODE` seam (TASK-019 ✅); API server (TASK-011 ✅);
Docker Compose stack `web`+`api`+`db` (TASK-012 ✅ done 2026-07-16 —
`docker-compose.yml` + `Dockerfile.api` + `web/Dockerfile` + `web/nginx.conf`, built
and run end-to-end for real: healthchecks pass, `docker compose exec api npm run
migrate`/`npm run seed` work, the dashboard renders through the nginx reverse proxy
with zero CORS needed); PostgreSQL concurrency proof (TASK-013 ✅ — proven against
real Postgres, `POSTGRES_URL=... npm run demo` passes including the true-concurrency
race). Remaining: wire the frontend to render the real dashboard instead of the
waiting screen (TASK-026, quick win, unblocked now that TASK-012 settles the
same-origin proxy question); align `Makefile`/`scripts/setup.sh` end-to-end —
individually-verified `docker compose` commands are done, but `scripts/setup.sh`
itself is still unverified (blocked on `.env.example` sandbox permissions — flag for
a session that can read it) (TASK-021); server-side stock and finance write
endpoints (confirmOrder/completeSetup/switchCompany — client contract already
defined); minimal real auth (TASK-024); schema-drift check between core and demo SQL
copies (TASK-020).

Exit criteria: `docker compose up -d` starts all services; production transaction +
concurrency tests pass against PostgreSQL (TASK-013); browser writes stock/money
through API only.

## Phase 6 — Quality And Operations 🔶 (CI gate live; rest open)

Goal: make the system safe to maintain.

Deliverables: CI checks for typecheck/build/demo (TASK-014 ✅ done 2026-07-16 —
`.github/workflows/ci.yml` runs on every PR: root+web typecheck, the PGlite
transaction proof, and the demo build); vitest unit tests (TASK-025); browser smoke
tests (TASK-015); transaction tests against PostgreSQL in CI (currently only proven
manually — TASK-013 — not yet gated in CI, since that needs a Postgres service
container in the workflow); deployment docs; backup/restore runbook; release
checklist.

Exit criteria: every PR can be validated with documented commands (✅ for
typecheck/demo-build; ⬜ for unit/smoke/PG-parity); demo and production paths have
separate deployment checks (✅ — `deploy-pages.yml` deploys the demo, `ci.yml`
validates every PR, Docker Compose is the production runtime).

## Phase 7 — Module Expansion ⬜

Goal: convert mock modules into real domains, one at a time, each end-to-end
(schema → seed → screens → demo assertions) in both modes.

Order of attack:

1. **Purchasing** (EPIC-008) — completes the stock story: goods receipt IN mirrors
   sales issue OUT; AP mirrors AR.
2. CRM (leads/activities feeding sales orders).
3. HR-lite or Fixed Assets (whichever a real prospect asks for first).
4. Relabel or hide remaining mock screens so the demo never oversells (ties TASK-018).

Exit criteria per module: no mock data files for that module remain; `src/demo.ts`
asserts its core transaction; screens work in demo and api modes.
