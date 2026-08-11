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

Current verification boundary (2026-08-10): `npm run audit:screens` passes all 128
routes at desktop and 375 px with 128 Canonical / 0 Preview and no layout/behavior
contract failures. The full i18n audit passes 1,533 canonical keys / 69 local
five-language packs across 128 routes × 5 languages × 2 viewports with zero blocking
findings. Desktop/mobile smoke, PWA update and access-matrix gates also pass.
Business-record values remain outside system-authored UI copy.

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
  for compatibility and is not currently wired. The 2026-08-10 static audit passes
  1,533 canonical keys / 69 local packs across the full 128-route × 5-language ×
  2-viewport browser matrix.
  Business-record values remain outside system-authored UI copy. ([I18N.md](I18N.md))
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
| Five-language route audit | `npm run audit:i18n` | every Canonical route/localization change and before release |

Current release evidence (2026-08-10): the purchase-requisition Web adapter uses the
actor-input command shape. Typecheck, lint, serial `npm run build:demo`,
`npm run audit:access-matrix`, permission/schema/drift checks, `npm run smoke` at
desktop/mobile and `npm run audit:pwa-update` pass. The full Vitest run is green at
156 passed files plus 1 skipped file (635 passed, 1 skipped tests). The full i18n
browser matrix is green at 128 routes × 5 languages × 2 viewports over 1,533 canonical
keys and 69 local packs. Disposable PostgreSQL 16 parity, true concurrency and
RLS/security proof passed; the target database was backed up, migrations 0084–0089
were applied, production RLS was re-applied, and the application release completed.
Public verification returned `/health` 200, root 200 and unauthenticated session 401.
Physical-device PWA acceptance remains a separate human gate.

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
`self/team/department/company` scopes, company module state, explicit company-scoped
Company Owner permissions and backend enforcement. `role_resource_scope` is retained as
a dual-read
fallback for assignments with a null `scope_backfilled_at`. TASK-170 now implements the
separate platform-principal/support-grant control plane: platform operators use
dedicated hash-backed bearer/CSRF sessions and application-owned platform roles; grants
target an exact master and optional company, require reason and ticket, are
time-bounded/revocable, default-deny sensitive fields and audit every create/use/deny/
revoke event. Principal/session issuance remains an out-of-band deployment/SSO bootstrap
responsibility, and grant evaluation only returns a decision; it does not automatically
proxy tenant business data. TASK-171 now supplies the first approved registry slice and
TASK-172 supplies the assignment migration/service. TASK-173 is complete and supplies
the central tenant decision boundary, explicit user-level overrides, safe/audited
explanations and strict current-step approval context:

- route/resource/action declarations are now checked against an application-owned
  registry of 303 static definitions after TASK-179, with canonical projections for 116 resources,
  62 actions and 5 updates; existing broad keys remain explicit compatibility aliases
  until a later data migration and cutover;
- `authorize`, `authorizeWithin` and `hasAnyAuthorization` are the central decision
  entry points used by boolean permission wrappers, action/resource gates and approval
  permission checks;
- `user_permission_override` supports reasoned, valid and revocable explicit `allow`
  and `deny` rows. A matching deny wins before an allow or role grant; the legacy
  tenant-local Superadmin flag is not an authorization source;
- public decision callers receive only a safe `{ allowed, reasonCode }` result, while
  the audit-read administrator explanation endpoint returns full assignment/role/
  override details and records an audit event.
- direct Sales Order and Purchase Order approve/reject actions now require the dedicated
  registered `sales.approve`/`purchasing.approve` permission in both the API action
  definition and the domain command; the command also requires the tenant-scoped order
  and approval row to remain pending before changing either record.
- Purchase Requisition approve/reject actions now require the registered
  `purchasing.approve` permission in both the API action definition and the domain
  command; the command validates the active tenant actor and only changes a locked
  requisition whose existing status is `submitted`. This legacy path has no generic
  approval instance/step yet.
- Sales Commission run approval now requires the registered
  `sales.commission.approve` permission in the domain command as well as the API action
  definition; it validates the active tenant actor and only changes a locked run whose
  existing status is `draft`. Its versioned header snapshot is the current legacy
  workflow authority, not a generic approval instance/step.
- Allowance calculation approval now re-checks the existing
  `expenses.allowance.manage` permission in the domain command before changing a locked
  `calculated` calculation. Its calculation status is the current legacy workflow
  authority; no generic approval instance/step is introduced.
- Budget approval now re-checks `finance.budget.approve` in the domain command before
  changing a draft budget. The existing draft/approved status, active flag, version and
  imported lines remain its workflow authority; no generic approval instance/step is
  introduced. Direct-domain denial maps to the API's stable 403 response.
- Governed HR leave and expense approval decisions require the permission authority of
  the locked current step, when the step is permission-based, and pass the resolved
  resource/module/scope context plus policy-version, approval-instance and step
  identifiers into the central evaluator. The active step must belong to the instance
  policy snapshot; named direct authorities must be active employees. There is no
  management `hr.write` takeover and no implicit migration of older in-flight
  instances; the stored snapshot remains authoritative. Delegation remains bounded by
  tenant/domain/authority/delegate/time/revocation and is not yet instance/step/
  resource/policy-bound.

The following approved requirements remain pending as later hardening:

- instance/step/resource/policy-bound delegation and any additional approval domain
  mappings not yet registered in the central workflow context;
- additional approval-domain mappings and deeper delegation bindings must continue to
  fail closed when resource/action/policy/ownership context is missing;
- migration 0088 adds a company-scoped authorization version. Core role, assignment,
  scope, module, override and invitation writers bump it atomically, and session/
  effective-capability projections expose it. TASK-174 adds Master-wide support bumps,
  a fail-closed client marker on every authenticated API request, session-only recovery
  and direct-URL revocation proof. Server organization and workflow-policy decisions
  remain uncached current-row evaluations;

Approval authorization must preserve the existing immutable version/instance/decision
model. The shared workflow locks the active instance/step, checks current permission
authority through the central evaluator, prevents self-approval and validates bounded
delegation. The current contract requires domain permission, resource scope, current
workflow-step authority and policy conditions for every mapped approval-like path;
deeper delegation binding and separation-of-duties rules remain later target work.

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

## 9. Expenses & Tax v1 contract (approved; backend foundation implemented)

The official v1 product name is **Expenses & Tax** and its only primary workflow is
**Company Receipts**. The current `my-receipts` route remains an actor-owned secure
capture foundation and compatibility surface; it is not a company receipt register.
TASK-177–179 implement migrations 0090–0092, the Company Receipt schema/commands,
uploader-scoped mutations and confirmation, explicit own/company list/detail reads,
exact-hash duplicate prevention, Demo/API adapters and a responsive five-language
Company Receipts register. TASK-180 search/date-range behavior is current; Receipt Pack and the final
platform-owned module entitlement/canonical permission cutover remain pending.

The future implementation must satisfy these binding requirements:

- A Company Receipt belongs to the active `masterFn` and `companyFn`. The Session
  supplies both values; client-supplied tenant identifiers are never trusted.
- The receipt references the preserved managed-document version/hash and records the
  uploader for audit, but saving must not require an Employee identity, Expense Claim,
  reimbursement, approval, bank account, GL posting or tax decision.
- JPEG, PNG, HEIC/HEIF and PDF use the existing magic-byte/MIME/extension validation,
  20 MB limit, 20-page PDF limit, fail-closed scan, extraction provenance, duplicate
  hash and governed document lifecycle.
- Users confirm or correct merchant, receipt/invoice number, `transaction_date`,
  amount, currency, category, business purpose and notes. OCR remains a suggestion;
  extraction failure cannot block manual completion after the document is safe. OCR
  candidates retain source, model, confidence and review state and are never rewritten
  by confirmed metadata.
- Register list/detail reads require explicit `expenses.company_receipts.read_own` or
  `expenses.company_receipts.read_company`; the API resolves that permission before
  passing `own | company` visibility to tenant-scoped domain queries. Reads are bounded
  to 1–100 rows and cursor-paginated. TASK-180 applies search/date predicates before pagination, and
  TASK-182 owns the final compatibility-to-canonical permission and entitlement cutover.
- Date filters are inclusive company-local business dates:
  `from <= transaction_date <= to`. Missing dates are visible and excluded from a
  date-range package until corrected.
- Preview/export retrieves every matching receipt, not only the visible page. The
  Receipt Pack contains a register followed by readable originals ordered by
  transaction date. Totals are grouped by currency; currencies are never summed
  together. Browser Print uses the same A4-oriented preview without application chrome.
- Demo/PGlite and PostgreSQL/API modes implement one contract. Module entitlement,
  route guards, canonical resource/action permissions, `accessMatrix`, RLS, audit,
  five-language UI and mobile/desktop behavior must fail closed together.

The current Tax Evidence generator cannot be relabelled as this feature: it selects
posted `expense_claim` lines by posting date and its Demo adapter leaves package
generation API-only. Its document-loading and PDF composition code may be reused after
Company Receipts receives a standalone query/snapshot contract.

## 10. Platform Module Entitlement contract (approved, not implemented)

Current implementation remains tenant-controlled: Company Owner holds
`admin.modules.manage`, `/api/admin/modules` mutates active-Company `company_module`,
and the tenant Module Activation screen exposes that API. Current server-side disabled-
module enforcement is Canonical and must be preserved, but this mutation owner is not
the approved commercial model.

EPIC-064 requires:

- effective access = authenticated target user AND correct Master/Company boundary AND
  Master entitlement enabled AND Company allocation enabled AND registered permission
  AND data scope AND workflow/business authority;
- `master_module` is the Master purchased-module entitlement and `company_module` is
  the platform-owned Company allocation. Missing or unknown state fails with 403
  `module_not_enabled`; Master disable masks without rewriting Company allocation;
- migration initializes Master entitlement from the union of current Company-enabled
  state and retains each Company row so no existing effective access changes;
- each Master defines one default allocation set for new Companies. Tenant onboarding
  does not choose modules;
- only business modules are sellable. Dashboard/Home, My Work, Admin, Settings and
  Account/Notifications are baseline services;
- only the independent `platform_superadmin` role with
  `platform.modules.read/manage` may read or mutate commercial entitlement.
  `admin.modules.manage` becomes deprecated/non-assignable and no tenant API consumes it;
- platform mutations require the separate platform session, CSRF, expected version,
  correlation and before/after audit. v1 applies immediately without reason/ticket or
  maker-checker;
- the shared visual login offers a separate platform realm using independent password
  credentials and a non-remembered session of at most one hour. It does not create an
  `app_user` or tenant session;
- explicit user simulation may target any active user in the selected Master/Company.
  It may perform exactly the target user's allowed writes, never unions platform power,
  remains visibly marked/revocable/expiring, and audits `actorUserId` plus
  `platformPrincipalId`. MAC writes remain platform-workspace-only.

TASK-184 records this contract. TASK-185–188 own implementation and proof; TASK-174 is
the prerequisite stale-authorization boundary. No current status or test may describe
this target as delivered before TASK-188.
