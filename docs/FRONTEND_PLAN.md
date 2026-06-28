# Frontend Plan

This project will build its ERP frontend incrementally using the user's Aria ERP design
as the **visual baseline**. The pasted Aria ERP prototype now lives in
`references/ui/aria-erp/`.

## 1. Source-of-truth rule

Clone the Aria ERP shell, navigation, spacing, and component look so the product does not
waste time on redesign.

Use it for:

- sidebar and topbar layout reference
- module navigation patterns
- dashboard density and page structure
- table, form, filter, drawer, and detail-page patterns
- responsive behavior on mobile and desktop

Do not carry over unrelated prototype implementation details long term:

- mock business data
- unrelated modules
- global script registry patterns, except as a short-lived bridge while the cloned Aria
  shell is still a classic-script app
- static screen files that are not part of the current milestone
- duplicate SQL schema that conflicts with `src/data/schema/`

The canonical data model remains Drizzle in `src/data/schema/`. The canonical business
flows remain TypeScript modules under `src/modules/`.

Current bridge: `web/public/assets/erp-system-data-adapter.js` loads after the cloned
Aria sample data and before the UI/screen files. It maps the canonical Acme SG demo seed
and the `SO-1 -> INV-SO-1 -> GL` transaction proof into Aria's existing `DB` object so the
layout can keep running while the real PGlite/API adapter is built.

## 1.1 Repository boundary

Keep these folders separate:

| Folder | Purpose |
| --- | --- |
| `web/` | Real frontend app source and build config |
| `references/ui/aria-erp/` | User-owned Aria ERP visual baseline and prototype assets |
| `src/data/` | Shared schema, adapters, seed, repository helpers |
| `src/modules/` | Business modules and transactions |
| `api/` | Production API server, once added |
| `infra/` | Docker, deployment, and environment assets, once added |

## 2. Target frontend shape

The frontend lives in `web/`.

Recommended target:

```
web/
  package.json
  index.html
  vite.config.ts
  src/
    app/
    components/
    layouts/
    pages/
    data/
    styles/
```

The first milestone may be plain HTML/CSS/JavaScript if that gets the demo moving faster,
but the long-term frontend should stay modular enough to support:

- GitHub Pages static demo
- PGlite browser data adapter
- API/PostgreSQL production adapter
- first-run setup wizard
- mobile and desktop ERP workflows

## 3. Two runtime modes

The same UI must support two data modes:

| Mode | Deploy target | Data path | Purpose |
| --- | --- | --- | --- |
| Demo | GitHub Pages static `dist/` | Browser UI -> PGlite -> IndexedDB | Public showcase with mock/demo data |
| Production | Docker (`web` + `api` + `db`) | Browser UI -> Node API -> PostgreSQL | Real multi-user ERP deployment |

Build-time flag:

```text
VITE_DATA_MODE=demo   # browser PGlite
VITE_DATA_MODE=api    # production API
```

In production, writes that affect stock or money must go through the API. The browser is
not allowed to bypass server-side transaction enforcement.

## 4. Incremental build order

Build one ERP slice at a time:

1. App shell: sidebar, topbar, company switcher, language switcher, responsive layout.
2. Dashboard: mock KPIs first, then real summary queries.
3. Inventory: products, warehouses, stock on hand, stock movement history.
4. Sales: customers, sales orders, order confirmation, invoice output.
5. Finance: chart of accounts, GL entries, AR summary.
6. Settings: company, user, language, fiscal period, tax rules.
7. Setup wizard: first-run flow shared by demo and production.

Each page should start with mock data only when needed for layout, then be wired to the
shared data layer or API adapter before it is considered complete.

For the cloned Aria baseline, the migration path is:

1. Keep the Aria shell and screens stable.
2. Replace old Northwind sample objects through `erp-system-data-adapter.js`.
3. Move adapter source data from hardcoded canonical mirror to browser PGlite queries.
4. Swap the demo adapter for the production API adapter when `VITE_DATA_MODE=api`.
5. Remove old Aria data files once every used screen reads from the project adapter.

## 5. Acceptance checks

Before a frontend milestone is considered done:

- `npm run build:demo` produces a static bundle suitable for GitHub Pages.
- Demo mode works without `DATABASE_URL` or any backend server.
- Demo data persists in IndexedDB and can be reset.
- Production build points to the API adapter, not PGlite.
- Docker Compose can run `web`, `api`, and `db`.
- The setup wizard appears on first run when no master/company exists.
- Desktop and mobile layouts are checked for sidebar/topbar/table/form usability.
