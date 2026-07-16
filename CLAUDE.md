# CLAUDE.md — AI agent guide for ERP-System

Dual-mode multi-tenant ERP: **demo** = static site, PGlite (Postgres-in-WASM) persisted
to IndexedDB; **production** = Docker `web`+`api`+PostgreSQL. One schema, one migration
set, one business-logic contract across both.

## Read in this order (5 minutes)

1. [docs/STATUS.md](docs/STATUS.md) — what is real vs mock vs documented-only. **Trust
   this over any other doc when they disagree.**
2. [docs/MVP.md](docs/MVP.md) — scope gates (MVP-1 browser demo → MVP-2 Docker).
3. [docs/SPEC.md](docs/SPEC.md) — binding invariants (transactions, tenancy, tax, BYOK).
4. [docs/DESIGN.md](docs/DESIGN.md) — file map, golden paths, landmines.
5. `tasks/tasks.jsonl` — pick work from here.

## Task workflow (mandatory)

- Pick the lowest-numbered `todo` task whose `depends_on` are all `done`, matching the
  current roadmap phase ([docs/ROADMAP.md](docs/ROADMAP.md)).
- Set it to `in_progress` (edit its line), do the work, verify every `acceptance`
  item, then set `done` and append what was actually done to its `description`.
- **Never delete or renumber task lines.** New work = new `TASK-NNN` appended at the
  end, linked to an epic in [docs/EPICS.md](docs/EPICS.md).
- One task per commit/PR where practical. Update [docs/STATUS.md](docs/STATUS.md) when
  an epic-level milestone lands.

## Commands

```bash
npm install && npm --prefix web install   # once
npm run typecheck && npm run typecheck:web  # every change
npm run demo          # transaction proof (PGlite; + PostgreSQL if POSTGRES_URL set)
npm run build:demo    # static demo bundle → web/dist/
npm run dev           # vite dev server for web/
npm run generate      # drizzle-kit generate (after schema changes)
```

Definition of done for any change: typechecks pass, `npm run demo` passes,
`npm run build:demo` passes, affected screens verified in browser at desktop AND 375 px
with zero console errors.

## Landmines (violating these breaks the product)

1. **Dual-copy sync:** `web/public/db/erp-system-*.sql` and the adapter's raw-SQL
   `confirmOrder` are hand-mirrored from `drizzle/0000_init.sql` / `src/data/seed.ts` /
   `src/modules/sales/confirmOrder.ts`. Schema or business-logic changes go in **both
   places** in the same commit (until TASK-020 automates the check).
2. **Stock/money writes are one transaction** with full rollback; in production they
   are server-side only. Never post an unbalanced GL entry.
3. **Tenant scoping:** every business query filters `master_fn` (+ `company_fn`);
   values come from session/context, never client input.
4. Frontend is **vanilla JS with a global `SCREENS` registry** — do not introduce a
   framework, module bundler for `public/assets`, or TypeScript there piecemeal.
5. Script tag order in `web/index.html` matters: data → adapter → screens → app.
6. No secrets or provider API keys in the repo or bundle; AI keys are BYOK at runtime,
   never `VITE_`-prefixed.
7. Odoo is studied concept-only (LGPLv3) — never port its code.
8. Demo-only shortcuts (fake auth, mock modules) must be visibly labeled as demo.

## Repo map (short)

- `src/` — canonical core: Drizzle schema (`src/data/schema/`), seed, dual DB factory,
  business modules (`confirmOrder.ts`, `stock.ts`), proof script `demo.ts`.
- `drizzle/` — generated migrations (`0000_init.sql` = current 18-table schema).
- `web/public/assets/` — vanilla-JS frontend (hash router `app.js`, `SCREENS` registry,
  PGlite adapter `erp-system-data-adapter.js`, `screens-*.js`, mock `data-*.js`).
- `web/public/db/` — hand-copied SQL for the browser demo (see landmine #1).
- `tasks/tasks.jsonl` — backlog. `docs/` — full documentation suite.
- `deploy/erp-server.mjs` — placeholder page, NOT the production API.
