# Epics

Each epic describes a large work group. Small executable tasks live in
`tasks/tasks.jsonl`.

## EPIC-001 — Frontend Foundation

Build the real frontend workspace in `web/`, using the user's Aria ERP prototype as the
starting UI baseline.

Acceptance criteria:

- Vite app builds in demo mode.
- Aria ERP layout is cloned into the real frontend.
- Data access is behind a `VITE_DATA_MODE` seam.
- Demo mode can boot in the browser.
- Follow-up tasks replace prototype data with this project's PGlite/API data.

## EPIC-002 — Demo Mode And GitHub Pages

Make the public demo static-hosting friendly.

Acceptance criteria:

- `npm run build:demo` emits a static bundle.
- PGlite persists demo data to IndexedDB.
- Reset demo clears and reseeds browser data.
- GitHub Pages base path and refresh behavior are handled.
- GitHub Actions can deploy the static demo.

## EPIC-003 — Core ERP Modules

Build the user-facing module screens around the implemented ERP domain.

Acceptance criteria:

- Inventory screen lists products, warehouses, stock levels, and movements.
- Sales screen lists customers and sales orders.
- Sales order confirmation demonstrates stock deduction.
- Invoice screen shows generated invoices.
- Finance screen shows chart of accounts and GL entries.

## EPIC-004 — Setup Wizard

Implement first-run setup shared by demo and production.

Acceptance criteria:

- Empty app launches setup wizard.
- User can choose language.
- User can create master/company.
- Country selection configures currency and tax regime.
- First admin user can be created.
- Demo can reset wizard state; production locks setup after first admin.

## EPIC-005 — Production API And Docker

Add the production runtime path.

Acceptance criteria:

- API exposes dashboard and ERP write endpoints.
- API connects to PostgreSQL through configured `DATABASE_URL`.
- Docker Compose starts `web`, `api`, and `db`.
- Migrations run against PostgreSQL.
- Stock and finance writes are server-side transactions.
- PostgreSQL concurrency test prevents stock over-sell.

## EPIC-006 — CI, Testing, And Release

Add repeatable validation and deployment checks.

Acceptance criteria:

- CI runs root typecheck, web typecheck, and demo build.
- CI can run transaction proof tests.
- Browser smoke test covers desktop and mobile demo load.
- Release checklist distinguishes GitHub Pages demo and Docker production.
- Docs stay aligned with package scripts and deployment assets.
