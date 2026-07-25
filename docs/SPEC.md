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
| Tenancy/auth | `master`, `company`, `app_user`, `role`, `user_company`, `user_company_role` |
| Localization | `currency`, `fx_rate`, `tax_rule` |
| Inventory | `product`, `warehouse`, `stock_level`, `stock_movement` |
| Sales | `customer`, `sales_order`, `sales_order_line`, `invoice` |
| Finance | `account`, `gl_entry` |

The table above lists only the original MVP-1 core. Schema has since grown to cover
purchasing, CRM, manufacturing, quality, fixed assets, HR, project, service, purchase
requisitions, finance treasury (bank receipts/payment vouchers) and payroll — see
`src/data/schema/index.ts` for the full current module list.
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
- **Auth** (TASK-024/TASK-106): production login resolves `master.login_code` before
  the organisation-scoped `app_user.username`; session carries
  `master_fn`/`company_fn` and authorization unions active `user_company_role`
  grants. Demo mode may auto-login a demo user but must label it.
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

### 4.4 Approved expansion (EPIC-052–056)

The following requirements are approved product scope. TASK-106 implemented the
organisation username/multi-role identity foundation, TASK-107 implemented the
employee account lifecycle, TASK-108 implemented actor-owned self/team reads and
TASK-109 delivered the five-language My Work shell as five Preview routes, and
TASK-110 proved the identity/security boundary including reporting-derived Manager
authorization. TASK-111–135 remain **Planned** until their individual acceptance gates pass. Planned
capabilities must not be represented as current Canonical behavior.

- **Employee identity:** production login now uses organisation code + an
  organisation-unique username, with nullable email before activation. HR employee
  linking and the activation lifecycle are implemented by TASK-107.
- **Multiple roles:** one user may now hold multiple roles in one company. Permissions
  are the union of those roles without widening the company boundary. Employee binding
  and reporting-hierarchy row scope are implemented by TASK-107/108. TASK-110 adds
  system/manual grant provenance so reporting lines automatically maintain Manager
  without revoking a separately authorized manual grant.
- **Actor-owned self service:** `/api/my/*` now derives employee identity from Session,
  rejects client-selected employee IDs and separates self/team permissions. Direct
  reports plus effective-dated company-bound hierarchy grants determine manager
  scope; manager leave projections omit private reason facts. Claim/receipt endpoints
  declare `not_modelled` until their domain tasks. Offboarding revokes active sessions
  but retains statutory/audit history.
- **My Work shell:** My Leave, My Claims and My Receipts use the shared list SSOT.
  Team Calendar and My Approvals are present only when the actor context grants team
  scope; team rows omit private reasons/evidence. Claims/Receipts and approval commands
  remain honest unavailable/read-only states. These five accepted shell routes are
  Preview backed by Canonical actor reads, leaving the 115 Canonical routes unchanged.
- **Full leave:** effective-dated work/holiday/leave policy, full-day/half-day units,
  immutable entitlement ledger, Pending reservation, versioned amendment/cancellation,
  multi-stage approval/delegation/capacity, role-redacted team calendar, protected
  medical evidence and Payroll sources for unpaid leave and encashment.
- **Receipt evidence:** JPEG/PNG/HEIC/PDF only, maximum 20 MB and 20 PDF pages. Every
  file is quarantined until a fail-closed scan succeeds. Local OCR is default; external
  Vision is explicit company BYOK. Governed auto-submit requires every critical field
  at 98% confidence or above plus safety, amount and duplicate checks.
- **Expense claims:** employee-paid and company-paid evidence, multi-line claims,
  tax/GL/FX/category policy, manager + Finance line decisions, duplicate/budget
  control, card-statement matching, mileage/per diem/cash advances and final-approval
  balanced posting to Employee Payable or the configured company-paid account.
- **Payment and tax evidence:** encrypted employee payout profiles, distinct
  maker/checker bank-file batches, successful-line-only bank posting and immutable
  PDF/XLSX/CSV/ZIP/hash tax-support packages. The product does not call bank APIs or
  submit tax returns directly.
- **Record governance:** unsubmitted drafts may be deleted; submitted evidence uses
  reasoned Void; posted/finalised evidence uses correction or reversal. Legal hold
  prevents purge. Post-retention content purge requires two distinct approvers and
  leaves a permanent hash tombstone.

Confirmed risk acceptance for this programme: MFA, sensitive-operation step-up and
email verification are optional rather than mandatory. Tests and documentation must
continue to report that boundary accurately; no implementation may imply those
controls exist.

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
