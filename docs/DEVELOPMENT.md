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
| `npm run preview` | Serve the built `web/dist/` locally |
| `npm run migrate` | Apply Drizzle migrations to PostgreSQL (production mode) |
| `npm run generate` | Generate a Drizzle migration from schema changes |
| `npm run seed` | Seed sample data (demo dataset) |
| `npm run typecheck` | `tsc --noEmit` over the schema + data layer |
| `npm run demo` | **Dual-adapter proof** — same repo code on PGlite (and PostgreSQL if `POSTGRES_URL` set) |
| `npm run check:drift` | **Schema drift check** — compares every ordered Drizzle migration with the generated `web/public/db/erp-system-schema.sql`; fails with a readable diff on any mismatch. Demo SQL is generated, not copied by hand. Runs in CI on every PR. |
| `npm run smoke` | **Browser smoke test** — requires `npm run build:demo` first. Launches headless Chromium (Playwright) at desktop (1280×800) and mobile (375×812), bypasses the first-run wizard/login, asserts the dashboard renders with zero console/page errors, and executes the core Demo ESM transaction proof. That proof also opens the freshly-created goods receipt and supplier invoice and asserts their stock/GL traces. Runs in CI on every PR. |
| `npm run audit:screens` | **Screen audit** — requires `npm run build:demo` first. Boots the demo at desktop (1280×800) and mobile (375×812), reads the live `SCREENS` and route-level `SCREEN_META` registries, applies stateful fixtures for detail routes, and drives all current 128 routes through the router. It fails on console/page errors, synchronous throws, prototype identity on Canonical routes, missing Preview banners, enabled Preview write actions, missing shared module navigation, whole-page overflow, hidden active tabs, or overflowing standard action bars. Runs in CI on every PR. |
| `npm test` | **Unit tests** (`vitest run`) — `confirmSalesOrder` (success + GL-balance, whole-chain rollback on insufficient stock, `PostingError` when no tax rule covers the date), `issueStock` (deduct, insufficient, boundary at exactly available qty), `getEffectiveTaxRate` (dated-boundary cases: inclusive `validFrom`, exclusive `validTo`, open-ended, no-match). Each test gets its own fresh in-memory PGlite instance (`src/test/helpers.ts`). Runs in CI on every PR. |
| `npm run lint` | ESLint over the current root/Web source set |

Release note (2026-08-10): `npm run audit:screens` now passes all 128 routes at desktop
and 375 px, with 128 Canonical / 0 Preview, no console/page errors, and no active-tab,
layout, action-bar or declared-contract failures. The same release pass must still be
kept separate from localization: `npm run audit:i18n` covers the complete 128-route ×
5-language × 2-viewport browser matrix, but exits non-zero on 263 static blocking
findings (missing locale keys and hardcoded/dynamic user-facing text). The access-matrix
audit remains a separate passing authorization regression gate.

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
128 — through the router directly, so new screens are covered automatically without
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
  core/            # shell, routing, auth, module registry
  data/
    schema/        # Drizzle schema (shared by both modes)
    adapters/      # pglite adapter (demo) · api adapter (production)
    seed/          # mock data for demo
  shared/          # isomorphic business logic (cross-module flows)
  modules/
    inventory/  sales/  purchasing/  finance/  settings/
drizzle/           # generated migrations
docs/              # this documentation
web/               # real frontend app source
references/ui/     # reference prototypes and design studies
api/               # planned: Node + Express server (production mode only)
infra/             # planned: Docker/deployment assets
db/init/           # planned: Postgres init scripts (run once on first boot)
```

See [FRONTEND_PLAN.md](FRONTEND_PLAN.md) before adding frontend code. The current
`references/ui/aria-erp/` folder is the user's Aria ERP visual baseline. Clone the layout
and component look, but do not copy unrelated mock data, duplicate schemas, or static
screens outside the current milestone.

## 6. Adding a module (the golden path)

1. Add the module's tables to `src/data/schema/<module>.ts`.
2. `npm run generate` → review the migration in `drizzle/`.
3. Write repository functions in `src/modules/<module>/repo.ts` — **always** tenant-scoped,
   keyset-paginated, explicit columns (see [SCALABILITY.md](SCALABILITY.md)).
4. Put cross-module logic in `src/shared/` so it runs in both demo and API.
5. Register the module in `src/core/module-registry`.
6. Add seed rows in `src/data/seed/` so the demo shows the module.
7. Verify in **both** modes before opening a PR.

> **Architecture rule:** adding a module must not require editing another module. If it
> does, the boundary is wrong.

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
