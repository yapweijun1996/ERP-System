# SPEC — Contract of Record

This is the binding functional/technical contract. If code and this spec disagree,
either fix the code or change this spec in the same PR — never let them drift silently.
Deep dives live in the linked docs; this file is the index of *requirements*.

## 1. Product definition

A modular, multi-tenant ERP that runs in two modes from one codebase:

| Mode | Runtime | Data store | Users |
| --- | --- | --- | --- |
| **demo** | Static site (GitHub Pages / any static host) | PGlite (Postgres-WASM) persisted to IndexedDB; UI prefs in localStorage | Single browser, no accounts |
| **api** (production) | Docker: `web` (static) + `api` (Node) + `db` (PostgreSQL) | PostgreSQL, target 100–800 GB | Multi-user, authenticated |

Mode is selected at build time by `VITE_DATA_MODE=demo|api` (SPEC requirement — wiring
is TASK-019; see [STATUS.md](STATUS.md) for current reality).

## 2. Hard invariants (never violate)

1. **One schema.** Demo and production share the same Drizzle schema and migrations
   (`src/data/schema/`, `drizzle/`). No demo-only tables.
2. **Stock and money are transactional.** Order confirm = one DB transaction:
   lock stock rows → deduct → write `stock_movement` → set order status → create
   `invoice` → post **balanced** `gl_entry` legs. Any failure rolls back the whole
   chain (`InsufficientStockError` on over-sell).
3. **In production, stock/money writes are server-side only.** The browser never
   executes them directly in api mode.
4. **Tenant scoping.** Every business row carries `master_fn` (+ `company_fn` where
   applicable); every query filters by them, taken from the session — never from
   client input. See [MULTI_TENANCY.md](MULTI_TENANCY.md).
5. **GL must balance.** Sum(debit) = Sum(credit) per journal document, enforced by the
   posting code and asserted in `src/demo.ts`.
6. **Tax is effective-dated and pluggable** (SG GST vs MY SST). Rate comes from
   `getEffectiveTaxRate(country, date)`, never hardcoded in screens.
   See [LOCALIZATION.md](LOCALIZATION.md).
7. **BYOK for AI.** The system never ships or stores a provider API key server-side;
   keys are user-supplied at runtime, never `VITE_`-prefixed. See [AI_PROVIDERS.md](AI_PROVIDERS.md).
8. **No secrets in the demo bundle.** `build:demo` output must contain no production
   URLs, credentials, or customer data.

## 3. Data model (implemented — 18 tables)

Source of truth: `src/data/schema/` → generated `drizzle/0000_init.sql`.

| Domain | Tables |
| --- | --- |
| Tenancy/auth | `master`, `company`, `app_user`, `role`, `user_company` |
| Localization | `currency`, `fx_rate`, `tax_rule` |
| Inventory | `product`, `warehouse`, `stock_level`, `stock_movement` |
| Sales | `customer`, `sales_order`, `sales_order_line`, `invoice` |
| Finance | `account`, `gl_entry` |

Planned domains (schema does not exist yet): purchasing (TASK-022), then CRM, HR, etc.
Conventions (naming, keys, indexes, keyset pagination) → [DATA_MODEL.md](DATA_MODEL.md)
and [SCALABILITY.md](SCALABILITY.md).

## 4. Functional requirements by module

### 4.1 Implemented (canonical data)

- **Inventory:** list products/warehouses/stock-on-hand; movement history with net
  change per period. Stock never goes negative.
- **Sales:** customer & order browse; order detail with lines, tax snapshot label,
  totals, status stepper; **Confirm** on draft orders runs invariant #2; over-stock
  order (seed SO-3) must fail with a visible error and full rollback.
- **Finance/GL:** invoice list/detail; journal viewer with balanced Dr/Cr legs;
  chart of accounts → per-account ledger drill-down → source journal; P&L and AR
  aging derived from `gl_entry` aggregates (must reconcile with demo transactions).
- **Settings:** demo data reset (drop + reseed).

### 4.2 Required, not yet built

- **Setup wizard** (TASK-009/010): first run on an empty database walks through
  language → master/company → country (sets currency + tax regime) → first admin →
  optional sample seed. Demo can re-run via reset; production locks after first admin.
  Contract → [SETUP_WIZARD.md](SETUP_WIZARD.md).
- **Auth** (TASK-024): login validates against `app_user`; session carries
  `master_fn`/`company_fn`/role; demo mode may auto-login a demo user but must label it.
- **Production API** (TASK-011 ✅ scaffolded, `src/server.ts`): Node/Express service,
  `DATABASE_URL` env. `GET /health` and `GET /api/dashboard` exist and are verified
  against real PostgreSQL. Still needed: more module reads, `POST` writes for
  stock/money flows executing `src/modules/*` inside transactions, and session-derived
  tenant scope (`masterFn`/`companyFn` are query params today — a documented
  scaffold-only shortcut, never acceptable for a write endpoint per invariant #4).
- **Purchasing** (TASK-022/023): supplier, purchase order + lines, goods receipt
  (increases stock), supplier invoice (posts GL). Mirrors the sales chain.

### 4.3 Mock screens (allowed, must be labeled)

CRM, Manufacturing, Quality, HR/Payroll, Projects, Service, Fixed Assets, BI,
Integration, Admin render sample data. Requirement: each such screen must be visibly
marked as sample/demo content and must not crash under canonical data (TASK-018).

## 5. Non-functional requirements

- **Performance:** all list screens must use keyset pagination patterns compatible
  with 100–800 GB tables ([SCALABILITY.md](SCALABILITY.md) checklist before any
  large-table feature ships).
- **Mobile:** every shipped screen usable at 375 px; no horizontal overflow.
- **PWA:** installable; SW never serves HTML for JS/CSS asset requests; update prompt
  on new SW. ([PWA.md](PWA.md))
- **i18n:** UI strings via the i18n layer (en/ms/zh/ja/vi); language is a user
  preference (`app_user.language`), orthogonal to company country. ([I18N.md](I18N.md))
- **Licensing:** Odoo is studied at concept level only — no code porting.
  ([STUDYING_ODOO.md](STUDYING_ODOO.md))

## 6. Verification gates

| Gate | Command | Must pass |
| --- | --- | --- |
| Type safety | `npm run typecheck` + `npm run typecheck:web` | every PR |
| Transaction proof | `npm run demo` | every PR (runs in Pages CI) |
| PG parity + concurrency | `POSTGRES_URL=... npm run demo` | before any production release (TASK-013) |
| Demo build | `npm run build:demo` | every PR |
| Browser smoke | TASK-015 script (desktop + 375 px, zero console errors) | once built: every PR |
