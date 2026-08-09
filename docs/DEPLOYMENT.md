# Deployment

Two independent deploy targets from one repo:

1. **Demo** → static `web/dist/` → GitHub Pages (public showcase, no backend).
2. **Production** → Docker Compose (`web` + `api` + PostgreSQL), sized for 100–800 GB.
   Use `docker-compose.production.yml` on a client server so only `web` is exposed.

Current schema boundary: migration
`0085_support_grant_company_boundary` (86 journal entries, 242 generated tables).
Migrations 0084–0085 add the separate platform support control plane and exact
master/company boundary. Application-only release does not apply migrations
automatically.

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

This shape is a target contract. The repository must include real Docker assets before
production is considered supported:

- `docker-compose.yml`
- `docker-compose.production.yml` (private DB/API production overlay)
- API Dockerfile
- web Dockerfile or static web image build
- Postgres volume and init directory
- health checks for `web`, `api`, and `db`
- an always-on `calendar-worker` for appointment reminders and optional one-way calendar delivery
- separate application-release and migration scripts

### First-run setup — ONE command

```bash
make setup             # local: creates .env, starts services, waits for DB, migrates
make setup-production  # client server: same first install, only web is published
```

`make setup` runs [`scripts/setup.sh`](../scripts/setup.sh), which is idempotent (safe to
re-run), creates the schema and prints the app/API/DB URLs when done. It does **not** load
demo rows by default. `make help` lists every target (`up`, `down`, `release`, `logs`,
`migrate`, `seed`, `reset`, `psql`, …).

<details>
<summary>What <code>make setup</code> does under the hood (manual equivalent)</summary>

```bash
cp .env.example .env                       # only if missing
docker compose up -d                       # db + api + web
# wait until pg_isready, then:
docker compose exec api npm run migrate    # apply Drizzle migrations
# optional, disposable local demo only:
docker compose exec -e ERP_ENV=demo -e ERP_DEMO_SEED=I_UNDERSTAND_DEMO_DATA api npm run seed
```
</details>

> ⚠️ **Init scripts only run once.** Anything in `/docker-entrypoint-initdb.d/` runs
> **only on the first boot with an empty `pgdata` volume**. For intentional demo data,
> use `make seed` against a disposable database. `make reset` wipes the volume and is
> destructive; it is not a production update mechanism.

### Connecting to an already-provisioned external database

```bash
make setup-interactive     # scripts/setup.sh --interactive
# For a client server, use the hardened overlay from the first boot:
make setup-production      # scripts/setup.sh --production --interactive
```

By default `make setup` provisions the bundled `db` container for local use. If you
already run a managed PostgreSQL instance (RDS, Cloud SQL, Supabase, a shared on-prem
server, …), `make setup-production` walks through it instead of hand-editing `.env`
and keeps the API private on the Compose network. `make setup-interactive` is the
convenient local/base-Compose variant:

1. Choose **[2] already-provisioned external database** and paste its
   `postgres://user:pass@host:port/db` connection string (validated by prefix before
   continuing).
2. Answer (or leave blank to auto-generate) `ERP_TOKEN_ENCRYPTION_KEY` /
   `ERP_PUBLIC_URL`, same as the bundled path. The first-run web setup is tokenless
   when the database has no tenant data.
3. The script never starts or waits on the bundled `db` service
   (`docker compose up -d api web --no-deps`) and proves readiness by retrying
   `docker compose exec -T api npm run migrate` directly against your database instead
   of `pg_isready` against a container that was never started.

This first-install path intentionally applies the committed migrations to the selected
database. Take a backup and use a staging copy first when the external database already
contains client data. It is not the command to use for routine source-code releases.

This only takes effect the first time — once `.env` exists, `make setup`,
`make setup-interactive`, and `make setup-production` leave it untouched. To switch an
*existing* deployment onto an external database later, edit `.env`'s `DATABASE_URL` by
hand (see the comment above it in `.env.example`) and use the production overlay when
starting the application containers.

### Updating source code without replacing the database

The normal client-server release is application-only:

```bash
make release                 # rebuild/restart web + api + calendar-worker; no migration, no seed
# or: ./deploy/release.sh
```

The production overlay keeps PostgreSQL and the document-storage volume in place and
removes the DB/API host ports. The release script never calls `docker compose down -v`,
never runs `npm run migrate`, and never runs the seed. A source-only change therefore
does not alter existing rows or schema. Keep `COMPOSE_PROJECT_NAME=erp-system` stable in
`.env` so the named volume namespace remains stable even if the checkout path changes.

The `calendar-worker` is part of the application release and does not own the database
schema. It always processes durable Staff Calendar reminders; external delivery is
enabled only when `CALENDAR_OUTBOUND_URL` is configured. `CALENDAR_OUTBOUND_TOKEN` and
`CALENDAR_OUTBOUND_TIMEOUT_MS` stay server-side. HR Staff Calendar connection records
contain only a provider label and calendar reference; connector credentials are
deployment-managed and are never returned to the browser. Appointment recurrence and
reminder jobs are bounded to a 93-day look-ahead and are safe to retry by their unique
tenant-scoped event keys.

Migrations 0083–0085 are additive schema changes for appointment automation and the
platform support control plane. Apply them explicitly before the application release,
then re-apply the production-only RLS script so the calendar worker receives only its
allow-listed queue/source tables and the API database role keeps platform/security
tables behind its separately restricted service boundary:

```bash
CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh
docker compose -f docker-compose.yml -f docker-compose.production.yml \
  exec -T db sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < deploy/sql/production-rls.sql
./deploy/release.sh
```

This sequence does not delete or reseed existing employee, leave or appointment data.

Do not promise that every future feature can avoid database work: code that requires a
new table/column needs a schema migration. Use an expand/contract release:

1. Back up the client database and test the migration against a staging copy.
2. Make the migration backward-compatible (add nullable/table/index first; do not drop or
   rename data in the same release).
3. Apply it only when explicitly approved:
   `CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh`.
4. Run `make release` with code that supports the old and new shape, then backfill or
   remove legacy columns in a later reviewed release.

`deploy/migrate.sh` is the only deployment entry point that changes database schema. It
does not create backups because an 800 GB PostgreSQL backup should use the client's
physical backup/WAL/PITR tooling, not an application container.

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
psql "$DATABASE_URL" -f deploy/sql/production-rls.sql   # enables + FORCEs RLS policies
```

This keeps tenant isolation enforced at the database level in production without breaking
the "identical shared schema both modes" invariant.

### Optional single-node document filesystem

Document content uses PostgreSQL `bytea` by default and needs no extra configuration.
For a deliberately single-node deployment, set
`DOCUMENT_STORAGE_FS_ROOT=/var/lib/erp-documents`. The bundled Compose stack mounts
the named `document_storage` volume there for both API and worker services. Back up
that volume together with PostgreSQL: the files contain only content, while PostgreSQL
remains authoritative for tenant ownership, version, SHA-256, MIME, size, retention,
legal hold and the opaque relative locator. Do not enable this backend behind multiple
API/worker nodes unless the path is replaced by shared durable storage in a future
provider.

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
npm run build:demo            # VITE_DATA_MODE=demo → web/dist/
```

The GitHub Pages demo is static only. It must not require Docker, the API container,
PostgreSQL, or any private environment variable.
It also includes the PWA shell (`manifest.webmanifest`, `sw.js`, icons, safe-area CSS,
and update prompt). See [PWA.md](PWA.md).

The repository includes `.github/workflows/deploy-pages.yml`, which builds the demo and
deploys `web/dist` to GitHub Pages on every push to `main` and on manual
`workflow_dispatch`.

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
- **SPA fallback file:** copy `web/dist/index.html` to `web/dist/404.html` in the build
  step.

### CI/CD — deploy to this repo's GitHub Pages

For the normal same-repository Pages deploy, use the checked-in workflow:

```yaml
# .github/workflows/deploy-pages.yml
permissions:
  contents: read
  pages: write
  id-token: write
```

It uses GitHub's official Pages actions:

- `actions/configure-pages`
- `actions/upload-pages-artifact`
- `actions/deploy-pages`

GitHub setup:

1. Push the workflow to `main`.
2. Open repository **Settings → Pages**.
3. Set **Build and deployment → Source** to **GitHub Actions**.
4. Run the workflow or push to `main`.

No PAT is required for same-repository Pages deployment.

### Authorization registry CI gate (TASK-171)

Every release must run `npm run check:permissions` before building or deploying. The
gate validates application permission literals, role templates, compatibility mappings,
resource/action metadata and canonical route projections. It currently checks 299
static registry definitions, 116 resources, 62 actions and 5 update contracts. This
gate does not replace the later database expand/cutover, authorization-version cache or
production platform identity bootstrap.

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
      - run: npm ci --prefix web
      - run: npm run build:demo
      - run: cp web/dist/index.html web/dist/404.html      # SPA fallback
      - name: Push to public Pages repo
        uses: peaceiris/actions-gh-pages@v4
        with:
          personal_token: ${{ secrets.DEPLOY_PAT }}   # PAT, NOT GITHUB_TOKEN
          external_repository: <user>/<public-demo-repo>
          publish_branch: gh-pages
          publish_dir: ./web/dist
```

> ⚠️ **Cross-repo deploy needs a PAT.** The default `GITHUB_TOKEN` can only write to the
> repo running the workflow. Pushing `web/dist/` to *another* public repo requires a
> Personal Access Token (or deploy key) with write access to that target repo, stored as
> a secret (`DEPLOY_PAT`).

---

## 5. Environment summary

| Variable | Mode | Purpose |
| --- | --- | --- |
| `VITE_DATA_MODE` | both | `demo` (PGlite) or `api` (Node+Postgres) |
| `DATABASE_URL` | production | Postgres connection string |
| `DB_USER` / `DB_PASSWORD` | production | Compose DB credentials |
| `COMPOSE_PROJECT_NAME` | production | Stable namespace for named volumes |
| `DEPLOY_PAT` | CI | token to push demo to the public Pages repo |

Never commit `.env`. See `.env.example`.

## 6. Deployment readiness checklist

Demo is ready when:

- GitHub Actions can build the frontend and publish `web/dist`.
- the published page boots with PGlite and seed data.
- refresh/deep-link behavior works on GitHub Pages.
- no production credentials or customer data are bundled.

Production is ready when:

- `docker compose up -d` starts `web`, `api`, and `db`.
- `make release` replaces only application containers and passes the `/health` readiness
  check, including a real `SELECT 1` against PostgreSQL.
- API migrations apply successfully against PostgreSQL.
- first-run setup wizard can create the initial master, company, admin user, tax rules,
  and base chart of accounts.
- stock and finance writes run through the API, not directly from the browser.
- PostgreSQL transaction/concurrency tests pass, including no stock over-sell.

## Staff Calendar worker deployment

Migration 0083 adds durable appointment reminder and outbound calendar queues. After
backup and staging proof, production deployment must:

1. run the explicit guarded migration command;
2. re-apply the production RLS script so the new tables and narrow calendar-worker
   policies are present;
3. deploy/restart the API and resident calendar worker;
4. verify health and one idempotent reminder/outbound retry path;
5. confirm the worker cannot read unrelated tenant business tables.

Do not deploy only the application containers when migrations 0083–0085 have not been applied;
the source code cannot safely invent missing tables at runtime.
