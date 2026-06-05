# web/ — UI / frontend landing zone

**Paste your ERP UI / layout project here.** This folder is the home for the frontend.
The backend (data model, transactions) already lives in `../src` and is independent of
whatever you drop in here, so pasting your project will not break anything.

## How to drop it in

Copy the **contents** of your UI project into this `web/` folder, so you end up with
(for example):

```
web/
  package.json        ← your UI project's own package.json
  index.html
  src/                ← your components, pages, layout, styles
  vite.config.ts      (or whatever your tool uses)
  ...
```

> Tip: paste the *contents* of your UI project, not the outer folder — i.e. `web/package.json`,
> not `web/my-ui/package.json`. (If it's easier to paste the whole folder, that's fine too —
> just tell me and I'll adjust the paths when wiring it up.)

## After you paste — tell me these 3 things

So I can wire the UI to the backend correctly:

1. **Framework** — React / Vue / Svelte / plain HTML? (changes how we connect data)
2. **Build tool** — Vite / Next / CRA / something else? (changes the build + `dist/` output)
3. **Standalone vs layout-only** — does it have its own `package.json` (a full app), or is it
   just components/pages/CSS to integrate?

## How it will connect (later — layout first, function after)

Per the project's dual-mode design ([../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)):

- **Demo build** (`dist/` → GitHub Pages): the UI talks to **PGlite** (Postgres in the
  browser) via the data layer in `../src/data`.
- **Production**: the same UI talks to the Node API → PostgreSQL.

We are doing **layout first**: get the shell, navigation, and pages looking right with
mock/placeholder data. Wiring real data (the `../src/data` adapters, the
`confirmSalesOrder` flow, etc.) comes after the layout is approved.

Things the layout will need slots for (already built on the backend):
- **Company switcher** — multi-tenant: `master_fn` → `company_fn`
  ([../docs/MULTI_TENANCY.md](../docs/MULTI_TENANCY.md))
- **Language switcher** — en / ms / zh / ja / vi ([../docs/I18N.md](../docs/I18N.md))
- **Modules** — Inventory, Sales, Purchasing, Finance, Settings
  ([../docs/DATA_MODEL.md](../docs/DATA_MODEL.md))

## Git / build hygiene

`node_modules/` and `dist/` are already git-ignored at any depth, so `web/node_modules`
and `web/dist` won't be committed. Don't paste your `node_modules` (run install fresh).
