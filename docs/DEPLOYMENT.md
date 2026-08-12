# Deployment

Two release targets are defined from one repo; only the Docker path is currently
an active production deployment:

1. **Demo artifact** → static `web/dist/` → GitHub Pages or another public static host
   when the separate public-demo plan is enabled (no backend).
2. **Production** → Docker Compose (`web` + `api` + PostgreSQL), sized for 100–800 GB.
   Use `docker-compose.production.yml` on a client server so only `web` is exposed.

Current code schema boundary: migration
`0098_pretty_silver_centurion` (99 journal entries, 249 generated
tables). Migrations 0084–0085 add the separate platform support control plane and exact
master/company boundary; migration 0086 adds assignment validity/provenance and
assignment-owned scope rows with a compatibility backfill; migration 0087 adds
tenant-scoped reasoned user permission overrides and explicit deny precedence;
migration 0088 adds the company-scoped `authorization_version` freshness source; and
migration 0089 adds the explicit, immutable company-scoped Company Owner role and
legacy Superadmin assignment cutover. Migrations 0090–0093 add the Company Receipt
aggregate, evidence/Pack rules and read grants; migrations 0094–0096 add platform-owned
module entitlement, tenant-MAC retirement and the independent Platform Superadmin realm;
migration 0097 adds canonical Company Receipt mutation grants; migration 0098 adds the
durable Master Admin identity, platform idempotency and existing-Superadmin tenant
provisioning permission backfill. Application-only release does not apply migrations
automatically. The target production deployment was advanced through 0098 on 2026-08-12
and production RLS was re-applied before the authorized reset. Production RLS includes the
override/company tables; the application central evaluator remains authoritative for
decision semantics.

Current TASK-175 evidence (2026-08-10): a disposable PostgreSQL 16 database passed
`POSTGRES_URL=... npm run demo` (cross-engine parity and exactly-one-winner stock
concurrency) and `npm run test:postgres` (non-superuser RLS/security integration). The
temporary database was removed after verification. The target database was backed up
to `output/production-backup-20260810/erp-before-0089.dump`, migrations 0084–0089 were
applied with `CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh`, production RLS was
re-applied, and `./deploy/release.sh` completed through the existing Cloudflare tunnel.
Post-release verification confirmed 90 journal entries, 219 forced-RLS tenant
tables/policies, zero active Superadmin flags/assignments, healthy Compose services,
public `/health` 200, public root 200 and unauthenticated session 401.

Before a release, the current authorization/schema gates are:

```bash
npm run check:permissions
npm run check:demo-schema
npm run check:drift
npm run typecheck && npm run typecheck:web && npm run lint
npx vitest run src/api/permissionMatrix.integration.test.ts
npm run audit:access-matrix
```

The access-matrix checks are regression evidence for the current route/module/permission
catalog. TASK-174 completes authorization-version invalidation: browser API requests
carry the active Company version, stale snapshots fail closed with
`authorization_state_stale` and recover only through the session endpoint, while server
permission, scope and workflow decisions remain current-row evaluations. Unknown
business-module keys fail closed; authenticated `account/*` services are explicitly
non-module-gated but still permission-protected. `./deploy/release.sh` is application-only;
`CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh` is the separate, reviewed schema-change
operation. After the purchase-requisition adapter was aligned, serial `npm run build:demo`,
`npm run audit:access-matrix`, full Vitest, full i18n and desktop/mobile smoke pass.
These repository gates and the deployment evidence above are separate from the remaining
TASK-017 physical-device acceptance.

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
        VITE_PLATFORM_DEMO_AUTOFILL: ${VITE_PLATFORM_DEMO_AUTOFILL:-false}
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

Migrations through **0098** are additive schema changes for appointment automation,
the platform support control plane, assignment-scoped authorization and reasoned
user-level permission overrides, Company Receipts, platform entitlement and first-run
Platform provisioning. Apply all committed migrations explicitly before the application release,
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

### EPIC-065 first-run release and authorized reset runbook

The order below is mandatory for the current release and is intentionally separate from
`make reset` (which is too broad for production):

1. Build/test/commit the scoped implementation, push the branch and wait for CI.
2. Create a fresh pre-deploy backup, apply migrations through 0098 with
   `CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh`, re-apply
   `deploy/sql/production-rls.sql`, and run the application release. Verify existing
   records remain usable, `/health` is 200 and public Platform bootstrap is rejected on
   the non-empty database.
3. Before deleting anything, create a UTC-timestamped PostgreSQL custom-format dump and
   document-storage tar archive. Validate `pg_restore --list` and perform one isolated
   restore rehearsal; retain the earlier `pre-reset-20260812T000401Z` backup as an
   additional recovery point.
4. Stop the ERP Compose stack and inspect Docker project labels/volume mounts. Delete
   **only** `erp-system_pgdata` and `erp-system_document_storage`; never run a broad
   volume prune. Recreate services, apply all migrations and production RLS, and do not
   run seed.
5. Verify the tables are empty but schema/RLS are intact, document storage is empty,
   `/health` and the public root are 200, `/api/setup/status` reports
   `requiresPlatformBootstrap: true`, and the page shows Create Platform Superadmin.
   Stop there: do not create the real account on the user's behalf.

The reset is destructive and recoverable only through the validated backups. The public
bootstrap's first-caller takeover window is accepted until the operator completes the
first registration. Platform Superadmin remains password-only/no-MFA for v1; TASK-193
email reset is blocked while `SMTP_HOST` is empty.

### TASK-192 completion evidence (2026-08-12 UTC)

The existing stack was migrated/released first and verified with migration journal 99,
Master 1, Company 1, app users 3, employees 18, audit rows 207, health/root 200,
legacy setup `410 legacy_setup_disabled` and non-empty public bootstrap
`409 already_initialized`. Restore points are
`output/pre-deploy-20260812T064439Z` and `output/post-deploy-20260812T065602Z`;
the latter has a PostgreSQL custom dump, 2,867-line `pg_restore --list`, document-storage
archive and isolated PostgreSQL restore counts Master 1 / Company 1 / app users 3. The
earlier `output/pre-reset-20260812T000401Z` recovery point remains retained.

Compose was stopped, labels were rechecked, and only `erp-system_pgdata` and
`erp-system_document_storage` were removed. The recreated stack ran migrations and
production RLS without seed. Final proof: 249 public tables, 221 forced-RLS tables,
zero non-migration rows, zero document-storage entries, healthy services, local/public
health and root 200, and setup status
`requiresPlatformBootstrap:true, hasPlatformAdmin:false, hasMaster:false,
hasCompany:false, hasTenantAdmin:false`. Desktop and 375px public browser checks had no
console errors or overflow and showed Create Platform Superadmin. No real account was
created. Source CI run `31570902479` passed all four Vitest shards; the later docs-only
push run `31573438483` was blocked before any job started by the same GitHub Actions
account-billing limitation, so neither run is represented as a full CI gate pass.

### Platform Demo quick-setup application release (2026-08-12 UTC)

Commit `4d1b7d7` was pushed to `main` and released with `./deploy/release.sh`. The release
rebuilt/restarted only `api`, `web` and `calendar-worker`; it did not migrate, seed, clear
PostgreSQL or touch document storage. Compose/local and public checks returned health 200,
and the served HTML contains `__ERP_PLATFORM_DEMO_AUTOFILL__='true'` plus the versioned
quick-setup assets. The live setup status is source-verified as
`hasPlatformAdmin:true`, `hasMaster:true`, `hasCompany:false`, `hasTenantAdmin:false` and
`requiresPlatformBootstrap:false`, so the demo opens in the existing-Master/no-Company
continuation stage. The public sample credentials remain Demo-only and must be disabled
(`VITE_PLATFORM_DEMO_AUTOFILL=false`) before any real customer release.

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

The repository includes `.github/workflows/deploy-pages.yml` as a reproducible Pages
workflow, but it is intentionally disabled for this private repository. The current
release artifact is `web/dist/`; public showcase hosting is planned for a separate
public demo repository.

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

### CI/CD — Pages workflow (currently disabled)

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

If this repository is later made public or the public-demo plan changes, GitHub setup is:

1. Push the workflow to `main`.
2. Open repository **Settings → Pages**.
3. Set **Build and deployment → Source** to **GitHub Actions**.
4. Run the workflow or push to `main`.

No PAT is required for same-repository Pages deployment. This is not a current release
claim; verify Pages is enabled before reactivating the workflow.

### Authorization registry CI gate (TASK-171)

Every release must run `npm run check:permissions` before building or deploying. The
gate validates application permission literals, role templates, compatibility mappings,
resource/action metadata and canonical route projections. It currently checks 314
static registry definitions, 116 resources, 62 actions and 5 update contracts. This
gate complements, but does not replace, the completed database cutover and browser
authorization-version invalidation paths or the operational platform-identity bootstrap.
All committed migrations through 0098 must be applied before a release; migration 0088
provides the freshness marker, 0089 makes the legacy Superadmin flag inert, and 0094–0098
provide the platform-entitlement, canonical Company Receipt and Platform provisioning
contracts.

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
| `VITE_PLATFORM_DEMO_AUTOFILL` | web build | `true` only for the explicitly hosted API demo; keep `false` for real customers |
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
- first-run production setup shows Platform Superadmin registration on a truly empty
  database, then Platform workspace creates the Master, Company, Master Admin and
  Company Owner with tax rules and base chart of accounts; the retired anonymous tenant
  setup endpoint returns 410.
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

Do not deploy only the application containers when committed migrations through 0098 have
not been applied; the source code cannot safely invent missing tables at runtime.
