# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added (2026-07-16 — TASK-012/013 Docker Compose production stack)
- `docker-compose.yml` (repo root): `db` (`postgres:16-alpine`, named volume,
  `pg_isready` healthcheck), `api` (built from new `Dockerfile.api` — repo-root
  context, ships devDependencies since `tsx`/`drizzle-kit` run untranspiled,
  `DATABASE_URL` wired to `db` by Docker DNS, node-fetch healthcheck), `web`
  (built from new `web/Dockerfile` — multi-stage, `node:20-alpine` builds
  `VITE_DATA_MODE=api` then `nginx:alpine` serves it). Host ports default to the
  documented 8080/3000/5432, overridable via `WEB_PORT`/`API_PORT`/`DB_PORT`.
- `web/nginx.conf`: reverse-proxies `/health` and `/api/*` to the `api` service —
  same-origin, so `erp-system-api-adapter.js`'s relative `/api` default needs no
  CORS.
- `src/seed.ts` + `npm run seed`: standalone, idempotent seed script (guards with
  the existing `isSeeded()` helper) — `Makefile`/`scripts/setup.sh` already called
  this script; it didn't exist until now.
- Fixed a real portability bug this surfaced: `web/vite.config.ts` uses
  `process.env` but `web/package.json` had no `@types/node` and `web/tsconfig.json`
  had no `"node"` in `types` — this only worked locally by accident (parent
  directory's `node_modules` on the resolution path); an isolated Docker build
  context correctly failed until fixed.
- Verified for real (not just typechecked): built both images, started all three
  containers with `WEB_PORT=18080 API_PORT=13000 DB_PORT=15432 docker compose -p
  erp-system-test up -d --build` (avoiding this machine's existing services on
  5432/3000) — `db` and `api` reached `Healthy` before `web` started
  (`depends_on: condition: service_healthy` works). Curl-verified `/health` and
  `/api/dashboard` both directly and through the nginx proxy (identical JSON). Ran
  the exact `Makefile` commands (`docker compose exec api npm run migrate`, `npm
  run seed`, `docker compose exec db psql -U erp -d erp`) — all worked, dashboard
  showed real post-seed data through the full stack. Fully torn down afterward
  (`docker compose down -v --rmi local`); confirmed the machine's 14 pre-existing
  unrelated containers were untouched throughout.
- **TASK-013** (PostgreSQL transaction parity): `POSTGRES_URL=... npm run demo`
  proven against real Postgres, including the true-concurrency race (exactly 1 of
  2 issues wins, final stock never negative) — the same proof from TASK-011's
  verification, confirmed reproducible.
- Not done: `scripts/setup.sh` itself (touches `.env.example`, blocked by this
  sandbox's permission settings) — every `docker compose` command it wraps is
  individually verified, but the script's own run is not (TASK-021). Server-side
  write endpoints (confirm order / setup / company switch) remain open.

### Added (2026-07-16 — TASK-011 scaffold the production API server)
- `src/server.ts` — Express server (`npm run server`), reads `DATABASE_URL` and
  exits with a clear error if unset. `GET /health` returns `{status,service,time}`.
  `GET /api/dashboard?masterFn=&companyFn=` (defaults `M1`/`C-SG`) returns
  `{scope, companies, metrics, stockAlerts, generatedAt}` from five parallel,
  tenant-scoped, explicit-column queries written in `src/demo.ts`'s style.
  `masterFn`/`companyFn` as query params is flagged in-code as scaffold-only —
  must become session-derived scope before any write endpoint ships (TASK-024).
- Fixed `drizzle.config.ts`: it had no `dbCredentials` at all, so `npm run migrate`
  failed outright against any real PostgreSQL. Added `dbCredentials.url` from
  `DATABASE_URL` (`generate` is unaffected — it needs no DB connection).
- Added `express` + `@types/express` (dev) and the `server` npm script.
- Verified for real, not just typechecked: created an isolated local database
  (`erp_system_dev`, without touching the machine's other existing databases), ran
  `npm run migrate` against it, then `POSTGRES_URL=... npm run demo` — **all checks
  passed including true PostgreSQL concurrency** (exactly 1 of 2 racing stock issues
  wins). Started the server and curl-tested `/health` and `/api/dashboard`: correct
  JSON content-type, figures matching the seeded scenario exactly (AR S$119.90,
  MTD revenue S$110), correct per-company scoping, and a nonexistent company
  returns zeroed metrics rather than crashing.
- Added TASK-026 to the backlog: wire `erp-system-api-adapter.js` to actually call
  `GET /api/dashboard` and render it (deliberately deferred in TASK-019 until this
  endpoint existed — it now does).

### Added (2026-07-16 — TASK-019 wire the VITE_DATA_MODE seam)
- `web/index.html`'s first script tag now sets `window.__ERP_DATA_MODE__` from
  Vite's built-in `%VITE_DATA_MODE%` HTML placeholder and defines
  `window.erpDataMode()` (anything other than exactly `'api'` is treated as
  `'demo'`, so an unset env var — the current `dev`/`build` scripts — is unaffected).
- `erp-system-data-adapter.js` (demo/PGlite) gained one guard line that self-disables
  when the mode isn't `demo` — zero behavior change otherwise.
- New `erp-system-api-adapter.js`: self-disables unless mode is `api`; otherwise
  health-checks `{base}/health` (requiring an actual JSON body — `res.ok` alone isn't
  enough, since `vite preview`'s SPA fallback returns 200+index.html for any
  unmatched path) and exposes the same `window.ErpSystemDemo` method shape as the
  demo adapter. Every write rejects with a clear "not available yet, see TASK-011"
  error. This is the documented contract the production API adapter must satisfy.
- New `renderApiUnavailable()` boot gate in `app.js` (checked first, before the
  wizard/login gates): shows an honest "Waiting for the API" screen with a Retry
  button when `VITE_DATA_MODE=api` can't reach a server, instead of fabricating
  dashboard data.
- Verified in browser: `VITE_DATA_MODE=demo` build is unchanged (zero regressions —
  wizard/login/dashboard flow identical); `VITE_DATA_MODE=api` build shows the
  waiting screen with zero console errors at desktop and 375px. `typecheck`,
  `typecheck:web`, `npm run demo`, `build:demo`, and a `VITE_DATA_MODE=api` build all
  pass.

### Added (2026-07-16 — TASK-010 persist wizard data)
- `ErpSystemDemo.completeSetup({masterName,companyName,country,adminName,adminEmail,
  language}) -> {masterFn,companyFn,userId}` — one PGlite transaction: renames the
  existing master, inserts the new company (SG→SGD/GST 9%, MY→MYR/SST 8%), an
  effective-dated `tax_rule`, a starter chart of accounts, the admin `app_user`
  (idempotent), a `Superadmin` role, and the `user_company` link. Rolls back whole on
  failure. This is the documented demo/API adapter contract for setup writes.
- The wizard's Finish step now awaits `completeSetup()` before marking itself
  complete; a failed write re-enables Finish and shows the error instead of
  proceeding.
- `ErpSystemDemo.switchCompany(companyFn)` + rewired topbar company switcher
  (`buildCompanyMenu`/`wireCompanyMenu` in `app.js`) — it previously read a
  disconnected Aria mock array and "switching" was a no-op toast; it now reads
  `DB.erpSystem.companies` (canonical, includes wizard-created companies) and
  performs a real scope switch + refresh.
- Fixed a real crash risk found while implementing: `applyData()` dereferenced
  `d.customers[0]` unguarded in ~10 places — a wizard-created company legitimately
  has zero customers, which threw. Added a safe display-only stub. Also fixed
  `DB.company.branch` being hardcoded to "Singapore HQ" regardless of country.
- Verified in browser: created a second Malaysia company via the wizard (confirmed
  the row via a direct PGlite query), switched to it from the topbar (zero console
  errors, correct empty state), switched back (original data intact), spot-checked
  General Ledger for regressions. `typecheck`, `typecheck:web`, `npm run demo`,
  `build:demo` all pass.

### Added (2026-07-16 — TASK-009 setup wizard shell)
- `web/public/assets/screens-setup-wizard.js` — 6-step first-run wizard (Language →
  Organization → Company → Admin user → AI provider (optional, BYOK, not persisted) →
  Finish), rendered outside `#app` like `renderLogin()`. Gated in `app.js` `boot()` via
  `needsSetupWizard()` (localStorage flag), checked before the sign-in check per
  `docs/SETUP_WIZARD.md`'s first-run ordering. Country picker live-previews
  currency/tax (SG→SGD/GST 9%, MY→MYR/SST 8%). Per-step inline validation.
- Settings → Demo data gained "Re-run setup wizard" (clears the flag only, keeps data)
  alongside "Reset demo data" (now also clears the wizard flag).
- Shell only: Finish does not write to PGlite yet — persistence is TASK-010.
- Verified end-to-end in browser: full flow incl. validation errors, live
  country/currency preview, Finish → reload → login (wizard does not re-show),
  Settings re-run → reload → wizard re-shows with data intact; zero console errors
  at desktop and 375px. `typecheck`, `typecheck:web`, `npm run demo`, `build:demo` pass.

### Added (2026-07-16 — status review + planning suite)
- `docs/STATUS.md` — audited ground truth: browser demo (PGlite/IndexedDB, sales →
  stock → invoice → GL) is real; production (Docker/API/PostgreSQL, `VITE_DATA_MODE`
  switch) is documented but unbuilt; mock-module inventory; design-debt list.
- `docs/MVP.md` — MVP-1 (browser demo) / MVP-2 (Docker production) gates with exit
  criteria; `docs/SPEC.md` — binding contract (invariants, data model, requirements,
  verification gates); `docs/DESIGN.md` — repo map, golden paths, transaction design,
  the dual-copy sync landmine, decisions log.
- `CLAUDE.md` — AI-agent guide (reading order, task.jsonl workflow, commands,
  definition of done, landmines).
- `tasks/tasks.jsonl` TASK-019…025 + `docs/EPICS.md` EPIC-007 (data-seam integrity),
  EPIC-008 (purchasing), EPIC-009 (auth); epic/roadmap statuses updated to reality;
  README production quick-start marked not-yet-implemented.

### Added
- **Documentation-first scaffold.** Standard docs before module implementation:
  - `README.md` — project overview, dual-mode (demo/production) summary, quick start.
  - `docs/ARCHITECTURE.md` — three-tier model, dual-mode seam, PGlite-vs-Dexie decision,
    where business logic runs, module structure, SAP/Odoo reference.
  - `docs/SCALABILITY.md` — **100 GB – 800 GB readiness**: keyset pagination, partitioning,
    indexing, pooling, vacuum, read replicas, archival, ship checklist.
  - `docs/DATA_MODEL.md` — modules, core tables, conventions, multi-tenant scoping,
    cross-module flow, migrations.
  - `docs/DEPLOYMENT.md` — Docker Compose (production) + GitHub Pages (demo) + cross-repo
    CI/CD with PAT, PostgreSQL tuning.
  - `docs/DEMO_MODE.md` — PGlite + IndexedDB + mock data, limits, "what the demo is NOT".
  - `docs/IMPORT_EXPORT.md` — user CSV/Excel vs admin physical backup (pg_basebackup /
    WAL / PITR) at scale.
  - `docs/DEVELOPMENT.md` — setup, scripts, layout, golden path to add a module.
  - `CONTRIBUTING.md`, `CHANGELOG.md`.

### Decided
- Data layer uses **PGlite** (Postgres in WASM → IndexedDB) for the demo so demo and
  production share one SQL schema and migration set.
- Production database target is **100 GB – 800 GB**; scale strategy is part of the
  architecture, not an afterthought.
- Critical multi-step transactions (stock, GL) run **server-side** in production.

### Added (multi-tenancy, localization, DX)
- `docs/MULTI_TENANCY.md` — three-level **`master_fn` → `company_fn` → `user_id`**
  hierarchy; app-level scoping in both modes with PostgreSQL RLS as production-only
  defense-in-depth; many-to-many user↔company; shared-schema rationale.
- `docs/LOCALIZATION.md` — **Singapore + Malaysia** from one codebase; tax as a pluggable,
  effective-dated **model** (SG GST 9% input/output credit vs MY SST 5/10% + 6/8%, no
  credit), per-company currency/country.
- `docs/STUDYING_ODOO.md` — study Odoo **Community (LGPLv3) only**, clean-room/concept
  level; porting Python→TS is still a derivative work; keep the clone outside the repo.
- `Makefile` + `scripts/setup.sh` — **one-command** `make setup` (env → up → wait-for-db →
  migrate → seed), plus `up/down/logs/migrate/seed/reset/psql/demo` targets.

### Changed
- Renamed tenant key `company_id` → **`company_fn`** and added **`master_fn`** above it,
  reconciled across ARCHITECTURE / DATA_MODEL / SCALABILITY / DEVELOPMENT / CONTRIBUTING.
- DEPLOYMENT setup collapsed from a 4-step manual flow to one `make setup`; added a
  production-only RLS migration step.
- `.gitignore` excludes Odoo study clones.

### Added (wizard, i18n, AI providers)
- `docs/SETUP_WIZARD.md` — setup split into **Phase A host bootstrap** (script/`make setup`,
  cannot be a web GUI) and **Phase B in-app first-run wizard** (GUI: master → company →
  country/tax → admin user → AI provider), shared by demo and production.
- `docs/I18N.md` — UI in **en / ms / zh / ja / vi**, lazy-loaded; language is a *user*
  preference (`app_user.language`), kept orthogonal to a company's country/tax/currency.
- `docs/AI_PROVIDERS.md` — pluggable **OpenAI / Gemini / DeepSeek / LM Studio** as **two
  adapters** (OpenAI-compatible + Gemini). **BYOK (Bring Your Own Key) everywhere** — the
  system never ships, stores, or manages a provider key; each user supplies their own at
  runtime, kept user-side, in both demo and production. No server-side key vault. Keys are
  never `VITE_`-prefixed (BYOK keeps them as runtime input, never build vars). Notes CORS +
  LM Studio mixed-content limits, which apply wherever calls are client-side.

### Changed
- `docs/STUDYING_ODOO.md` — clarified that a **private** project still has two distribution
  exits (public demo + on-prem client delivery), so "private" permits the *study*, not the
  *porting*; clean-room rule stands.
- `.env.example` — added **server-only** (non-`VITE_`) LLM provider vars with a leak warning.
- `app_user` gains a `language` column (UI i18n preference).

### Next
- Scaffold the app (Vite + Drizzle schema + PGlite adapter + docker-compose) and
  implement the first module (inventory) end-to-end in both modes, with the SG + MY demo
  companies seeded, the first-run wizard, and the i18n + AI-provider scaffolding.
