# Project Status — reviewed 2026-07-16

One-page truth about what is **built**, what is **mock**, and what is **documented but
not implemented**. Read this first before picking any task. Update this file whenever
an epic-level milestone lands.

## TL;DR

The repo is a working **browser-first ERP demo**: real PostgreSQL (PGlite/WASM) runs in
the browser, persisted to IndexedDB, with a genuine cross-module transaction
(sales order → stock deduction → invoice → balanced GL) proven both in `src/demo.ts`
and in the live UI. **The production path now genuinely runs end-to-end**:
`docker compose up -d` starts `web`+`api`+`db`, migrates, seeds, serves a real
`GET /api/dashboard` through an nginx reverse proxy, and the frontend actually
**renders that dashboard** (real figures, working company switcher, per-company data
verified distinct) instead of the "waiting for API" screen — the waiting screen only
shows when the API genuinely isn't reachable. What's still missing: other modules
(inventory/sales/finance) have no api-mode data source yet, and there are no write
endpoints (confirm order / setup) on the server side yet.

## What actually works (verified in code)

| Area | Status | Evidence |
| --- | --- | --- |
| Demo boot: PGlite + IndexedDB (`idb://erp-system-demo`) | ✅ Working | `web/public/assets/erp-system-data-adapter.js` |
| Canonical schema (18 tables, multi-tenant `master_fn`/`company_fn`) | ✅ Working | `drizzle/0000_init.sql`, `src/data/schema/` |
| Cross-module transaction with rollback | ✅ Working | `src/modules/sales/confirmOrder.ts`; browser mirror in adapter (`confirmOrder`) |
| Transaction proof script | ✅ Working | `npm run demo` → `src/demo.ts` (PGlite always; PostgreSQL if `POSTGRES_URL` set) |
| Sales screens (orders, detail, confirm SO-2 / over-stock SO-3) | ✅ Canonical data | `screens-sales*.js`, TASK-006/007 |
| Inventory screens (stock on hand, item master, movements) | ✅ Canonical data | `screens-inv*.js`, TASK-005 |
| Finance/GL screens (invoices, journals, CoA, ledger, P&L, AR aging) | ✅ Canonical data | `screens-fin*.js`, TASK-008 |
| PWA (manifest, SW, update prompt, safe areas) | ✅ Working | `web/public/manifest.webmanifest`, `sw.js`, `pwa.js`, TASK-016 |
| GitHub Pages deploy | ✅ Working | `.github/workflows/deploy-pages.yml` |
| CI validation on every PR (typecheck root+web, transaction proof, demo build, schema-drift check) | ✅ Working | `.github/workflows/ci.yml`, TASK-014 + TASK-020 |
| Schema drift check (`drizzle/0000_init.sql` vs `erp-system-schema.sql`) | ✅ Working | `scripts/check-drift.mjs`, `npm run check:drift`, TASK-020 |
| Browser smoke test (desktop + mobile, zero console/page errors, dashboard content verified) | ✅ Working | `scripts/smoke.mjs`, `npm run smoke`, Playwright, wired into CI with browser caching, TASK-015 |
| Setup wizard (language/org/company/admin/AI preview) writes to PGlite | ✅ Working | `web/public/assets/screens-setup-wizard.js` + `ErpSystemDemo.completeSetup()`, gated in `app.js` boot(), TASK-009+010 |
| Topbar company switcher (real, canonical companies) | ✅ Working | `buildCompanyMenu()`/`wireCompanyMenu()` in `app.js` + `ErpSystemDemo.switchCompany()`, TASK-010 |
| `VITE_DATA_MODE=demo\|api` build-time adapter seam | ✅ Working | `web/index.html` (`window.erpDataMode()`), `erp-system-data-adapter.js` (demo), `erp-system-api-adapter.js` (api), TASK-019 |
| Production API server: `GET /health`, `GET /api/dashboard` over `DATABASE_URL` | ✅ Working | `src/server.ts` (`npm run server`); verified against a real local PostgreSQL — migrations, seed, and the true-concurrency proof all pass; dashboard figures curl-verified correct and tenant-scoped, TASK-011 |
| Docker Compose stack: `web` (nginx) + `api` (Express) + `db` (PostgreSQL) | ✅ Working | `docker-compose.yml`, `Dockerfile.api`, `web/Dockerfile`, `web/nginx.conf`; built and run end-to-end for real (healthchecks, `docker compose exec api npm run migrate`/`seed`, dashboard through the reverse proxy), then fully torn down, TASK-012 |
| PostgreSQL concurrency/parity proof | ✅ Working | `POSTGRES_URL=... npm run demo` — proven twice against real Postgres (host + inside verification), TASK-013 |
| `VITE_DATA_MODE=api` renders the real dashboard (not the waiting screen) | ✅ Working | `erp-system-api-adapter.js` calls `GET /api/dashboard` on ready and maps it onto `DB.*`; company switcher also works (re-fetches with a different scope). Other modules (inventory/sales/finance) have no api-mode data source yet. TASK-026 |

## What renders but is mock-only

~92 routes are registered in the `SCREENS` registry; only sales/inventory/finance (and
parts of master data/settings) read the canonical PGlite database. The rest render the
original Aria/Northwind sample data from `web/public/assets/data-*.js`:

**Purchasing, CRM, Manufacturing, Quality, Warehouse (advanced), HR/Payroll, Projects,
Service, Fixed Assets, Reporting/BI, Integration, Admin** — no schema tables exist for
any of these. TASK-018 tracks the audit; converting or clearly relabeling them is
roadmap work (see [ROADMAP.md](ROADMAP.md) Phase 7).

## Documented but NOT implemented (do not assume these exist)

| Claim in docs | Reality |
| --- | --- |
| `VITE_DATA_MODE=api` renders inventory/sales/finance with real data | **Not yet.** Only the dashboard has an api-mode data source (TASK-026). Other module screens have no api-mode payload — they would need their own `GET /api/*` endpoints and DB.* mapping. |
| API server has **write** endpoints (confirm order, complete setup) | Not built. Only `GET /health` + `GET /api/dashboard` exist (`switchCompany` doesn't need one — it's a read with a different scope). The client-side contract (`erp-system-api-adapter.js`) already defines the shape these must satisfy. → follow-up to TASK-011 |
| `make setup` (`scripts/setup.sh`) works end-to-end | **Unverified**, not because it's broken — `docker-compose.yml` and every `docker compose` command the script wraps are individually proven working (TASK-012) — but because `scripts/setup.sh` does `cp .env.example .env` and `.env.example` is blocked by this sandbox's permission settings. A session with access to that file should run `make setup` once to confirm. → TASK-021 |
| `deploy/erp-server.mjs` | Still just a static "Live" placeholder page + `/health` — **not** the real API; the real API is `src/server.ts` now, run via `npm run server` locally or as the `api` service in Docker. |
| Real login/auth | `renderLogin()` is a demo stub; user hardcoded to Admin/Superadmin. → TASK-024 |
| Setup wizard persists choices in **production (API/PostgreSQL)** | Not built. TASK-009+010 cover the demo (PGlite) path only; an API adapter implementing the same `completeSetup()` contract is TASK-011/TASK-019. |
| `npm test` / `npm run lint` (referenced in CONTRIBUTING.md) | Neither script exists. Only `npm run demo` acts as a test gate. → TASK-025 |

## Known design debt

1. **Manual schema sync.** The frontend does not import `src/`. Schema/seed/txn logic
   is hand-copied to `web/public/db/*.sql` and the adapter re-implements
   `confirmOrder.ts` in raw SQL. Any schema change must be made in BOTH places —
   `npm run check:drift` (TASK-020, runs in CI on every PR) now catches schema
   drift automatically, but it only compares `drizzle/0000_init.sql` against
   `erp-system-schema.sql`; it does **not** check `src/data/seed.ts` against
   `erp-system-seed.sql`, or `confirmOrder.ts` against the adapter's raw-SQL
   mirror — those two still rely on manual discipline. This is still the #1
   landmine, now partially — not fully — guarded.
2. **PGlite loads from jsDelivr CDN** with a 20 s timeout → static fallback. Offline
   first-load depends on the SW cache.
3. **`web/dist/` is gitignored** (built fresh by `deploy-pages.yml` on every deploy) —
   a local `npm run build:demo` output is disposable; don't hand-edit files under `dist/`.
4. ~~CI (`deploy-pages.yml`) does not run `typecheck:web`~~ — fixed by
   `.github/workflows/ci.yml` (TASK-014), which runs on every PR; `deploy-pages.yml`
   itself is unchanged (deploy-only, still doesn't run `typecheck:web`, which is
   fine since `ci.yml` already gated it before merge).

## Task backlog snapshot (tasks/tasks.jsonl)

- Done: TASK-001…015, TASK-016, TASK-019, TASK-020, TASK-026 (19)
- Todo: TASK-017, 018, 021…025 (7)
- Next up: TASK-021 (align Makefile/setup.sh, needs a session with `.env.example`
  access), TASK-024 (real auth, unblocked), TASK-025 (vitest unit tests), TASK-018
  (screen audit)
- **Permanently blocked without a human**: TASK-017 (real-device verification)
  requires a physical phone — no agent can complete this task alone.

## Where to go next

- Product scope → [MVP.md](MVP.md)
- Contract of record → [SPEC.md](SPEC.md)
- How it's built / conventions → [DESIGN.md](DESIGN.md)
- Work breakdown → [EPICS.md](EPICS.md), [ROADMAP.md](ROADMAP.md), `tasks/tasks.jsonl`
- Agent workflow rules → [/CLAUDE.md](../CLAUDE.md)
