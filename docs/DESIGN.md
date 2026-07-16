# DESIGN — How the system is built

Working-level design notes for whoever (human or AI agent) writes the next line of
code. Architecture rationale lives in [ARCHITECTURE.md](ARCHITECTURE.md); this file is
the practical map: where things are, how they connect, and the traps.

## 1. Repository layout

```
src/                     Canonical core (TypeScript, isomorphic)
  data/schema/           Drizzle schema — THE single source of truth (6 files)
  data/seed.ts           Canonical seed (Acme SG / Acme MY)
  data/db.ts             createPgliteDb() | createPostgresDb(url)
  data/repo.ts           Query helpers (listCompanies, getEffectiveTaxRate, …)
  modules/inventory/     issueStock / InsufficientStockError
  modules/sales/         confirmOrder.ts — the cross-module transaction
  demo.ts                Proof script: asserts invariants, exit≠0 on failure
drizzle/                 Generated migrations (0000_init.sql) + meta
web/                     Frontend (Vite wrapper around a static app)
  index.html             App shell; loads ~60 classic <script> tags
  public/assets/         app.js (hash router), ui.js (SCREENS registry),
                         erp-system-data-adapter.js (demo mode: PGlite boot + reads +
                         confirmOrder mirror), erp-system-api-adapter.js (api mode:
                         health-checks + "waiting for API" screen until TASK-011 exists),
                         data-*.js (mock data), screens-*.js (~50 screen modules)
  public/db/             Hand-copied SQL: erp-system-schema/seed/demo-txn/demo-drafts
  public/sw.js, manifest.webmanifest, pwa.js
deploy/erp-server.mjs    Placeholder "Live" page — NOT the production API
tasks/tasks.jsonl        Work queue (one JSON task per line)
docs/                    This documentation suite
```

## 2. Frontend design (current, deliberate)

- **No framework.** Vanilla JS, ES5-ish, loaded as classic scripts. Vite is used only
  to bundle/copy `public/` to `dist/` and set the Pages base path. Do not introduce
  React/Vue piecemeal; a framework migration is a roadmap decision, not a task.
- **Routing:** hash router in `app.js` (`navigate()`); routes come from `DB.nav`
  (`data-core.js`). A screen = an entry in the global `SCREENS` registry
  (`SCREENS['route-name'] = () => html`), registered by each `screens-*.js` file.
- **Data flow:** screens read from the global `DB` object. The adapter
  (`erp-system-data-adapter.js`) boots PGlite, runs the SQL in `web/public/db/`, then
  maps query results onto `DB.*` (e.g. `DB.movements`, `DB.journalDocs`,
  `DB.erpSystem`). Mock modules still read static `data-*.js` payloads.
- **Writes:** UI actions call `ErpSystemDemo.*` (e.g. `confirmOrder(docNo)`), which run
  a single PGlite transaction and then `refresh()` re-reads everything so all screens
  update.
- **Adding a screen (golden path):**
  1. Add nav entry in `data-core.js` (if new route).
  2. Create/extend a `screens-<module>.js` registering `SCREENS['<route>']`.
  3. Read data from `DB.*`; if the data isn't there yet, extend the adapter's read
     phase to populate it from PGlite.
  4. Add the `<script>` tag to `web/index.html` (order matters: data → adapter →
     screens → app).
  5. Verify desktop + 375 px, zero console errors; run `npm run build:demo`.

## 3. Data layer design

- **Two runtimes, one schema.** `src/data/db.ts` returns a Drizzle instance backed by
  PGlite (demo/tests) or node-postgres (production). `src/demo.ts` proves both paths.
- **The seam.** Frontend reads/writes go through a data-adapter interface with two
  implementations, both setting `window.ErpSystemDemo` to the same method shape
  (`ready/reset/refresh/confirmOrder/completeSetup/switchCompany/mode/db`) — `demo`
  (`erp-system-data-adapter.js`, PGlite in-browser) and `api`
  (`erp-system-api-adapter.js`, HTTP to the Node API). Selected at build time by
  `VITE_DATA_MODE`, read via `window.erpDataMode()` (set in `web/index.html` from
  Vite's `%VITE_DATA_MODE%` HTML placeholder). Each adapter self-disables (returns
  immediately, touches no globals) when it isn't the active mode, so exactly one sets
  `window.ErpSystemDemo`. **Current reality (TASK-019 done, TASK-011 open):** the api
  adapter has no server to call yet, so it health-checks, finds nothing, and
  `app.js`'s `boot()` shows an honest "waiting for the API" screen instead of
  fabricating dashboard data — this is deliberate, not a stub bug.
- **⚠ Landmine — manual sync:** `web/public/db/erp-system-*.sql` is a hand-copied
  snapshot of `drizzle/0000_init.sql` + `src/data/seed.ts`, and the adapter's
  `confirmOrder` re-implements `src/modules/sales/confirmOrder.ts` in raw SQL.
  **Any schema or business-logic change must be applied in both places** until
  TASK-020 (drift check) or a shared-code build step lands. PRs touching one side
  only must justify why.
- **Persistence:** PGlite database at `idb://erp-system-demo` (IndexedDB).
  localStorage holds small prefs (theme/UI state), never business data. Reset =
  drop IndexedDB database + re-run schema/seed SQL.
- **Fallback:** if the PGlite CDN import fails or exceeds 20 s, the adapter renders a
  static in-file payload so the demo never white-screens.

## 4. Transaction design (the heart of the system)

`confirmOrder` (both implementations) must keep this exact order inside ONE transaction:

1. `SELECT … FOR UPDATE` stock rows (PGlite: same SQL; real concurrency only on PG)
2. Validate quantity — insufficient → throw `InsufficientStockError` → full rollback
3. `UPDATE stock_level` (deduct) + `INSERT stock_movement`
4. `UPDATE sales_order.status = 'confirmed'`
5. `INSERT invoice`
6. `INSERT gl_entry` legs — must balance (AR debit = revenue + tax credits)

Seed ships SO-2 (confirmable) and SO-3 (intentionally over stock) to demo both paths.
`src/demo.ts` additionally runs a true-concurrency over-sell race when pointed at
PostgreSQL — exactly one writer may win.

## 5. Production design (target — EPIC-005)

```
[browser] ──static──> web (nginx or static host, same web/dist bundle)
    │ fetch /api/*
    ▼
   api (Node, Drizzle + pg, runs src/modules/* server-side)
    │ DATABASE_URL
    ▼
   db (PostgreSQL 16+, drizzle migrations, RLS as defense-in-depth)
```

- API is the only writer for stock/money. Session (cookie) carries tenant scope.
- **`docker-compose.yml` + `Dockerfile.api` + `web/Dockerfile` + `web/nginx.conf`**
  (TASK-012) implement the diagram above for real: `db` = `postgres:16-alpine`,
  `api` = `Dockerfile.api` (repo-root context — no separate `api/` workspace, ships
  devDependencies since `tsx`/`drizzle-kit` run untranspiled), `web` = multi-stage
  (`node:20-alpine` builds `VITE_DATA_MODE=api` → `nginx:alpine` serves it, reverse-
  proxying `/health` and `/api/*` to `api` over the Compose network — this is *why*
  `erp-system-api-adapter.js`'s `API_BASE` defaults to a relative `/api`: same-origin,
  zero CORS). Host ports default to the documented 8080/3000/5432 but are overridable
  (`WEB_PORT`/`API_PORT`/`DB_PORT`) for machines where those are already taken.
  `Makefile`/`scripts/setup.sh` targets were written to match this shape and every
  underlying `docker compose` command has been verified — `scripts/setup.sh` itself
  is the one remaining unverified piece (TASK-021, blocked on `.env.example` sandbox
  access in this environment, not a known bug).
- **`src/server.ts`** (TASK-011) is the real API — run with `DATABASE_URL=... npm run
  server` locally, or as the `api` service in Docker. Currently `GET /health` +
  `GET /api/dashboard` only; write endpoints are a follow-up (contract already
  defined client-side in `erp-system-api-adapter.js`).
- **Local Postgres for manual testing** (no Docker required yet): `createdb
  erp_system_dev` against any local PostgreSQL 16+, then
  `DATABASE_URL=postgresql://<user>@localhost:5432/erp_system_dev npm run migrate`
  (requires `drizzle.config.ts`'s `dbCredentials.url`, fixed in TASK-011 — it was
  missing entirely before), then `POSTGRES_URL=<same URL> npm run demo` to seed +
  prove all invariants against real Postgres (including true concurrency). Never
  point either at a database you didn't create for this purpose.
- Deployment tuning and backup strategy → [DEPLOYMENT.md](DEPLOYMENT.md),
  [IMPORT_EXPORT.md](IMPORT_EXPORT.md).

## 6. Design decisions log

| Decision | Why | Ref |
| --- | --- | --- |
| PGlite over Dexie/localStorage for demo data | Real Postgres SQL in browser → zero dialect drift with production | ARCHITECTURE.md |
| Vanilla JS + SCREENS registry (no framework) | Prototype velocity; framework migration deferred until module set stabilizes | FRONTEND_PLAN.md |
| `master_fn` → `company_fn` → `user_id` tenancy, app-level scoping + optional RLS | Shared schema multi-tenant, SG+MY from one deploy | MULTI_TENANCY.md |
| Tax as effective-dated rules table | SG GST vs MY SST divergence without code branches | LOCALIZATION.md |
| BYOK AI keys, never build-time vars | Demo is a public static bundle — any bundled key leaks | AI_PROVIDERS.md |
| `web/dist/` gitignored, built by CI | Reproducible from source; no drift between repo and deploy | STATUS.md debt #3 |

## 7. Testing design

- Today: `npm run demo` is the only automated gate (invariant assertions, exit code).
- Target: vitest unit tests for `src/modules/*` + repo helpers (TASK-025), a browser
  smoke script over every registered route (TASK-015), PG parity in CI (TASK-013/014).
- Rule: any bug fixed in business logic gets an assertion in `src/demo.ts` or a unit
  test in the same PR.
