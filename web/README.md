# `web/` — Current frontend workspace

The production frontend is a Vite-built, classic-script ERP shell. It intentionally
uses vanilla JavaScript under `public/assets/`, a global `SCREENS` registry and a fixed
script order in `index.html`; it is no longer a placeholder for a future frontend.

The original Aria prototype under `../references/ui/aria-erp/` remains a visual
reference only. Current behavior, authorization and data contracts come from this
repository's source and tests, not from prototype mock data.

## Runtime shape

```text
web/index.html
  -> compatibility data
  -> Demo or API adapter
  -> i18n and shared UI
  -> screen registrations
  -> Platform workspace
  -> app router/shell
  -> PWA registration
```

The order of the script tags in `index.html` is part of the runtime contract. Do not
move one classic script to an isolated module or framework without migrating all of
its globals and consumers together.

Key locations:

| Location | Current responsibility |
| --- | --- |
| `public/assets/app.js` | Hash router, shell, session-aware navigation and the Canonical route registry |
| `public/assets/screens-*.js` | Route registration and UI workflows |
| `public/assets/erp-system-data-adapter.js` | Demo/PGlite adapter |
| `public/assets/erp-system-api-adapter.js` | Authenticated API/PostgreSQL adapter |
| `public/assets/platform-workspace.js` | Independent Platform login, bootstrap and provisioning workspace |
| `src/erp-demo-runtime*.ts` | Bundled PGlite, Drizzle and shared TypeScript domain-command runtime |
| `src/erp-report-runtime.ts` | Bundled governed report/PDF runtime |
| `public/db/` | Generated schema/migrations and the deterministic Demo showcase pack |

At the 2026-08-12 source review boundary the UI registers 129 Canonical routes and no
Preview routes. API screen metadata covers 128; `staff-calendar` is the one documented
exception that TASK-200 must either wire or formalize. Do not claim universal API-route
parity until that decision and a fresh authenticated browser matrix pass.

## Two build modes

Both modes share the shell, screen registry, schema and business invariants:

| Mode | Command | Data path | Boundary |
| --- | --- | --- | --- |
| Static Demo | `npm run build:demo` | UI -> shared runtime -> PGlite -> IndexedDB | Local sample data; no backend or production concurrency claim |
| API | `npm run build` | UI -> authenticated Node API -> PostgreSQL | Server authorization and transactional writes |

`VITE_DATA_MODE` is set by the package scripts. `VITE_PLATFORM_DEMO_AUTOFILL=true`
is an explicit hosted-Demo presentation option only; customer builds default it to
false. Public sample credentials, one-click Platform login and autofill must never be
treated as a production authentication configuration.

## Development and verification

From the repository root:

```bash
npm run typecheck:web
npm run build:demo
npm run build
npm run audit:screens
npm run audit:i18n
```

Run the focused workflow/browser commands that correspond to a change. Counts in
documentation are evidence only when the named command was executed at the stated
revision; source presence, collected tests and hosted deployment are separate claims.

For current architecture, release state and known P0 gaps, read
[`DESIGN.md`](../docs/DESIGN.md), [`STATUS.md`](../docs/STATUS.md) and
[`ERP_EXCELLENCE_REVIEW.md`](../docs/ERP_EXCELLENCE_REVIEW.md).
