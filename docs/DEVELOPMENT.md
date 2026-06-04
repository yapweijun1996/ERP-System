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
| `npm run build:demo` | `VITE_DATA_MODE=demo` → static `dist/` (PGlite) |
| `npm run build` | `VITE_DATA_MODE=api` → `dist/` for the Docker `web` image |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run migrate` | Apply Drizzle migrations to PostgreSQL (production mode) |
| `npm run generate` | Generate a Drizzle migration from schema changes |
| `npm run seed` | Seed sample data (demo dataset) |
| `npm test` | Run the test suite |
| `npm run lint` | Lint |

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
api/               # Node + Express server (production mode only)
drizzle/           # generated migrations
db/init/           # Postgres init scripts (run once on first boot)
docs/              # this documentation
```

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
- For large-table queries, run the [SCALABILITY checklist](SCALABILITY.md#10-checklist-before-any-large-table-feature-ships).
- Production transaction flows tested against Dockerized PostgreSQL, not just the demo.

## 8. Conventions

- Money is `numeric`, never `float`.
- All timestamps `timestamptz`, UTC.
- Every business query filters by `master_fn` + `company_fn` (see [MULTI_TENANCY.md](MULTI_TENANCY.md)).
- No `SELECT *`, no `OFFSET` pagination — see [SCALABILITY.md](SCALABILITY.md#1-the-cardinal-rules-non-negotiable).
- Schema changes go through Drizzle migrations, never hand-edited SQL on a live DB.
