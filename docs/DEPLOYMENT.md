# Deployment

Two independent deploy targets from one repo:

1. **Demo** → static `dist/` → GitHub Pages (public showcase, no backend).
2. **Production** → Docker Compose (`web` + `api` + PostgreSQL), sized for 100–800 GB.

---

## 1. Production — Docker Compose

### Services

```yaml
# docker-compose.yml (reference shape — see repo root for the real file)
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: erp
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d   # runs ONCE on empty volume
    ports: ["5432:5432"]
    shm_size: "1gb"                              # large joins/sorts need shared memory

  api:
    build: ./api
    environment:
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@db:5432/erp
    depends_on: [db]
    ports: ["3000:3000"]

  web:
    build:
      context: .
      args:
        VITE_DATA_MODE: api
    ports: ["8080:80"]
    depends_on: [api]

volumes:
  pgdata:
```

### First-run setup — ONE command

```bash
make setup        # creates .env, starts services, waits for DB, migrates, seeds
```

`make setup` runs [`scripts/setup.sh`](../scripts/setup.sh), which is idempotent (safe to
re-run) and prints the app/API/DB URLs when done. That is the entire onboarding — no
manual multi-step sequence. `make help` lists every target (`up`, `down`, `logs`,
`migrate`, `seed`, `reset`, `psql`, …).

<details>
<summary>What <code>make setup</code> does under the hood (manual equivalent)</summary>

```bash
cp .env.example .env                       # only if missing
docker compose up -d                       # db + api + web
# wait until pg_isready, then:
docker compose exec api npm run migrate    # apply Drizzle migrations
docker compose exec api npm run seed       # SG + MY demo data
```
</details>

> ⚠️ **Init scripts only run once.** Anything in `/docker-entrypoint-initdb.d/` runs
> **only on the first boot with an empty `pgdata` volume**. To re-seed, use `make reset`
> (wipes the volume and re-runs setup) or `make seed`. Don't expect the init script to
> re-run on an existing volume.

### Auto-creating the database

PostgreSQL's official image auto-creates the database named by `POSTGRES_DB` on first
boot, then runs every `*.sql` / `*.sh` in `/docker-entrypoint-initdb.d/` in alphabetical
order. Put extension setup and base roles there:

```sql
-- db/init/00-extensions.sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- CREATE EXTENSION IF NOT EXISTS pg_partman;   -- if used for partition management
```

Schema itself is applied by Drizzle migrations (`npm run migrate`), not the init script,
so demo and production stay in lockstep.

### Production-only RLS migration

Row Level Security is **not** part of the shared schema (it would be bypassed in the
PGlite demo — see [MULTI_TENANCY.md](MULTI_TENANCY.md#3-isolation-model--app-level-first-rls-as-prod-defense-in-depth)).
Apply it as a **production-only** step after the shared migrations:

```bash
docker compose exec api npm run migrate:prod-rls   # enables + FORCEs RLS policies
```

This keeps tenant isolation enforced at the database level in production without breaking
the "identical shared schema both modes" invariant.

---

## 2. PostgreSQL tuning (100–800 GB)

Set in `postgresql.conf` or via Compose `command:` flags. Starting points for a server
with, say, 32 GB RAM (tune to the actual host):

| Setting | Guidance |
| --- | --- |
| `shared_buffers` | ~25% of RAM |
| `effective_cache_size` | ~50–75% of RAM |
| `work_mem` | Per-sort; modest globally, raised per-session for heavy reports |
| `maintenance_work_mem` | High (1–2 GB) — speeds index builds / vacuum on big tables |
| `max_connections` | Keep modest; use **PgBouncer** for concurrency |
| `autovacuum_*` | Tuned aggressively for big tables — see [SCALABILITY.md](SCALABILITY.md#6-vacuum--bloat-management) |
| `wal_compression` | `on` — reduces WAL volume at scale |

Connection pooling (PgBouncer) and read replicas are described in
[SCALABILITY.md](SCALABILITY.md#5-connection-pooling).

---

## 3. Backups at scale — see IMPORT_EXPORT.md

At 800 GB, `pg_dump` through the app is **not** a backup strategy. Use physical backups
(`pg_basebackup` / snapshots) + WAL archiving for point-in-time recovery. Full detail in
[IMPORT_EXPORT.md](IMPORT_EXPORT.md#b-admin-level-database-backup--restore).

---

## 4. Demo — GitHub Pages

### Build

```bash
npm run build:demo            # VITE_DATA_MODE=demo → dist/
```

### Vite config requirements (Pages-specific)

```ts
// vite.config.ts
export default defineConfig({
  base: '/<target-repo-name>/',   // REQUIRED or all assets 404 on Pages
  // ...
})
```

- **Base path:** GitHub Pages serves from `https://user.github.io/<repo>/`. Without the
  correct `base`, every asset 404s.
- **Client-side routing fallback:** Pages has no server rewrite. Add a `404.html` that
  loads the app (SPA fallback), or use hash routing, or deep links break.
- **SPA fallback file:** copy `dist/index.html` to `dist/404.html` in the build step.

### CI/CD — deploy to a *different* public repo

The demo is pushed to a separate public project for hosting.

```yaml
# .github/workflows/deploy-demo.yml (reference shape)
name: Deploy Demo
on:
  push: { branches: [main] }
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build:demo
      - run: cp dist/index.html dist/404.html      # SPA fallback
      - name: Push to public Pages repo
        uses: peaceiris/actions-gh-pages@v4
        with:
          personal_token: ${{ secrets.DEPLOY_PAT }}   # PAT, NOT GITHUB_TOKEN
          external_repository: <user>/<public-demo-repo>
          publish_branch: gh-pages
          publish_dir: ./dist
```

> ⚠️ **Cross-repo deploy needs a PAT.** The default `GITHUB_TOKEN` can only write to the
> repo running the workflow. Pushing `dist/` to *another* public repo requires a Personal
> Access Token (or deploy key) with write access to that target repo, stored as a secret
> (`DEPLOY_PAT`).

---

## 5. Environment summary

| Variable | Mode | Purpose |
| --- | --- | --- |
| `VITE_DATA_MODE` | both | `demo` (PGlite) or `api` (Node+Postgres) |
| `DATABASE_URL` | production | Postgres connection string |
| `DB_USER` / `DB_PASSWORD` | production | Compose DB credentials |
| `DEPLOY_PAT` | CI | token to push demo to the public Pages repo |

Never commit `.env`. See `.env.example`.
