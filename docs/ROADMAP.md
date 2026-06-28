# Roadmap

This roadmap keeps the ERP build focused on a working demo first, then production
readiness. The order matters: prove the product shape in the browser, then harden the
server and Docker path.

## Phase 1 — Frontend Foundation

Goal: use the user's Aria ERP design as the frontend base, then wire it to this
project's demo and production data paths.

Deliverables:

- Vite frontend under `web/`
- Aria ERP static layout cloned as the first UI baseline
- `VITE_DATA_MODE=demo | api` data adapter seam
- path to replace prototype data with this project's PGlite/API data
- local preview and build verification

Status: started.

## Phase 2 — Demo ERP

Goal: publish a public static ERP demo that feels real but contains only sample data.

Deliverables:

- PGlite schema/seed aligned with the real Drizzle schema
- IndexedDB persistence and reset demo action
- dashboard, inventory, sales order, invoice, finance, settings screens
- GitHub Pages-compatible static build
- GitHub Actions deployment workflow

Exit criteria:

- `npm run build:demo` produces a working static `web/dist/`
- published GitHub Pages URL boots without backend services
- no secrets, production URLs, or customer data are bundled

## Phase 3 — Core ERP Flow

Goal: make the demo show a believable end-to-end ERP transaction.

Deliverables:

- customer and product browse
- create/confirm sales order
- stock deduction
- invoice generation
- GL posting view
- rollback/error states for insufficient stock

Exit criteria:

- the browser demo can demonstrate order -> stock -> invoice -> GL
- the same logic remains compatible with the production API path

## Phase 4 — Setup Wizard

Goal: support first-run setup in demo and production.

Deliverables:

- language selection
- master/company creation
- country/currency/tax setup for Singapore and Malaysia
- first admin user
- optional sample data seed
- production setup lock/authorization after first admin exists

Exit criteria:

- empty demo opens wizard first
- production API can persist wizard results to PostgreSQL

## Phase 5 — Production Runtime

Goal: run the ERP as a self-hosted Docker deployment.

Deliverables:

- API server
- PostgreSQL connection and migrations
- Docker Compose stack: `web`, `api`, `db`
- health checks
- production seed/migrate/reset scripts
- server-side stock and finance transactions

Exit criteria:

- `docker compose up -d` starts all services
- production transaction tests pass against PostgreSQL
- browser writes stock/money through API only

## Phase 6 — Quality And Operations

Goal: make the system safe to maintain.

Deliverables:

- CI checks for typecheck/build/demo
- browser smoke tests
- transaction tests against PostgreSQL
- deployment docs
- backup/restore runbook
- release checklist

Exit criteria:

- every PR can be validated with documented commands
- demo and production paths have separate deployment checks
