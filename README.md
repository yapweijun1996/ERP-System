# ERP System

A modular, full-stack ERP (Enterprise Resource Planning) system designed to run in
**two modes from a single codebase**:

| Mode | Runtime | Data store | Purpose |
| --- | --- | --- | --- |
| **Demo** | Static `web/dist/` (GitHub Pages) | **PGlite → IndexedDB** + mock data | Public, zero-backend showcase |
| **Production** | Docker (`web` + `api` + `db`) | **PostgreSQL (100 GB – 800 GB+)** | Real multi-user deployment |

The two modes share the **same SQL schema, the same migrations, and the same business
logic**. The only thing that changes is *where the database lives* — switched by one
environment variable (`VITE_DATA_MODE`).

> **Why this matters:** the demo you deploy to GitHub Pages and the system your client
> runs on an 800 GB database are not two products. They are one product with a
> swappable data backend.

---

## Core principles

1. **Single source of truth** — one transaction flows across modules
   (order → deduct stock → invoice → post to ledger). No double entry.
2. **Modular** — each business area (sales, inventory, purchasing, finance) is an
   independent module that extends the core without editing it. (Lesson borrowed from
   [Odoo](docs/ARCHITECTURE.md#reference-systems).)
3. **Isomorphic data layer** — [PGlite](https://pglite.dev) is real PostgreSQL compiled
   to WASM, so demo SQL and production SQL are *identical*. No second dialect to
   maintain.
4. **Scale-ready from day one** — the schema, indexing, and pagination strategy assume
   a **100 GB – 800 GB** production database. See [SCALABILITY.md](docs/SCALABILITY.md).

---

## Quick start

### Demo mode (no backend, builds to `web/dist/`)

```bash
npm install
npm run build:demo        # VITE_DATA_MODE=demo → web/dist/
npm run preview           # serve web/dist locally
```

The demo seeds mock data into PGlite (persisted in the browser's IndexedDB) on first
load. **IndexedDB is for demo only** — it is not the 800 GB store. See
[DEMO_MODE.md](docs/DEMO_MODE.md).

### Production mode (Docker: web + api + PostgreSQL) — one command

> `make setup` (`scripts/setup.sh`) is verified end-to-end, including a real
> first-run (`.env.example` → `.env`, then build, health-wait, migrate, seed) and a
> repeat run against an existing `.env` (TASK-021). Every `make` target (`up`, `down`,
> `restart`, `logs`, `migrate`, `seed`, `reset`, `ps`, `psql`) was individually
> exercised against a live stack. Real auth (login/logout/session) is live on the API
> — see [docs/STATUS.md](docs/STATUS.md). Write endpoints for business data (confirm
> order, setup wizard, purchasing) are still todo on the production API; those flows
> are real in demo mode only so far.

```bash
make setup        # creates .env, starts db+api+web, waits for DB, migrates, seeds SG+MY data
```

That's the whole onboarding. `make help` lists every target (`up`, `down`, `logs`,
`migrate`, `seed`, `reset`, `psql`). App: <http://localhost:8080> · API:
<http://localhost:3000> · DB: `localhost:5432`.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for production tuning at 100 GB – 800 GB.

### Multi-tenant, multi-country

Three-level tenancy — **`master_fn` → `company_fn` → `user_id`** — where a company is one
legal entity per country. Ships ready for **Singapore (GST 9%)** and **Malaysia (SST)**
from the same codebase. See [MULTI_TENANCY.md](docs/MULTI_TENANCY.md) and
[LOCALIZATION.md](docs/LOCALIZATION.md).

### Also built in

- **i18n** — runtime UI currently supports English, Malay and Mandarin; Japanese and
  Vietnamese locale packs are part of the productionization plan
  ([I18N.md](docs/I18N.md)). Language is a *user* preference, independent of a company's
  country/tax.
- **Pluggable LLM providers (BYOK)** — OpenAI, Gemini, DeepSeek, LM Studio behind two
  adapters; **Bring Your Own Key** — each user supplies their own key, the system never
  holds one ([AI_PROVIDERS.md](docs/AI_PROVIDERS.md)).
- **Guided setup** — one-command host bootstrap + an in-app first-run wizard
  ([SETUP_WIZARD.md](docs/SETUP_WIZARD.md)).

---

## Documentation

| Doc | What's inside |
| --- | --- |
| [docs/STATUS.md](docs/STATUS.md) | **Start here** — what is built vs mock vs documented-only (reviewed 2026-07-16) |
| [docs/MVP.md](docs/MVP.md) | MVP-1 (browser demo) and MVP-2 (Docker production) scope + exit criteria |
| [docs/SPEC.md](docs/SPEC.md) | Contract of record: invariants, data model, functional requirements, gates |
| [docs/DESIGN.md](docs/DESIGN.md) | Working design: repo map, golden paths, transaction design, landmines |
| [CLAUDE.md](CLAUDE.md) | AI-agent guide: task workflow, commands, definition of done |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, dual-mode seam, where business logic runs, reference systems (SAP/Odoo) |
| [docs/FRONTEND_PLAN.md](docs/FRONTEND_PLAN.md) | Frontend structure, Aria ERP UI baseline, demo/production UI contract |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Build phases from frontend foundation to production operations |
| [docs/EPICS.md](docs/EPICS.md) | Epic-level scope and acceptance criteria |
| [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md) | **`master_fn`/`company_fn`/`user_id`** hierarchy, app-level scoping vs prod RLS, M:N user↔company |
| [docs/LOCALIZATION.md](docs/LOCALIZATION.md) | **Singapore + Malaysia**: GST vs SST pluggable effective-dated tax, currency |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Modules, core tables, multi-tenant scoping, indexing conventions |
| [docs/SCALABILITY.md](docs/SCALABILITY.md) | **100 GB – 800 GB readiness**: partitioning, keyset pagination, indexes, pooling, archiving |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | One-command `make setup`, Docker Compose (prod) + GitHub Pages (demo) + CI/CD |
| [docs/SETUP_WIZARD.md](docs/SETUP_WIZARD.md) | Two-phase setup: host bootstrap (script) + in-app first-run wizard (GUI) |
| [docs/I18N.md](docs/I18N.md) | UI in **en / ms / zh / ja / vi**; i18n (language) vs L10n (tax) separation |
| [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md) | Pluggable **OpenAI / Gemini / DeepSeek / LM Studio**; never leak keys into the demo |
| [docs/DEMO_MODE.md](docs/DEMO_MODE.md) | PGlite + IndexedDB + mock data, limits, build flags |
| [docs/PWA.md](docs/PWA.md) | PWA manifest, service worker, update prompt, mobile safe-area rules |
| [docs/IMPORT_EXPORT.md](docs/IMPORT_EXPORT.md) | User-level CSV/Excel vs admin-level backup/restore at scale |
| [docs/STUDYING_ODOO.md](docs/STUDYING_ODOO.md) | How to study Odoo legally (LGPL) for reference without contaminating this project |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup, scripts, conventions, adding a module |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branching, commits, PR checklist |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Tech stack

- **Frontend:** Vite web app → static `web/dist/`
- **Backend:** Node.js + Express (production mode only)
- **ORM:** Drizzle (one schema, two drivers: `node-postgres` and PGlite)
- **Database:** PostgreSQL 16+ (production) · PGlite/IndexedDB (demo)
- **Container:** Docker Compose
- **CI/CD:** GitHub Actions (builds `web/dist`, deploys demo to GitHub Pages)

## Status

The browser demo uses PGlite/IndexedDB with the canonical 45-table schema and working
Sales, Purchasing, CRM and warehouse-picking transaction chains into stock and balanced GL. Route-level
`SCREEN_META` currently classifies 23 routes as Canonical and 91 as
`Preview · Sample Data`; Preview writes are disabled. The production Docker/PostgreSQL
stack, authentication and every current Canonical route support API mode, while the remaining module APIs
and Canonical route migrations are still in progress. See
[docs/STATUS.md](docs/STATUS.md) for the exact boundary and `tasks/tasks.jsonl` for the
backlog.

## License

TBD.
