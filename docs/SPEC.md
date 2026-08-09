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

Mode is selected at build time by `VITE_DATA_MODE=demo|api`. The adapter seam is
implemented; current Canonical screens use Demo/PGlite or authenticated API resources
without silently falling back to sample data.

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

## 3. Original MVP-1 core data model (implemented baseline — 18 tables)

Source of truth: `src/data/schema/` → generated `drizzle/0000_init.sql`.

| Domain | Tables |
| --- | --- |
| Tenancy/auth | `master`, `company`, `app_user`, `role`, `user_company`, `user_company_role`, `user_company_role_scope` |
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

### 4.2 Implemented foundation and remaining coverage

- **Setup wizard** (TASK-009/010/024/059): first run on an empty database walks
  through language → master/company → country (sets currency + tax regime) → first
  admin → optional sample seed. Demo can re-run via reset; production locks after
  the first admin. Production setup is a one-time empty-database command and does
  not require a deployment setup token. Contract → [SETUP_WIZARD.md](SETUP_WIZARD.md).
- **Auth** (TASK-024/TASK-106–110/TASK-172/TASK-173): production login resolves
  `master.login_code` before the organisation-scoped `app_user.username`; the server-side
  session carries `master_fn`/`company_fn`, authorization unions only live
  `user_company_role` grants inside `[valid_from, valid_until)` and before `revoked_at`,
  and the remembered-device cookie enforces its bounded idle/absolute lifetime. Role
  grants remain an allow union, while the central evaluator now supports tenant-scoped
  user-level explicit allow/deny overrides with deny precedence. `role_permission.allowed=false`
  is not itself the explicit-deny mechanism. Demo mode hashes wizard-created passwords
  too and labels its demo session.
- **Production API** (TASK-011/TASK-040 and subsequent resource/command work):
  Node/Express uses `DATABASE_URL`, real PostgreSQL, server-side session tenant scope,
  and shared transactional commands for current Canonical reads/writes. Remaining
  Preview or deferred module depth must be added as separate schema/resource/command
  work; the frontend must not fabricate production writes.
- **Purchasing and core transaction chains** (TASK-022/023 and later phases):
  supplier, purchase order + lines, goods receipt, supplier invoice, sales order,
  service-capable lines and balanced GL/stock effects are real in Demo/API modes.
  Additional module breadth remains governed by the Canonical/Preview boundary in
  [STATUS.md](STATUS.md).

### 4.3 Preview and deferred depth

The current route baseline is **128 Canonical / 0 Preview**. The old Mock-screen
statement from the early MVP is historical and no longer describes the shipped route
set: CRM, Manufacturing, Quality, HR, Payroll, Projects, Service, Fixed Assets, BI,
Integration and Admin now use Canonical data/contracts at the route boundary. A future
incomplete feature may be introduced only as an explicitly labelled `Preview · Sample
Data` or `Preview · Canonical Data` route, with write-like actions disabled until its
schema, resource/command, permission, tests and localization are complete.

Module depth that is not yet represented by a route or command remains future scope;
it must not be simulated with fabricated data or silently treated as implemented.

### 4.4 Approved expansion (EPIC-052–056)

The following requirements are approved product scope. TASK-106 implemented the
organisation username/multi-role identity foundation, TASK-107 implemented the
employee account lifecycle, TASK-108 implemented actor-owned self/team reads and
TASK-109 delivered the five-language My Work shell initially as five Preview routes;
later tasks promoted the My Work data and route contracts to the current Canonical
boundary. TASK-110 proved the identity/security boundary including reporting-derived Manager
authorization. TASK-111 implements the versioned policy/calendar foundation.
TASK-112 implements the immutable leave-balance ledger and Pending reservation
boundary. TASK-113 implements the versioned leave lifecycle, actor-owned authoring,
privacy-controlled evidence metadata and approved cancellation. TASK-114 implements
versioned multi-level approval, bounded delegation, immutable authority/decision
audit, reminders/escalation and minimum-staff capacity controls. TASK-115 implements
the privacy-redacted Team Calendar plus optional idempotent outbound delivery.
TASK-116 implements immutable unpaid-leave/cancellation/encashment Payroll sources,
policy-controlled balance consumption and one-time payroll-run application.
TASK-117 implements immutable managed-document identity/version metadata,
database-default PostgreSQL/PGlite byte content, optional explicit single-node
filesystem content and a shared authorization/integrity contract. TASK-118 implements
bounded magic-validated receipt upload, immutable page counts, actor-owned listing,
mobile capture/editing and logout-cleared IndexedDB drafts. TASK-119 implements
fail-closed quarantine scanning, local OCR by default and explicitly configured BYOK
Vision extraction through retry-safe jobs. TASK-120 adds immutable field provenance,
98%-minimum confidence governance, prior-uploader authorization and system-attributed
receipt inbox submission. TASK-121 adds state-governed draft deletion, reasoned Void,
immutable posted/sealed correction versions, legal hold, paper custody and
records-manager plus distinct-Finance post-retention purge with a permanent hash
tombstone. TASK-122 adds purge-surviving, retry-stable audit for every sensitive
view/download/print/export and proves database/filesystem authorization, retention,
integrity, quarantine and tenant parity. TASK-123 adds confirmed effective-dated
expense category versions and immutable submission snapshots for Decimal-exact
tax/FX/account mappings, plus Finance-only clean-evidence actual-bank overrides.
TASK-124–135 are also complete, covering claim authoring, line-level approval,
duplicate/budget controls, corporate-card reconciliation, mileage/per diem/cash
advances, balanced posting, reimbursement payment batches and immutable tax-evidence
packages. Planned capabilities must not be represented as current Canonical behavior.

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
  scope; manager leave projections omit private reason facts. Receipt capture and
  employee-owned multi-line claim endpoints are now Canonical domain behavior.
  Offboarding revokes active sessions but retains statutory/audit history.
- **Leave policy calendar:** confirmed effective-dated work patterns, confirmed
  company holidays and HR-confirmed official imports determine chargeable working
  days. Leave units are full day or AM/PM half day; hourly leave is rejected.
- **Immutable leave balance:** tenant-scoped append-only grant, accrual, reservation,
  use, release, cancellation, adjustment, carry-forward, expiry and encashment facts
  project exact balance/reserved/available days. Pending paid leave serializes on the
  employee, reserves available entitlement and fails with an explicit paid/unpaid
  split when insufficient; approval or rejection appends consumption or release.
- **My Work shell:** My Leave, My Claims and My Receipts use the shared list SSOT.
  Team Calendar and My Approvals are present only when the actor context grants team
  scope; team rows omit private reasons/evidence. My Leave, Claims, Receipts,
  Approvals, Team Calendar and Receipt & Tax Evidence are Canonical current routes;
  each still enforces its own employee identity, permission and workflow boundary.
- **Governed approval:** confirmed effective-dated policy versions match employee,
  department, leave type, days, amount and currency before instantiating ordered
  direct-manager, named-employee or permission steps. Original authority is
  snapshotted, self-approval is forbidden, time-bounded delegation retains original
  authority, and immutable decisions/events distinguish direct, delegated and
  escalated actors. Capacity re-evaluates warn, add-level or block behavior.
- **Governed leave lifecycle:** every non-legacy request retains policy/calendar and
  immutable revision snapshots. Draft, Pending, Approved, Rejected, Withdrawn,
  Voided and Cancelled transitions require the expected version. Employee “delete”
  creates a reasoned Void tombstone; pending records withdraw, while approved records
  require a separately decided cancellation request. Manager list projections expose
  dates, duration and evidence state but never the private reason or document reference.
- **Full leave:** effective-dated work/holiday/leave policy, full-day/half-day units,
  immutable entitlement ledger, Pending reservation, versioned amendment/cancellation,
  multi-stage approval/delegation/capacity, role-redacted team calendar, protected
  medical evidence and Payroll sources for unpaid leave, approved cancellation and
  encashment. Payroll snapshots monthly base pay and applies each immutable source to
  at most one run; Legacy Policy rows retain their original day values.
- **Receipt evidence:** JPEG/PNG/HEIC/PDF only, maximum 20 MB and 20 PDF pages. Every
  file is quarantined until a fail-closed scan succeeds. Local OCR is default; external
  Vision is explicit company BYOK across three providers (`openai`, `google`,
  `openai_compatible` for OpenRouter/LM Studio/custom endpoints), the last optionally
  configured without a stored credential for endpoints that need none. Governed
  auto-submit requires every critical field at 98% confidence or above plus safety,
  amount and duplicate checks.
- **Expense claims:** employee-paid and company-paid evidence, multi-line claims,
  tax/GL/FX/category policy, manager + Finance line decisions, duplicate/budget
  control, card-statement matching, mileage/per diem/cash advances and final-approval
  balanced posting to Employee Payable or the configured company-paid account.
- **Payment and tax evidence:** encrypted employee payout profiles, distinct
  maker/checker bank-file batches, successful-line-only bank posting and immutable
  PDF/XLSX/CSV/ZIP/hash tax-support packages. The product does not call bank APIs or
  submit tax returns directly.
- **Record governance:** unsubmitted governed records use a reasoned Void-delete
  tombstone rather than physical erasure; submitted evidence uses state-dependent
  Void; posted/finalised evidence uses correction or reversal. Legal hold
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
- **i18n:** every system-authored browser UI string uses the en/ms/zh/ja/vi i18n
  layer. The current Web preference is browser-local (`aria-lang`), defaults to
  English and is orthogonal to company country. `app_user.language` remains reserved
  for compatibility and is not currently wired. ([I18N.md](I18N.md))
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
| Permission registry | `npm run check:permissions` | every PR and release |
| Authorization matrix | `npx vitest run src/api/permissionMatrix.integration.test.ts` + `npm run audit:access-matrix` | every authorization change |
| Schema parity | `npm run check:demo-schema` + `npm run check:drift` | every migration/release |

## EPIC-059 employee access and customer onboarding

Company roles, action permissions, data scopes, company module dependencies, atomic
Staff activation, deterministic enterprise Demo data and gated production Go Live are
binding requirements. The complete contract and compatibility rules are in
[EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md](EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md).

## 7. Authorization requirements

The binding current/target contract is
[ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md).

Implemented behavior remains `master -> company`, multiple company roles, Allow-union
permissions, assignment validity/revocation and assignment-owned
`self/team/department/company` scopes, company module state, tenant-bounded Superadmin
bypass and backend enforcement. `role_resource_scope` is retained as a dual-read
fallback for assignments with a null `scope_backfilled_at`. TASK-170 now implements the
separate platform-principal/support-grant control plane: platform operators use
dedicated hash-backed bearer/CSRF sessions and application-owned platform roles; grants
target an exact master and optional company, require reason and ticket, are
time-bounded/revocable, default-deny sensitive fields and audit every create/use/deny/
revoke event. Principal/session issuance remains an out-of-band deployment/SSO bootstrap
responsibility, and grant evaluation only returns a decision; it does not automatically
proxy tenant business data. TASK-171 now supplies the first approved registry slice and
TASK-172 supplies the assignment migration/service. TASK-173 is in progress and now
supplies the first central tenant decision boundary, explicit user-level overrides and
safe/audited explanations:

- route/resource/action declarations are now checked against an application-owned
  registry of 299 static definitions, with canonical projections for 116 resources,
  62 actions and 5 updates; existing broad keys remain explicit compatibility aliases
  until a later data migration and cutover;
- `authorize`, `authorizeWithin` and `hasAnyAuthorization` are the central decision
  entry points used by boolean permission wrappers, action/resource gates and approval
  permission checks;
- `user_permission_override` supports reasoned, valid and revocable explicit `allow`
  and `deny` rows. A matching deny wins before an allow, role grant or tenant-local
  Superadmin compatibility grant;
- public decision callers receive only a safe `{ allowed, reasonCode }` result, while
  the audit-read administrator explanation endpoint returns full assignment/role/
  override details and records an audit event.

The following approved requirements remain pending under TASK-173–175:

- strict permission-plus-active-workflow-authority behavior across every approval-like
  legacy path and complete resource/policy context;
- missing or unknown module/resource/action/policy/ownership state fails closed;
- authorization-version invalidation prevents stale role/scope/module/policy state;
- Company Owner uses explicit permissions instead of `is_superadmin` bypass;

Approval authorization must preserve the existing immutable version/instance/decision
model. The shared workflow locks the active instance/step, checks current permission
authority through the central evaluator, prevents self-approval and validates bounded
delegation. The HR management permission override remains a documented compatibility
escalation for an active pending step; the target contract still requires domain
permission, resource scope, current workflow-step authority, policy conditions and
separation-of-duties checks for every approval-like path.

## 8. August 2026 functional requirements

- Tenant-scoped employee and master-data edits use field allowlists, optimistic
  versions, audit and Demo/API parity.
- Sales enquiries, quotations and orders support repeatable stock and non-stock lines;
  only stock lines participate in delivery and inventory movement.
- Employee-workspace impersonation is active-company-only, audited and blocks sensitive
  activation actions; it is not platform support access.
- HR holidays follow draft, pending approval, confirmed and rejected governance. Only
  confirmed holidays affect leave calculation.
- Staff appointments are versioned retained facts combined with leave in bounded
  calendar reads. Recurrence is time-zone-aware and bounded; reminder/outbound jobs are
  durable, idempotent and revision-aware.
