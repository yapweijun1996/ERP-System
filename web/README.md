# web/ — Frontend workspace

This folder is the home for the ERP frontend.

The pasted Aria ERP prototype lives in `../references/ui/aria-erp/` and is the
user-owned **visual baseline**. The real app should clone its shell, navigation, spacing,
tables, forms, cards, responsive behavior, and page density so we do not waste time
redesigning.

Keep the implementation clean: do not copy unrelated mock data, duplicate SQL schemas,
or static screens that are outside the current milestone.

The backend/data core already lives in `../src` and remains independent:

- schema: `../src/data/schema/`
- migrations: `../drizzle/`
- business flows: `../src/modules/`
- production server/API: to be added for Docker mode

## Target structure

The real frontend should become:

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

See `../docs/FRONTEND_PLAN.md` for the implementation contract.

## Runtime modes

The frontend must support both modes:

- **Demo build** (`dist/` → GitHub Pages): the UI talks to **PGlite** (Postgres in the
  browser) via the data layer in `../src/data`.
- **Production**: the same UI talks to the Node API → PostgreSQL.

Use:

```text
VITE_DATA_MODE=demo   # PGlite / IndexedDB
VITE_DATA_MODE=api    # API / PostgreSQL
```

## Build order

Build one page group at a time:

1. app shell: sidebar, topbar, company switcher, language switcher
2. dashboard
3. inventory
4. sales order and invoice
5. finance / GL
6. settings
7. setup wizard

Things the layout will need slots for (already built on the backend):
- **Company switcher** — multi-tenant: `master_fn` → `company_fn`
  ([../docs/MULTI_TENANCY.md](../docs/MULTI_TENANCY.md))
- **Language switcher** — en / ms / zh / ja / vi ([../docs/I18N.md](../docs/I18N.md))
- **Modules** — Inventory, Sales, Purchasing, Finance, Settings
  ([../docs/DATA_MODEL.md](../docs/DATA_MODEL.md))

## Git / build hygiene

`node_modules/` and `dist/` are already git-ignored at any depth, so `web/node_modules`
and `web/dist` won't be committed. Don't paste your `node_modules` (run install fresh).
