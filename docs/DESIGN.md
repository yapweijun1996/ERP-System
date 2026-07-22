# DESIGN — How the system is built

Working-level design notes for whoever (human or AI agent) writes the next line of
code. Architecture rationale lives in [ARCHITECTURE.md](ARCHITECTURE.md); this file is
the practical map: where things are, how they connect, and the traps.

## 1. Repository layout

```
src/                     Canonical core (TypeScript, isomorphic)
  data/schema/           Drizzle schema — THE single source of truth (domain files)
  data/seed.ts           Canonical seed (Acme SG / Acme MY)
  data/db.ts             createPgliteDb() | createPostgresDb(url)
  data/repo.ts           Query helpers (listCompanies, getEffectiveTaxRate, …)
  modules/*/             Shared domain commands (Demo + production API)
  api/                   Resource registry, creates/actions and HTTP routes
  auth/                  Session, CSRF, RBAC, token and audit services
  demo.ts                Proof script: asserts invariants, exit≠0 on failure
drizzle/                 Ordered generated migrations + snapshots/journal
web/                     Frontend (Vite wrapper around a static app)
  index.html             App shell; loads ~60 classic <script> tags
  public/assets/         app.js (hash router), ui.js (SCREENS registry),
                         Demo/API ErpSystemData adapters, data-*.js (Preview only),
                         screens-*.js (~50 screen modules)
  src/                   Bundled Demo ESM runtime for PGlite/Drizzle commands
  public/db/             Generated migration-derived PGlite boot/upgrade SQL
  public/sw.js, manifest.webmanifest, pwa.js
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
- **Data flow:** Canonical screens call the formal `window.ErpSystemData` contract and
  map bounded resource pages into their view models. Demo mode executes against
  browser PGlite; API mode calls the authenticated Express API and never falls back to
  sample data. Preview routes may still read `data-*.js`, but `SCREEN_META` labels them
  `Preview · Sample Data` and locks write-like controls.
- **Writes:** Canonical UI actions use `ErpSystemData.create/update/action`. Demo mode
  invokes bundled TypeScript `*Within` commands against PGlite; API mode invokes the
  same commands through the transactional resource/action dispatcher. `refresh()` or
  a bounded re-query updates the visible screen after success.
- **Adding a screen (golden path):**
  1. Add nav entry in `data-core.js` (if new route).
  2. Create/extend a `screens-<module>.js` registering `SCREENS['<route>']`.
  3. Register the resource/create/action metadata and expose it through both adapters;
     load it with `ErpSystemData` from the screen's async `prepare` function.
  4. Add the `<script>` tag to `web/index.html` (order matters: data → adapter →
     screens → app).
  5. Add five-language copy, set the route Canonical only after Demo/API parity, then
     run the type/test/schema/build/114-route gates and live desktop + 375 px checks.

## 3. Data layer design

- **Two runtimes, one schema.** `src/data/db.ts` returns a Drizzle instance backed by
  PGlite (demo/tests) or node-postgres (production). `src/demo.ts` proves both paths.
- **The seam.** `window.ErpSystemData` exposes
  `list/get/create/update/action/refresh/session/switchCompany/auth`. The demo adapter
  uses the Vite-bundled PGlite/Drizzle runtime; the API adapter uses relative `/api`
  requests. `VITE_DATA_MODE` selects exactly one implementation at build time.
  `window.ErpSystemDemo` remains only as a migration compatibility alias and must not
  be used by newly Canonical screens.
- **Schema synchronization is generated.** `scripts/generate-demo-schema.mjs` derives
  fresh and upgrade SQL from the ordered Drizzle journal. `check:demo-schema` and
  `check:drift` fail CI if the browser bundle or exported tables diverge. Seed data and
  Canonical business writes run the same TypeScript functions in both engines; do not
  add browser-only business SQL.
- **Persistence:** PGlite database at `idb://erp-system-demo` (IndexedDB).
  localStorage holds small prefs (theme/UI state), never business data. Reset =
  drop IndexedDB database + re-run schema/seed SQL.
- **Failure behavior:** Canonical routes show a retryable error state when their active
  adapter fails. Only routes explicitly marked Preview may render sample data.

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

Every other state-changing command follows the same boundary: validate tenant and
state, lock the authoritative rows when races matter, append immutable facts (stock,
GL, audit/outbox), update projections/status, and commit once. The action dispatcher
adds permission, optimistic-version, idempotency and audit handling around that same
transaction. Purchasing sourcing is intentionally pre-accounting: RFQ issue, supplier
quote receipt and quote award create no stock or GL entries; award atomically creates
one linked pending-approval PO, marks the winner converted, rejects competitors and
closes the RFQ.
Every newly-created PO now starts `pending_approval` with exactly one
`purchase_order_approval` row. An authorised approve/reject decision locks both rows,
requires an auditable note, snapshots the deciding user, increments versions and changes
only the document/approval states. Approval is deliberately stock- and GL-neutral;
`receiveGoods` accepts only an approved/open PO, so inventory begins at receipt and
accounting begins at supplier-invoice posting.

Direct and quotation-converted sales orders follow the symmetric commercial gate. Order
creation validates tenant-owned customers/products, snapshots the effective tax on every
line and inserts exactly one `sales_order_approval` row in the same transaction. Orders
remain `pending_approval` until an authorised actor records a required note. Approval
changes the order to `draft`; rejection changes it to `rejected`. Neither decision writes
stock, delivery, invoice or GL facts. Only the existing draft confirmation command may
cross the fulfilment/accounting boundary, preserving one authoritative posting path.

## 5. Production design (implemented — EPIC-005 onward)

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
  underlying `docker compose` command and both the normal and interactive setup paths
  have been verified against real bundled and external PostgreSQL deployments.
- **`src/server.ts`** is the real API — run with `DATABASE_URL=... npm run server`
  locally, or as the `api` service in Docker. Besides health/auth/dashboard it
  exposes allowlisted resources plus registered create/action handlers. Reads are
  session-tenant-scoped and keyset-paginated; writes derive tenant scope from the
  database session and run shared commands with RBAC, CSRF, idempotency and audit.
  Remaining Preview business areas still require their own schema and commands before
  they may join this API surface.
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
| Vendor performance is a rebuildable read model, not a scored table | Supplier ratings must reconcile to real orders, receipts, invoices, returns and active contracts; no disconnected KPI can become a sourcing decision | EPIC-034 |
| Purchasing dashboards/reports use bounded derived resources, not KPI tables | Operational totals, approved-buyer spend and document-state reports must change immediately with canonical procure-to-pay facts; supplier-invoice variance stays at honest immutable header level until invoice lines become a domain table | EPIC-035 |
| Sales analytics are rebuilt from commercial documents, not KPI/target tables | Revenue must reconcile posted invoices minus credits plus debits, while customer ownership and document status remain traceable to current canonical facts; unavailable target/forecast data is disclosed rather than fabricated | EPIC-037 |
| Shared sales transaction state stores identifiers, never presentation records | `txn-view` re-reads one tenant-scoped enquiry plus its linked quotation from the formal adapter; document types with dedicated Canonical workspaces are dispatched there instead of retaining a second generic detail model | EPIC-039 |
| Manual journals use immutable header/line facts with separately numbered reversals | A draft has no GL effect; posting appends balanced dated GL legs and freezes the journal; correction swaps debit/credit into a new linked posted journal instead of editing history | EPIC-040 |
| Bank reconciliation links statement facts to GL; it does not auto-book | Imported signed lines must foot from opening to closing and each may match one exact immutable bank-account GL leg. Missing fees or interest first use the real journal workflow; completed statements are locked | EPIC-041 |
| Management BI is a bounded rebuildable cross-module read model | Revenue, receivables, payables, cash and inventory must reconcile to current Canonical facts rather than a KPI table. Product-category revenue only allocates traceable invoice/credit lines, and stock age is disclosed as days since the latest inbound movement because FIFO cost layers are not stored | EPIC-042 |
| Product master creation is stock-neutral | A product record defines identity, units, category, planning values and standard cost only. It must never create an opening balance or write a stock projection directly; initial physical quantity enters through the same auditable movement commands as every later receipt or adjustment | EPIC-043 |
| Project time is an actor-owned append/void fact | The signed-in Session supplies the user identity; entries target an open tenant project and store Decimal hours on a real date. A correction marks the original row void with a reason, preserving its actor, project and hours. Weekly approval, capacity and payroll state remain absent until those domains exist | EPIC-044 |

## 7. Testing design

- Required local gates are root/web typecheck, ESLint, Vitest, `npm run demo`, generated
  schema/drift checks, Demo and API builds, and the 114-route desktop/375px audit.
- CI adds PostgreSQL 16 migration/RLS/integration coverage and the same schema and route
  gates. Stateful browser fixtures ensure detail routes are not skipped for lack of
  context.
- Rule: every business bug or new command gets a same-slice domain/API assertion; every
  route promoted to Canonical must also prove Demo/API loading, five-language UI, write
  behavior and responsive rendering.
