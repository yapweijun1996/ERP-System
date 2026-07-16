# Project Status — reviewed 2026-07-16

One-page truth about what is **built**, what is **mock**, and what is **documented but
not implemented**. Read this first before picking any task. Update this file whenever
an epic-level milestone lands.

## TL;DR

The repo is a working **browser-first ERP demo**: real PostgreSQL (PGlite/WASM) runs in
the browser, persisted to IndexedDB, with a genuine cross-module transaction
(sales order → stock deduction → invoice → balanced GL) proven both in `src/demo.ts`
and in the live UI. **Everything labeled "production" (Docker, API server, PostgreSQL
runtime, `VITE_DATA_MODE` switch) is documented but not yet built.**

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
| Setup wizard (language/org/company/admin/AI preview) writes to PGlite | ✅ Working | `web/public/assets/screens-setup-wizard.js` + `ErpSystemDemo.completeSetup()`, gated in `app.js` boot(), TASK-009+010 |
| Topbar company switcher (real, canonical companies) | ✅ Working | `buildCompanyMenu()`/`wireCompanyMenu()` in `app.js` + `ErpSystemDemo.switchCompany()`, TASK-010 |

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
| `VITE_DATA_MODE=demo\|api` switches the data backend | **Not wired.** No `VITE_DATA_MODE` / `import.meta.env` reference exists in `web/public/assets/`. The adapter always boots PGlite with a static in-file fallback. → TASK-019 |
| `make setup` / `docker compose up` production stack | **No Dockerfile or compose file exists anywhere.** `Makefile` and `scripts/setup.sh` call `docker compose exec api/db` against services that don't exist. → TASK-011/012/021 |
| Production API server | Not built. `deploy/erp-server.mjs` is a static "Live" placeholder page + `/health`, not the API. → TASK-011 |
| Real login/auth | `renderLogin()` is a demo stub; user hardcoded to Admin/Superadmin. → TASK-024 |
| Setup wizard persists choices in **production (API/PostgreSQL)** | Not built. TASK-009+010 cover the demo (PGlite) path only; an API adapter implementing the same `completeSetup()` contract is TASK-011/TASK-019. |
| `npm test` / `npm run lint` (referenced in CONTRIBUTING.md) | Neither script exists. Only `npm run demo` acts as a test gate. → TASK-025 |

## Known design debt

1. **Manual schema sync.** The frontend does not import `src/`. Schema/seed/txn logic
   is hand-copied to `web/public/db/*.sql` and the adapter re-implements
   `confirmOrder.ts` in raw SQL. Any schema change must be made in BOTH places until a
   drift check (TASK-020) or shared code path exists. This is the #1 landmine.
2. **PGlite loads from jsDelivr CDN** with a 20 s timeout → static fallback. Offline
   first-load depends on the SW cache.
3. **`web/dist/` is gitignored** (built fresh by `deploy-pages.yml` on every deploy) —
   a local `npm run build:demo` output is disposable; don't hand-edit files under `dist/`.
4. CI (`deploy-pages.yml`) does not run `typecheck:web` (→ TASK-014).

## Task backlog snapshot (tasks/tasks.jsonl)

- Done: TASK-001…010, TASK-016 (11)
- Todo: TASK-011…015, 017…025 (14)
- Next up (P0): TASK-019 (wire data-mode seam), TASK-011/012/013 (API + Docker + PG
  parity), TASK-024 (real auth, now unblocked)

## Where to go next

- Product scope → [MVP.md](MVP.md)
- Contract of record → [SPEC.md](SPEC.md)
- How it's built / conventions → [DESIGN.md](DESIGN.md)
- Work breakdown → [EPICS.md](EPICS.md), [ROADMAP.md](ROADMAP.md), `tasks/tasks.jsonl`
- Agent workflow rules → [/CLAUDE.md](../CLAUDE.md)
