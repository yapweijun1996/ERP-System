# ERP System

A modular, full-stack ERP (Enterprise Resource Planning) system designed to run in
**two modes from a single codebase**:

| Mode | Runtime | Data store | Purpose |
| --- | --- | --- | --- |
| **Demo** | Static `web/dist/` (GitHub Pages) | **PGlite → IndexedDB** + mock data | Public, zero-backend showcase |
| **Production** | Docker (`web` + `api` + `db`) | **PostgreSQL (100 GB – 800 GB+)** | Real multi-user deployment |

The two modes replay the same **ordered Drizzle schema migrations** and reuse shared
transactional domain commands where the browser can provide the required guarantees.
The transport and trust boundary change with `VITE_DATA_MODE`: Demo runs a single-user
PGlite adapter, while API mode adds server sessions, workers, PostgreSQL concurrency and
the production-only RLS overlay.

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
3. **Isomorphic data layer** — [PGlite](https://pglite.dev) is PostgreSQL compiled to
   WASM, so both modes replay one Drizzle migration chain and most repositories/commands
   need no second query dialect. Production-only RLS and concurrency controls remain
   deliberate overlays.
4. **Scale-ready from day one** — the schema, indexing, and pagination strategy assume
   a **100 GB – 800 GB** production database. See [SCALABILITY.md](docs/SCALABILITY.md).

---

## Quick start

### Try the public Demo

[Open the Aria ERP Demo](https://yapweijun1996.github.io/ERP-System/)

The public Demo is a static GitHub Pages build. It runs the shared ERP domain logic in
PGlite/WASM and stores Demo data only in the current browser's IndexedDB; it does not
connect to the production API or PostgreSQL database.

On a fresh browser profile, continue through the first-run setup and then choose the
showcase persona offered on the sign-in screen. To start over, use **Reset demo database**
on the sign-in screen or the Demo data reset control in Settings.

> **Demo only:** the sample accounts and records are public. Never enter real customer,
> employee, payroll, bank, password, API key or other business data into this Demo.

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
> first-run (`.env.example` → `.env`, then build, health-wait, migrate) and a
> repeat run against an existing `.env` (TASK-021). Every `make` target (`up`, `down`,
> `restart`, `logs`, `release`, `migrate`, `seed`, `reset`, `ps`, `psql`) was individually
> exercised against a live stack. Real auth (login/logout/session) and the current
> Canonical setup, sales, purchasing and finance writes are live on the API — see
> [docs/STATUS.md](docs/STATUS.md). Remaining module breadth is explicitly tracked as
> Preview or deferred work rather than silently falling back to sample writes.

```bash
make setup        # creates .env, starts db+api+web, waits for DB, and migrates
make setup-production  # client server: only web is published; API/DB stay private
```

That's the whole onboarding; demo seed data is opt-in, so a client database does not get
sample rows by accident. `make help` lists every target (`up`, `down`, `release`, `logs`,
`migrate`, `seed`, `reset`, `psql`). App: <http://localhost:8080> · API:
<http://localhost:3000> · DB: `localhost:5432`.

For a later client source-code update, use `make release`. It replaces only the web/API
containers and preserves PostgreSQL volumes. If a feature includes a schema migration,
apply it separately with `CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh` after backup and
staging verification; source code alone cannot safely invent a missing table or column.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for production tuning at 100 GB – 800 GB.

### Multi-tenant, multi-country

Three-level tenancy — **`master_fn` → `company_fn` → `user_id`** — where a company is one
legal entity per country. The current baseline seeds **Singapore (GST)** and
**Malaysia (SST)** country/currency plus effective-dated tax rules from one codebase;
full regime engines and statutory filing integrations remain target scope. See
[MULTI_TENANCY.md](docs/MULTI_TENANCY.md) and
[LOCALIZATION.md](docs/LOCALIZATION.md).

### Also built in

- **i18n** — the browser UI supports English, Malay, Simplified Chinese, Japanese and
  Vietnamese. Language is stored in the current browser, defaults to English and is
  independent of company country/tax and document locale
  ([I18N.md](docs/I18N.md)).
- **Governed OCR / BYOK Vision** — local OCR is default; optional OpenAI, Google or
  OpenAI-compatible document extraction uses an encrypted connector and server worker.
  The setup-wizard AI selector is preview-only and a general ERP chat assistant is not
  implemented ([AI_PROVIDERS.md](docs/AI_PROVIDERS.md)).
- **Guided setup** — one-command host bootstrap + an in-app first-run wizard
  ([SETUP_WIZARD.md](docs/SETUP_WIZARD.md)).

---

## Documentation

| Doc | What's inside |
| --- | --- |
| [docs/STATUS.md](docs/STATUS.md) | **Start here** — what is implemented, tested, deployed, blocked or planned (reviewed 2026-08-12) |
| [docs/MVP.md](docs/MVP.md) | MVP-1 (browser demo) and MVP-2 (Docker production) scope + exit criteria |
| [docs/SPEC.md](docs/SPEC.md) | Contract of record: invariants, data model, functional requirements, gates |
| [docs/DESIGN.md](docs/DESIGN.md) | Working design: repo map, golden paths, transaction design, landmines |
| [CLAUDE.md](CLAUDE.md) | AI-agent guide: task workflow, commands, definition of done |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, dual-mode seam, where business logic runs, reference systems (SAP/Odoo) |
| [docs/FRONTEND_PLAN.md](docs/FRONTEND_PLAN.md) | Frontend structure, Aria ERP UI baseline, demo/production UI contract |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Build phases from frontend foundation to production operations |
| [docs/EPICS.md](docs/EPICS.md) | Epic-level scope and acceptance criteria |
| [docs/TASK.md](docs/TASK.md) | Human-readable current task index; `tasks/tasks.jsonl` remains canonical |
| [docs/ROLE_PERMISSION_ARCHITECTURE.md](docs/ROLE_PERMISSION_ARCHITECTURE.md) | Current authorization behavior, approved target and migration backlog |
| [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md) | **`master_fn`/`company_fn`/`user_id`** hierarchy, app-level scoping vs prod RLS, M:N user↔company |
| [docs/LOCALIZATION.md](docs/LOCALIZATION.md) | **Singapore + Malaysia**: current effective-dated rates/currency vs target GST/SST engines and statutory outputs |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Modules, core tables, multi-tenant scoping, indexing conventions |
| [docs/SCALABILITY.md](docs/SCALABILITY.md) | **100 GB – 800 GB target rulebook**; current large-scale/partition/DR proof is TASK-201 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | One-command `make setup`, Docker Compose (prod) + GitHub Pages (demo) + CI/CD |
| [docs/SETUP_WIZARD.md](docs/SETUP_WIZARD.md) | Two-phase setup: host bootstrap (script) + in-app first-run wizard (GUI) |
| [docs/I18N.md](docs/I18N.md) | UI in **en / ms / zh / ja / vi**; i18n (language) vs L10n (tax) separation |
| [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md) | Implemented governed OCR/BYOK Vision boundary; setup preview and unimplemented general assistant |
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

The browser demo uses PGlite/IndexedDB with the canonical 249-table schema and working
Sales, Purchasing, CRM, inventory, warehouse-picking and manufacturing work-order
transaction chains. Route-level
`SCREEN_META` currently classifies 129 routes as Canonical and 0 as Preview; Preview
writes remain disabled if a future Preview route is introduced. Exactly 128 routes
declare API mode: `staff-calendar` is the one metadata exception tracked by TASK-200.
Production deployment exists, but current public probes returned 502 and Platform
provisioning still needs least-privilege PostgreSQL/RLS proof. See
[docs/STATUS.md](docs/STATUS.md),
[docs/ERP_EXCELLENCE_REVIEW.md](docs/ERP_EXCELLENCE_REVIEW.md) and
`tasks/tasks.jsonl` for the exact implemented/tested/deployed/planned boundary.

## License

TBD.
