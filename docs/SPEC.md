# SPEC — Contract of Record

This is the binding functional/technical contract. If code and this spec disagree,
either fix the code or change this spec in the same PR — never let them drift silently.
Deep dives live in the linked docs; this file is the index of *requirements*.

## 1. Product definition

A modular, multi-tenant ERP that runs in two modes from one codebase:

| Mode | Runtime | Data store | Users |
| --- | --- | --- | --- |
| **demo** | Static site (GitHub Pages / any static host) | PGlite (Postgres-WASM) persisted to IndexedDB; UI prefs in localStorage | Local personas/wizard identities in one browser; no server-auth or multi-user guarantee |
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
6. **Tax lookup is effective-dated.** Current commands resolve the tenant tax code/rate
   with `getEffectiveTaxRate(scope, taxCode, onDate)`, never a screen constant. Full SG
   GST versus MY SST engine mechanics and statutory outputs remain target design. All
   lookups must use a single `[valid_from, valid_to)` interval. Until TASK-204 closes the
   current boundary mismatch and regime-aware posting, MY SST must not be described as
   a compliant recoverable-input-tax engine. See [LOCALIZATION.md](LOCALIZATION.md).
7. **Governed AI/Vision secrets.** No provider key is shipped in source/build or placed
   in a `VITE_*` variable. The setup-wizard AI preview discards its key. Background
   document Vision may persist a tenant connector only as an encrypted server envelope;
   plaintext is never returned and is decrypted only at the worker call boundary. A
   general ERP chat assistant is not implemented. See [AI_PROVIDERS.md](AI_PROVIDERS.md).
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

- **Setup and provisioning** (TASK-009/010/024/059, EPIC-065): Demo can re-run its
  local wizard via reset. Production first run is Platform Superadmin registration only
  on a truly empty database; the retired anonymous tenant endpoint returns 410. The
  independent platform workspace then creates Master → Company → Master Admin and
  Company Owner with localized tax/control-plane/chart facts and inherited module
  allocation. `GET /api/setup/status` exposes staged state and public bootstrap closes
  after the first claim. Contract → [SETUP_WIZARD.md](SETUP_WIZARD.md).
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

The current route baseline is **129 Canonical / 0 Preview**. Of those routes, 128
declare API support; `staff-calendar` is the one current metadata exception tracked by
TASK-200. The old Mock-screen
statement from the early MVP is historical and no longer describes the shipped route
set: CRM, Manufacturing, Quality, HR, Payroll, Projects, Service, Fixed Assets, BI,
Integration and Admin now use Canonical data/contracts at the route boundary. A future
incomplete feature may be introduced only as an explicitly labelled `Preview · Sample
Data` or `Preview · Canonical Data` route, with write-like actions disabled until its
schema, resource/command, permission, tests and localization are complete.

Current source inventory (2026-08-12) is 129/0 routes, 1,545 English keys and 72 local
five-language packs. TASK-183 records the complete 129-route desktop/375px and
five-language browser proof; this review reran static audits only because local
Playwright Chromium is absent. Dated browser and current static evidence must not be
collapsed into a fresh full-matrix claim.
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
  for compatibility and is not currently wired. Current static inventory is 1,545
  English keys / 72 local packs; TASK-183 retains the dated 129-route × 5-language ×
  2-viewport browser evidence.
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

Current review evidence (2026-08-12): schema v98/99 migrations/249-table parity,
Demo-pack, permission, static i18n and Demo build gates pass; 7 focused files / 22 tests
pass. HEAD collects 170 files / 666 tests but the full collection was not executed in
this review. Earlier 168-file/663-test, browser-matrix, PostgreSQL and deployment results
remain dated checkpoints. Current public `/health` and setup probes returned 502, and
the HEAD GitHub Actions run started no jobs because billing/spending blocked it.
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
  revoke event. Interactive Platform Superadmin login and the locked empty-database
  bootstrap are implemented; other principal creation/SSO remains an operational
  responsibility. Grant evaluation only returns a decision; it does not automatically
proxy tenant business data. TASK-171 now supplies the first approved registry slice and
TASK-172 supplies the assignment migration/service. TASK-173 is complete and supplies
the central tenant decision boundary, explicit user-level overrides, safe/audited
explanations and strict current-step approval context:

- route/resource/action declarations are now checked against an application-owned
  registry of 314 definitions, with canonical projections for 116 resources,
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

## 9. Expenses & Tax v1 contract (core implemented; hardening pending)

The official v1 product name is **Expenses & Tax** and its only primary workflow is
**Company Receipts**. The current `my-receipts` route remains an actor-owned secure
capture foundation and compatibility surface; it is not a company receipt register.
TASK-177–179 implement migrations 0090–0092, the Company Receipt schema/commands,
uploader-scoped mutations and confirmation, explicit own/company list/detail reads,
exact-hash duplicate prevention, Demo/API adapters and a responsive five-language
Company Receipts register. TASK-180 search/date-range behavior and TASK-181's immutable
Receipt Pack are current. TASK-182 now applies the platform-owned module
entitlement/canonical permission cutover. TASK-183 is complete: the register now
offers a canonical confirmation entry that selects uploader-owned
My Receipts evidence, reads immutable confirmation facts and submits only the user's
confirmed metadata through the shared Demo/API adapter contract. An authenticated
same-origin API-mode browser journey passes against an isolated PGlite fixture at desktop
and 375px, and against a newly created disposable PostgreSQL 16 database. These are
release-verification fixtures. TASK-192 later deployed migrations through 0098 and then
reset production to first-run state; no authenticated production Company Receipt UAT or
data is claimed.

The current and future implementation must satisfy these binding requirements:

- A Company Receipt belongs to the active `masterFn` and `companyFn`. The Session
  supplies both values; client-supplied tenant identifiers are never trusted.
- The receipt references the preserved managed-document version/hash and records the
  uploader for audit. Direct domain/API saving must not require an Employee identity,
  Expense Claim, reimbursement, approval, bank account, GL posting or tax decision.
  The current normal browser picker nevertheless depends on `/api/my/receipts`,
  `employee.self.read` and a linked Employee; TASK-197 must remove that dependency or
  make the narrower supported product boundary explicit.
- JPEG, PNG, HEIC/HEIF and PDF use the existing magic-byte/MIME/extension validation,
  20 MB limit, 20-page PDF limit, fail-closed scan, extraction provenance, duplicate
  hash and governed document lifecycle.
- Users confirm or correct merchant, receipt/invoice number, `transaction_date`,
  amount, currency, category, business purpose and notes. OCR remains a suggestion;
  extraction failure cannot block manual completion after the document is safe. OCR
  candidates retain source, model, confidence and review state and are never rewritten
  by confirmed metadata.
- The browser confirmation entry may list only the signed-in uploader's receipt evidence
  and calls `GET /api/company-receipts/confirmations/:documentVersionId` followed by the
  canonical create action. It does not accept an evidence owner, Master or Company from
  the browser. A static Demo upload remains quarantined when no scanner exists; only a
  clean scan result can enable confirmation.
- Register list/detail reads require explicit `expenses.company_receipts.read_own` or
  `expenses.company_receipts.read_company`; the API resolves that permission before
  passing `own | company` visibility to tenant-scoped domain queries. Reads are bounded
  to 1–100 rows and cursor-paginated. TASK-180 applies search/date predicates before
  pagination. Confirmation/create require `expenses.company_receipts.create`, update
  requires `.edit`, and void requires `.void`; `employee.receipts.write` cannot authorize
  those Company Receipt operations.
- Date filters are inclusive business dates:
  `from <= transaction_date <= to`. Missing dates are visible and excluded from a
  date-range package. The current badge only navigates to My Receipts and is not a
  metadata-correction workflow; TASK-197 owns that requirement. Browser presets
  currently use browser-local time rather than a configured Company calendar.
- Preview/export retrieves every ready, dated match, not only the visible page, and
  rejects empty/invalid selections before writing a snapshot. Migration 0093 stores an
  immutable creator-owned snapshot of filters, chronological rows, document identities,
  source hash and exact per-currency totals, bounded to 5,000 receipts and 250 MB of
  source evidence at render time. The same no-store PDF drives preview, download and
  Print: an A4 landscape register precedes copied multi-page PDFs and embedded JPEG/PNG
  originals; unsupported formats receive an explicit identity placeholder. Access and
  render actions must reapply the exact current visibility required by the snapshot,
  tenant/creator scope, scan-clean state, document-version identity and content hash.
  Current code checks only any receipt-read permission plus creator, so a
  `read_company` → `read_own` downgrade can retain a company-wide Pack; TASK-196 is P0.
  Currencies are never summed together.
- Demo/PGlite and PostgreSQL/API modes implement one contract. `expenses_tax` availability
  is platform-owned `Master enabled AND Company allocated`; missing or disabled state
  returns `module_not_enabled` before the canonical resource/action permission,
  `accessMatrix`, RLS, audit, five-language UI and mobile/desktop behavior evaluation.

The current Tax Evidence generator cannot be relabelled as this feature: it selects
posted `expense_claim` lines by posting date and its Demo adapter leaves package
generation API-only. Its document-loading and PDF composition code may be reused after
Company Receipts now has that standalone query/snapshot contract; only the reusable
document/PDF primitive is shared with Tax Evidence, not claim or tax semantics.

## 10. Platform Module Entitlement contract (tenant cutover and platform workspace implemented)

TASK-185/186 implement the commercial entitlement and tenant enforcement boundary.
Company Owner has no MAC read/mutation authority. The deprecated
`admin.modules.manage` code is registry-recognized only for migration/audit history and
is non-assignable; migration 0095 removes role grants and revokes active overrides.
Legacy tenant MAC endpoints return 403 `platform_authority_required` without state.

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
  `platform.modules.read/manage` may read or mutate commercial entitlement; its separate
  `platform.simulation.manage` permission is required to select or enter a tenant-user
  simulation. Support roles receive neither authority.
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

TASK-185 implements the Module Catalog, migration 0094, versioned Master/default and
Company allocation rows, hard-dependency validation, independent platform read/manage
permissions, CSRF/version/correlation/audit-protected APIs, authorization invalidation
and deterministic Demo fixtures. TASK-186 adds migration 0095, makes tenant module
projection and enforcement depend on both stored layers, retires the permission/API/UI,
removes the onboarding module stage and applies Master defaults to new Companies.
TASK-187 adds migration 0096, independent platform password login, one-hour
non-remembered `erp_platform_session`/CSRF cookies, the shared API-mode realm chooser,
Master/Company workspace and a default 15-minute (never beyond the parent session)
exact-user simulation. It never creates `app_user` or `erp_session`; the simulation row
is immediately revocable and all existing tenant `appendAudit` calls inherit the real
platform principal while retaining the target actor. TASK-188 completed the recorded
automated release-gate proof. Implementation tests and fixtures remain distinct from
human UAT and do not authorize a production release or migration.

## 11. Platform Bootstrap & Tenant Provisioning contract (EPIC-065)

Production first run is permitted only when `platform_principal`, Master, Company,
`app_user`, memberships/role assignments and the production setup-state row are all
empty. A locked transaction accepts one tokenless
`POST /api/setup/platform-superadmin/actions/complete`; it creates an independent
Platform Superadmin password/session and `__platform__` audit evidence, then closes the
public path. Concurrent, replay, partial and non-empty requests return `409
already_initialized`. The retired anonymous tenant endpoint returns `410
legacy_setup_disabled`. `GET /api/setup/status` reports staged bootstrap facts.

The Platform Superadmin then:

1. creates a server-generated Master from a unique login code and commercial Module
   Catalog entitlement/default allocation;
2. creates the first SG/MY Company in one transaction with localization/tax,
   control-plane, chart-of-accounts, inherited allocation and live onboarding facts;
3. supplies distinct initial credentials for an immutable Master Admin and Company Owner.

Later Companies receive a new Owner and a system-managed membership/role assignment for
the durable Master Admin identity. Master Admin permissions are exactly dashboard read,
company switch, user invite/read/manage, role read/write, audit read and settings
read/manage. They do not include business modules, workflow/approval, payment, payroll,
MAC, support, simulation or any `platform.*` permission. Company Owner retains the
explicit tenant model and cannot mutate MAC. Platform mutations require independent
session, Platform CSRF, request ID, `Idempotency-Key`, duplicate conflict detection and
append-only audit; response replays never store plaintext passwords. Password reset email
is deferred while SMTP is unset (TASK-193 blocked).

The implementation is not yet production-RLS complete. `runPlatformMutation` does not
set `app.master_fn`/`app.company_fn` before current Company provisioning writes
RLS-protected tenant tables, while bundled Compose may use the PostgreSQL bootstrap
superuser and bypass FORCE RLS. Before this path may be called production-ready,
TASK-195 must provide explicit non-superuser/non-BYPASSRLS runtime roles and execute the
current Platform bootstrap → Master → Company journey against PostgreSQL RLS.

## 12. Production Trust & ERP Excellence requirements (EPIC-066)

The source-backed priority review is
[ERP_EXCELLENCE_REVIEW.md](ERP_EXCELLENCE_REVIEW.md). The following are binding release
requirements, not optional polish:

- **Isolation:** production API/worker credentials are least-privilege, non-superuser,
  non-BYPASSRLS; every tenant read/write, including Platform provisioning, establishes
  exact server-owned context; cross-tenant PostgreSQL tests exercise current routes.
- **Snapshot authorization:** access to an immutable artifact requires current authority
  at least as strong as the frozen visibility. Losing `read_company` invalidates access
  to company-wide Receipt Packs even when the creator retains `read_own`.
- **Privileged access:** Support Grant versus Superadmin Simulation is one explicit
  policy; no undocumented exception may expose tenant data. Platform provisioning, MAC
  and simulation require MFA, recent step-up, bounded sessions and dual attribution.
- **Truthful UI:** actions are capability-hidden or disabled with an accessible reason;
  every advertised correction/edit/void control reaches a real versioned command in
  both data modes.
- **Release evidence:** source-present, tests-collected, tests-passed, deployed revision
  and currently healthy are separate states. A zero-step CI run or historical probe is
  never a green current gate.
- **Operations:** declare and prove availability/error/latency SLOs, RPO/RTO, backup and
  document restore, worker backlog/dead-letter alerts, scale budgets and incident/rollback
  ownership before production expansion.
- **Business correctness:** browser money stays Decimal-safe; date presets use the
  Company calendar; exported Unicode/localized documents and retention/legal-hold rules
  are tested as domain requirements.
- **Tax mechanics:** validity intervals are identical across repositories/policies, and
  GL posting dispatches by Company regime plus governed classification. Malaysia SST
  cannot reuse Singapore GST recoverable-input-tax behavior by default; official-source
  configuration and tax-owner approval are release evidence (TASK-204).
- **Governed Vision:** direct gateway/provider failure, retry and selected manual/local
  fallback semantics are tested; encrypted connector capability is never presented as
  proof of a configured third-party production account or region (TASK-205).
