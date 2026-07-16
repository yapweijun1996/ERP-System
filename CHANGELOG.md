# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
