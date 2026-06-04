# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
