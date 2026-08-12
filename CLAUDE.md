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
npm run lint           # every change — eslint.config.js, 0 errors AND 0 warnings
npm run typecheck && npm run typecheck:web  # every change
npm run demo          # transaction proof (PGlite; + PostgreSQL if POSTGRES_URL set)
npm run build:demo    # static demo bundle → web/dist/
npm run dev           # vite dev server for web/
npm run generate      # drizzle-kit generate (after schema changes)
```

Definition of done for any change: `npm run lint` passes with 0 errors and 0 warnings
(that's the real, maintained baseline — a new warning means either fix it or, if it's a
deliberate exception, add a targeted `eslint-disable-next-line` with a reason, not a
blanket rule downgrade), typechecks pass, `npm run demo` passes, `npm run build:demo`
passes, affected screens
verified in browser at desktop AND 375 px with zero console errors.

## Landmines (violating these breaks the product)

1. **Generated Demo artifacts:** `web/public/db/erp-system-schema.sql` and
   `erp-system-migrations.sql` are generated from `drizzle/*.sql` by
   `npm run generate:demo-schema` (verify with `npm run check:demo-schema`) — run it
   after every `npm run generate` and never hand-edit the artifacts. Canonical commands
   such as sales confirmation now use the bundled TypeScript runtime under `web/src/`;
   do not reintroduce a second raw-SQL implementation of a shared domain command.
2. **Stock/money writes are one transaction** with full rollback; in production they
   are server-side only. Never post an unbalanced GL entry.
3. **Tenant scoping:** every business query filters `master_fn` (+ `company_fn`);
   values come from session/context, never client input.
4. Frontend is **vanilla JS with a global `SCREENS` registry** — do not introduce a
   framework, module bundler for `public/assets`, or TypeScript there piecemeal.
5. Script tag order in `web/index.html` matters: data → adapter → screens → app.
6. No secrets or provider API keys in the repo or bundle. Runtime document-Vision BYOK
   credentials use the encrypted server connector, never a `VITE_` variable; the setup
   wizard's AI field is a non-persisted preview.
7. Odoo is studied concept-only (LGPLv3) — never port its code.
8. Demo-only shortcuts (fake auth, mock modules) must be visibly labeled as demo.

## Repo map (short)

- `src/` — canonical core: API/routes (`src/api/`), authorization (`src/auth/`),
  Drizzle schema (`src/data/schema/`), domain commands (`src/modules/`), workers and
  the PGlite/PostgreSQL proof script `demo.ts`.
- `drizzle/` — append-only generated migrations; `0000_init.sql` is the historical
  initial baseline, while the journal and later migrations define the current schema.
- `web/public/assets/` — vanilla-JS frontend (hash router `app.js`, `SCREENS` registry,
  PGlite/API adapters, `platform-workspace.js`, `screens-*.js` and compatibility data).
- `web/src/` — the bundled browser runtime that exposes shared TypeScript domain and
  reporting commands to the classic-script shell.
- `web/public/db/` — generated schema/migration artifacts and deterministic Demo pack.
- `tasks/tasks.jsonl` — backlog. `docs/` — full documentation suite.
- `src/server.ts` — production API entry point; `deploy/` contains release/RLS helpers.
