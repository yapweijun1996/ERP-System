# Development

## 1. Prerequisites

- Node.js 20+
- Docker + Docker Compose (for production-mode local runs)
- PostgreSQL client tools (`psql`, `pg_dump`) optional, for DB work

## 2. Install

```bash
npm install
```

## 3. Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (demo data adapter by default) |
| `npm run build:demo` | `VITE_DATA_MODE=demo` → static `web/dist/` (PGlite) |
| `npm run build` | `VITE_DATA_MODE=api` → `web/dist/` for the Docker `web` image |
| `npm run test:e2e:company-receipts-api` | Builds API mode, then serves it with an isolated same-origin PGlite API fixture and drives authenticated Company Receipts confirmation, refresh/search/range, Preview/PDF/Print and responsive checks. It passed at 1440×900 and 375px on 2026-08-12. This fixture never contacts PostgreSQL or production. |
| `npm run test:e2e:company-receipts-postgres` | Uses the same authenticated browser journey against an explicitly supplied `TASK183_POSTGRES_URL`. It rejects a non-empty database before migrations/seed; the 2026-08-12 proof passed against a new disposable local PostgreSQL 16 database. It does not deploy or use production data. |
| `npm run test:e2e:platform-workspace-layout` | Builds API mode and checks Platform workspace desktop/mobile containment. |
| `npm run test:e2e:platform-workspace-demo-autofill` | Builds the explicitly flagged hosted-Demo presentation and checks sample login/defaults, password controls, resume and new-Company safety. |
| `npm run preview` | Serve the built `web/dist/` locally |
| `npm run migrate` | Apply Drizzle migrations to PostgreSQL (production mode) |
| `npm run generate` | Generate a Drizzle migration from schema changes |
| `npm run seed` | Seed sample data (demo dataset) |
| `npm run typecheck` | `tsc --noEmit` over the schema + data layer |
| `npm run demo` | **Dual-adapter proof** — same repo code on PGlite (and PostgreSQL if `POSTGRES_URL` set) |
| `npm run check:drift` | **Schema drift check** — compares every ordered Drizzle migration with the generated `web/public/db/erp-system-schema.sql`; fails with a readable diff on any mismatch. Demo SQL is generated, not copied by hand. Runs in CI on every PR. |
| `npm run smoke` | **Browser smoke test** — requires `npm run build:demo` first. Launches headless Chromium (Playwright) at desktop (1280×800) and mobile (375×812), bypasses the first-run wizard/login, asserts the dashboard renders with zero console/page errors, and executes the core Demo ESM transaction proof. That proof also opens the freshly-created goods receipt and supplier invoice and asserts their stock/GL traces. Runs in CI on every PR. |
| `npm run audit:screens` | **Screen audit** — requires `npm run build:demo` first. Boots desktop/mobile, reads live `SCREENS`/`SCREEN_META`, applies detail fixtures and drives every registered route (129 at HEAD). It fails on console/page errors, maturity/contract errors, overflow and hidden active navigation. |
| `npm test` | **Vitest unit/integration suite** — domain transactions, API/auth, migrations, PGlite parity and conditional PostgreSQL security coverage. Current HEAD collects 170 files/666 tests; collection is not a pass result. Most isolated tests use fresh PGlite state; the PostgreSQL suite requires its explicit URL/environment and otherwise records one conditional skip. |
| `npm run lint` | ESLint over the current root/Web source set |

Current source note (2026-08-12): 129 Canonical / 0 Preview routes exist; 128 declare API
mode, with `staff-calendar` the sole exception. Static i18n passes 1,545 keys/72 packs.
TASK-183 retains dated 129 × 5 × 2 browser evidence. TASK-194 did not rerun browser gates
because Chromium is absent, so install the pinned browser before claiming current HEAD
screen/i18n/smoke success.

### Browser smoke test

```bash
npm run build:demo   # smoke.mjs serves the already-built web/dist/, it does not build it
npm run smoke
```

First run needs the Chromium binary: `npx playwright install chromium` (~170 MB, cached
by CI via `actions/cache` keyed on the `playwright` version in `package.json`). The test
is a shell/dashboard smoke check, not a wizard/login flow test — it intentionally skips
straight to the dashboard via `localStorage`, since the wizard and confirm-order flows are
covered by manual verification recorded in their own tasks (`tasks/tasks.jsonl` TASK-009,
TASK-007).

### Screen audit

```bash
npm run build:demo   # audit-screens.mjs serves the already-built web/dist/, it does not build it
npm run audit:screens
```

Same Chromium requirement as the smoke test. Unlike the smoke test (which only checks the
dashboard shell), this drives every route in the live `SCREENS` registry — currently
129 — through the router directly, so new screens are covered automatically without
updating a route list here. Route maturity is declared in `SCREEN_META`, not inferred from
a module-level mock allowlist: partially migrated modules such as Purchasing and CRM can
therefore promote one route at a time. Detail routes use explicit fixtures so `txn-view`
and `pur-txn-view` are audited rather than silently skipped.

### Dual-adapter demo

`npm run demo` runs the same seed + [repo](../src/data/repo.ts) code against PGlite and,
when `POSTGRES_URL` is set, PostgreSQL — then asserts the results are identical. This is
the runtime proof that one codebase serves both modes. To verify against real PostgreSQL:

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=erp -p 55432:5432 postgres:16
POSTGRES_URL="postgres://postgres:test@localhost:55432/erp" npm run demo
# → IDENTICAL ACROSS BOTH ADAPTERS ✅
docker rm -f pg
```

The PostgreSQL target must contain zero user tables. A read-only preflight runs before
the migrator and seed, so an API/UAT/previously-used proof database fails closed without
being changed. The first run owns migration and seed of the empty disposable database;
a second run against the same database deterministically refuses. Drop and recreate only
the dedicated proof database when another successful run is required. PGlite is always
fresh and in-memory.

> These scripts are the intended contract. As modules land, keep this table in sync — it
> is referenced by [DEPLOYMENT.md](DEPLOYMENT.md) and CI.

## 4. Running both modes locally

**Demo (no backend):**
```bash
npm run dev          # or: npm run build:demo && npm run preview
```

**Production (Docker):**
```bash
docker compose up -d
docker compose exec api npm run migrate
# app at http://localhost:8080
```

## 5. Project layout

```
src/
  api/             # Express routes, resource/action dispatcher and audit
  auth/            # tenant/Platform sessions, permissions and entitlement
  data/schema/     # Drizzle schema shared by both modes
  modules/         # shared transactional domain commands by ERP area
  worker/          # dedicated worker entry points
drizzle/           # generated migrations
deploy/             # migration, RLS and release scripts
docs/              # this documentation
web/               # classic-script frontend + bundled Demo/PGlite runtime
references/ui/     # reference prototypes and design studies
docker-compose*.yml # development and production container definitions
```

See [FRONTEND_PLAN.md](FRONTEND_PLAN.md) before adding frontend code. The current
`references/ui/aria-erp/` folder is the user's Aria ERP visual baseline. Clone the layout
and component look, but do not copy unrelated mock data, duplicate schemas, or static
screens outside the current milestone.

## 6. Adding a module (the golden path)

1. Add the module's tables to `src/data/schema/<module>.ts`.
2. `npm run generate` → review the migration in `drizzle/`.
3. Add tenant-scoped, bounded repository/domain commands under
   `src/modules/<module>/`; select explicit columns and use keyset pagination where
   ordering is pageable (see [SCALABILITY.md](SCALABILITY.md)).
4. Keep the authoritative cross-module transaction in `src/modules/` and reuse another
   module's public command rather than duplicating its stock, ledger or workflow rules.
5. Register commercial entitlement in `src/auth/moduleCatalog.ts`, API/resource and
   permission mappings in `src/api/`/`src/auth/`, and the route/adapters in the global
   `SCREENS` frontend.
6. Add compact seed rows through `src/data/seed.ts` or the existing showcase generator;
   do not invent a second hand-written business schema.
7. Verify shared commands in PGlite and PostgreSQL, then verify the Demo/API UI paths
   before opening a PR.

> **Architecture rule:** a new module may integrate with another module only through a
> stable public command/read contract. It must not edit or reimplement the other
> module's governed facts.

## 7. Verification expectations

Before any change is considered done:
- `npm run build:demo` exits 0 and the demo renders.
- `npm test` passes.
- frontend milestones pass desktop and mobile layout checks.
- demo mode runs without a backend and persists sample data through PGlite/IndexedDB.
- production mode runs through Docker with API/PostgreSQL for stock and finance writes.
- For large-table queries, run the [SCALABILITY checklist](SCALABILITY.md#10-checklist-before-any-large-table-feature-ships).
- Production transaction flows tested against Dockerized PostgreSQL, not just the demo.

## 8. Conventions

- Money is `numeric`, never `float`.
- All timestamps `timestamptz`, UTC.
- Every business query filters by `master_fn` + `company_fn` (see [MULTI_TENANCY.md](MULTI_TENANCY.md)).
- No `SELECT *`, no `OFFSET` pagination — see [SCALABILITY.md](SCALABILITY.md#1-the-cardinal-rules-non-negotiable).
- Schema changes go through Drizzle migrations, never hand-edited SQL on a live DB.
