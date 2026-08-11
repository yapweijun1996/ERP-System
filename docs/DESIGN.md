# DESIGN — How the system is built

Working-level design notes for whoever (human or AI agent) writes the next line of
code. Architecture rationale lives in [ARCHITECTURE.md](ARCHITECTURE.md); this file is
the practical map: where things are, how they connect, and the traps.

## 1. Repository layout

```
src/                     Canonical core (TypeScript, isomorphic)
  data/schema/           Drizzle schema — THE single source of truth (domain files)
  data/seed.ts           Canonical seed (Acme SG / Acme MY)
  data/db.ts             createPgliteDb() | createPostgresDb(url)
  data/repo.ts           Query helpers (listCompanies, getEffectiveTaxRate, …)
  modules/*/             Shared domain commands (Demo + production API)
  api/                   Resource registry, creates/actions and HTTP routes
  auth/                  Session, CSRF, RBAC, token and audit services
  demo.ts                Proof script: asserts invariants, exit≠0 on failure
drizzle/                 Ordered generated migrations + snapshots/journal
web/                     Frontend (Vite wrapper around a static app)
  index.html             App shell; loads ~60 classic <script> tags
  public/assets/         app.js (hash router), ui.js (SCREENS registry),
                         Demo/API ErpSystemData adapters, data-*.js (Preview only),
                         screens-*.js (~50 screen modules)
  src/                   Bundled Demo ESM runtime for PGlite/Drizzle commands
  public/db/             Generated migration-derived PGlite boot/upgrade SQL
  public/sw.js, manifest.webmanifest, pwa.js
tasks/tasks.jsonl        Work queue (one JSON task per line)
docs/                    This documentation suite
```

## 2. Frontend design (current, deliberate)

- **No framework.** Vanilla JS, ES5-ish, loaded as classic scripts. Vite is used only
  to bundle/copy `public/` to `dist/` and set the Pages base path. Do not introduce
  React/Vue piecemeal; a framework migration is a roadmap decision, not a task.
- **Routing:** hash router in `app.js` (`navigate()`); routes come from `DB.nav`
  (`data-core.js`). A screen = an entry in the global `SCREENS` registry
  (`SCREENS['route-name'] = () => html`), registered by each `screens-*.js` file.
- **Data flow:** Canonical screens call the formal `window.ErpSystemData` contract and
  map bounded resource pages into their view models. Demo mode executes against
  browser PGlite; API mode calls the authenticated Express API and never falls back to
  sample data. Preview routes may still read `data-*.js`, but `SCREEN_META` labels them
  `Preview · Sample Data` and locks write-like controls.
- **Writes:** Canonical UI actions use `ErpSystemData.create/update/action`. Demo mode
  invokes bundled TypeScript `*Within` commands against PGlite; API mode invokes the
  same commands through the transactional resource/action dispatcher. `refresh()` or
  a bounded re-query updates the visible screen after success.
- **Adding a screen (golden path):**
  1. Add nav entry in `data-core.js` (if new route).
  2. Create/extend a `screens-<module>.js` registering `SCREENS['<route>']`.
  3. Register the resource/create/action metadata and expose it through both adapters;
     load it with `ErpSystemData` from the screen's async `prepare` function.
  4. Add the `<script>` tag to `web/index.html` (order matters: data → adapter →
     screens → app).
  5. Add five-language copy, set the route Canonical only after Demo/API parity, then
     run the type/test/schema/build/current-route gates and live desktop + 375 px checks.

Current release verification (2026-08-10): `npm run audit:screens` is green for all
128 registered routes at desktop and 375 px (128 Canonical / 0 Preview, no console/page
errors, and no active-tab, layout, action-bar or declared-contract failures). The full
i18n matrix is green: 1,533 canonical keys across 69 local five-language packs and
128 routes × 5 languages × 2 viewports. `npm run smoke` passes at desktop and mobile;
the visible-only navigation-badge contract is explicit, so hidden zero-count badges do
not fail the dashboard assertion. `npm run audit:pwa-update`,
`npm run audit:access-matrix` and the permission/schema/drift gates also pass. The full
Vitest baseline is 156 passed files plus 1 skipped file (635 passed, 1 skipped tests).
Business-record values are not treated as UI copy. Physical-device acceptance remains
separate from the automated 375 px browser gate.

## 3. Data layer design

- **Two runtimes, one schema.** `src/data/db.ts` returns a Drizzle instance backed by
  PGlite (demo/tests) or node-postgres (production). `src/demo.ts` proves both paths.
- **The seam.** `window.ErpSystemData` exposes
  `list/get/create/update/action/refresh/session/switchCompany/auth`. The demo adapter
  uses the Vite-bundled PGlite/Drizzle runtime; the API adapter uses relative `/api`
  requests. `VITE_DATA_MODE` selects exactly one implementation at build time.
  `window.ErpSystemDemo` remains only as a migration compatibility alias and must not
  be used by newly Canonical screens.
- **Schema synchronization is generated.** `scripts/generate-demo-schema.mjs` derives
  fresh and upgrade SQL from the ordered Drizzle journal. `check:demo-schema` and
  `check:drift` fail CI if the browser bundle or exported tables diverge. Seed data and
  Canonical business writes run the same TypeScript functions in both engines; do not
  add browser-only business SQL.
- **Persistence:** PGlite database at `idb://erp-system-demo` (IndexedDB).
  localStorage holds small prefs (theme/UI state), never business data. Reset =
  drop IndexedDB database + re-run schema/seed SQL.
- **Failure behavior:** Canonical routes show a retryable error state when their active
  adapter fails. Only routes explicitly marked Preview may render sample data.

## 4. Transaction design (the heart of the system)

`confirmOrder` (both implementations) must keep this exact order inside ONE transaction:

1. `SELECT … FOR UPDATE` stock rows (PGlite: same SQL; real concurrency only on PG)
2. Validate quantity — insufficient → throw `InsufficientStockError` → full rollback
3. `UPDATE stock_level` (deduct) + `INSERT stock_movement`
4. `UPDATE sales_order.status = 'confirmed'`
5. `INSERT invoice`
6. `INSERT gl_entry` legs — must balance (AR debit = revenue + tax credits)

Seed ships SO-2 (confirmable) and SO-3 (intentionally over stock) to demo both paths.
`src/demo.ts` additionally runs a true-concurrency over-sell race when pointed at
PostgreSQL — exactly one writer may win.

Every other state-changing command follows the same boundary: validate tenant and
state, lock the authoritative rows when races matter, append immutable facts (stock,
GL, audit/outbox), update projections/status, and commit once. The action dispatcher
adds permission, optimistic-version, idempotency and audit handling around that same
transaction. Purchasing sourcing is intentionally pre-accounting: RFQ issue, supplier
quote receipt and quote award create no stock or GL entries; award atomically creates
one linked pending-approval PO, marks the winner converted, rejects competitors and
closes the RFQ.
Every newly-created PO now starts `pending_approval` with exactly one
`purchase_order_approval` row. An authorised approve/reject decision locks both rows,
requires an auditable note, snapshots the deciding user, increments versions and changes
only the document/approval states. Approval is deliberately stock- and GL-neutral;
`receiveGoods` accepts only an approved/open PO, so inventory begins at receipt and
accounting begins at supplier-invoice posting.

Direct and quotation-converted sales orders follow the symmetric commercial gate. Order
creation validates tenant-owned customers/products, snapshots the effective tax on every
line and inserts exactly one `sales_order_approval` row in the same transaction. Orders
remain `pending_approval` until an authorised actor records a required note. Approval
changes the order to `draft`; rejection changes it to `rejected`. Neither decision writes
stock, delivery, invoice or GL facts. Only the existing draft confirmation command may
cross the fulfilment/accounting boundary, preserving one authoritative posting path.

## 5. Production design (implemented — EPIC-005 onward)

```
[browser] ──static──> web (nginx or static host, same web/dist bundle)
    │ fetch /api/*
    ▼
   api (Node, Drizzle + pg, runs src/modules/* server-side)
    │ DATABASE_URL
    ▼
   db (PostgreSQL 16+, drizzle migrations, RLS as defense-in-depth)
```

- API is the only writer for stock/money. Session (cookie) carries tenant scope.
- **`docker-compose.yml` + `docker-compose.production.yml` + `Dockerfile.api` +
  `web/Dockerfile` + `web/nginx.conf`**
  (TASK-012) implement the diagram above for real: `db` = `postgres:16-alpine`,
  `api` = `Dockerfile.api` (repo-root context — no separate `api/` workspace, ships
  devDependencies since `tsx`/`drizzle-kit` run untranspiled), `web` = multi-stage
  (`node:20-alpine` builds `VITE_DATA_MODE=api` → `nginx:alpine` serves it, reverse-
  proxying `/health` and `/api/*` to `api` over the Compose network — this is *why*
  `erp-system-api-adapter.js`'s `API_BASE` defaults to a relative `/api`: same-origin,
  zero CORS). Host ports default to the documented 8080/3000/5432 but are overridable
  (`WEB_PORT`/`API_PORT`/`DB_PORT`) for machines where those are already taken.
  `Makefile`/`scripts/setup.sh` targets were written to match this shape. The production
  release path is intentionally split: `deploy/release.sh` rebuilds only web/api, while
  `deploy/migrate.sh` is the explicit, reviewed database-change path.
- **`src/server.ts`** is the real API — run with `DATABASE_URL=... npm run server`
  locally, or as the `api` service in Docker. Besides health/auth/dashboard it
  exposes allowlisted resources plus registered create/action handlers. Reads are
  session-tenant-scoped and keyset-paginated; writes derive tenant scope from the
  database session and run shared commands with RBAC, CSRF, idempotency and audit.
  Remaining Preview business areas still require their own schema and commands before
  they may join this API surface.
- **Local Postgres proof** (no Docker required): `createdb erp_system_proof` against
  PostgreSQL 16+, then point `POSTGRES_URL` at that empty database and run `npm run
  demo`. Do not migrate or seed it first: the proof's read-only preflight requires zero
  user tables, then owns migration and seed. Reusing the populated database fails before
  writes by design; drop/recreate only this dedicated proof database for another passing
  run. Never point the proof at a database you did not create for this purpose.
- Deployment tuning and backup strategy → [DEPLOYMENT.md](DEPLOYMENT.md),
  [IMPORT_EXPORT.md](IMPORT_EXPORT.md).

## 6. Design decisions log

| Decision | Why | Ref |
| --- | --- | --- |
| PGlite over Dexie/localStorage for demo data | Real Postgres SQL in browser → zero dialect drift with production | ARCHITECTURE.md |
| Vanilla JS + SCREENS registry (no framework) | Prototype velocity; framework migration deferred until module set stabilizes | FRONTEND_PLAN.md |
| `master_fn` → `company_fn` → `user_id` tenancy, app-level scoping + optional RLS | Shared schema multi-tenant, SG+MY from one deploy | MULTI_TENANCY.md |
| Tax as effective-dated rules table | SG GST vs MY SST divergence without code branches | LOCALIZATION.md |
| BYOK AI keys, never build-time vars | Demo is a public static bundle — any bundled key leaks | AI_PROVIDERS.md |
| `web/dist/` gitignored, built by CI | Reproducible from source; no drift between repo and deploy | STATUS.md debt #3 |
| Vendor performance is a rebuildable read model, not a scored table | Supplier ratings must reconcile to real orders, receipts, invoices, returns and active contracts; no disconnected KPI can become a sourcing decision | EPIC-034 |
| Purchasing dashboards/reports use bounded derived resources, not KPI tables | Operational totals, approved-buyer spend and document-state reports must change immediately with canonical procure-to-pay facts; supplier-invoice variance stays at honest immutable header level until invoice lines become a domain table | EPIC-035 |
| Sales analytics are rebuilt from commercial documents, not KPI/target tables | Revenue must reconcile posted invoices minus credits plus debits, while customer ownership and document status remain traceable to current canonical facts; unavailable target/forecast data is disclosed rather than fabricated | EPIC-037 |
| Shared sales transaction state stores identifiers, never presentation records | `txn-view` re-reads one tenant-scoped enquiry plus its linked quotation from the formal adapter; document types with dedicated Canonical workspaces are dispatched there instead of retaining a second generic detail model | EPIC-039 |
| Manual journals use immutable header/line facts with separately numbered reversals | A draft has no GL effect; posting appends balanced dated GL legs and freezes the journal; correction swaps debit/credit into a new linked posted journal instead of editing history | EPIC-040 |
| Bank reconciliation links statement facts to GL; it does not auto-book | Imported signed lines must foot from opening to closing and each may match one exact immutable bank-account GL leg. Missing fees or interest first use the real journal workflow; completed statements are locked | EPIC-041 |
| Management BI is a bounded rebuildable cross-module read model | Revenue, receivables, payables, cash and inventory must reconcile to current Canonical facts rather than a KPI table. Product-category revenue only allocates traceable invoice/credit lines, and stock age is disclosed as days since the latest inbound movement because FIFO cost layers are not stored | EPIC-042 |
| Product master creation is stock-neutral | A product record defines identity, units, category, planning values and standard cost only. It must never create an opening balance or write a stock projection directly; initial physical quantity enters through the same auditable movement commands as every later receipt or adjustment | EPIC-043 |
| Project time is an actor-owned append/void fact | The signed-in Session supplies the user identity; entries target an open tenant project and store Decimal hours on a real date. A correction marks the original row void with a reason, preserving its actor, project and hours. Weekly approval, capacity and payroll state remain absent until those domains exist | EPIC-044 |
| Integration delivery visibility is a sanitized outbox projection | Operators may see tenant-scoped topic, aggregate reference, safe status, attempts and timestamps. Payload, recipients/tokens, raw transport errors and worker identity never leave the server; retry remains worker-owned until a separately authorised connector-control domain exists | EPIC-045 |
| End-user customer CSV import is a bounded staged job, not arbitrary file storage | Each job accepts only `code,name,industry`, at most 250 rows and an explicit update-or-skip duplicate policy. Validation persists normalized row facts and row-level errors before one atomic run; invalid rows remain inspectable, tenant fields are rejected and larger/other-module imports remain an explicit future boundary | EPIC-046 |
| Personal activity is a sanitized actor-owned audit projection, not a security/session center | Session fixes tenant, company and actor scope. The public read model maps raw audit vocabulary to bounded category/entity/action keys and omits payloads, request IDs and actor identity. It must not invent device, sign-in, comment, export or security facts absent from the audit domain | EPIC-047 |
| Notifications are recipient-addressed delivery facts, not audit or outbox projections | Each notification belongs to one tenant, active company and recipient, with bounded kind/severity and persistent read/dismiss state. Audit remains the history of writes; outbox remains worker delivery infrastructure. Neither is exposed or mutated to simulate a user's attention feed | EPIC-048 |
| Control-plane pages are tenant-bounded facts, never a fictional global console | Connector secrets are encrypted only by the production server and never returned; offline Demo stores none. Master Control exposes only the Session tenant. Company policy, sequences and period locks are company-scoped audited records, while tax remains effective-dated canonical data | EPIC-049 |
| Employee self service is Session-actor-owned, not employee-id-selected | Organisation code + username resolves the tenant/account. The company Employee link is server-derived for `/api/my/*`; multiple roles union capabilities but never widen tenant, employee or reporting-hierarchy row scope. Temporary activation secrets are recoverable only before first activation and every reveal is audited | EPIC-052 |
| Leave balances are immutable facts and approval is configurable governance | Grant/accrual/reservation/use/release/adjustment/carry/expiry/encashment append ledger entries. Requests use policy snapshots and multi-stage approval with no self-approval; legacy HR-lite days are retained rather than recomputed | EPIC-053 |
| Receipt content is replaceable storage behind immutable governed metadata | DocumentStorageProvider defaults to database binary content and may use a single-node filesystem backend. Quarantine, scan, hash, extraction provenance, 98%-minimum auto-submit, Void/correction, legal hold and two-person purge are invariant across providers | EPIC-054 |
| Finance approval is the expense accounting boundary | Managers confirm business purpose, Finance confirms evidence/tax/GL, and line decisions never rewrite the employee's submission. Final Finance approval posts balanced expense/input-tax legs against Employee Payable or the configured company-paid account | EPIC-055 |
| Reimbursement payment and tax reporting remain explicit controlled stages | Maker and releaser are distinct, nobody releases their own claim, bank outcomes post successful lines only, and tax packages are immutable snapshot artifacts with superseding corrections. No direct bank execution or tax filing is implied | EPIC-056 |

## 7. Employee self-service architecture (EPIC-052–056)

TASK-106 identity primitives, TASK-107 employee account lifecycle, TASK-108
actor-owned self/team read contracts, TASK-109's initial five Preview My Work routes
(later promoted to the current Canonical boundary), TASK-110 identity/security proof
and TASK-111's versioned leave policy calendar are implemented. TASK-112 adds the
immutable leave-balance ledger and serialized Pending
reservation. TASK-113 adds the versioned leave lifecycle, immutable revision/event
trail, actor-owned authoring and privacy-controlled evidence metadata. TASK-114 adds
versioned approval policy resolution, snapshotted workflow authority, bounded
delegation, immutable decisions/events and capacity controls. TASK-115 adds the shared
Team Calendar read model/workspace and optional one-way delivery worker. TASK-116 adds
immutable leave-to-Payroll sources, policy-controlled encashment and one-time run
mappings. TASK-117 implements the shared managed-document identity/version boundary,
database-default byte provider and optional explicit single-node filesystem provider.
TASK-118 implements bounded magic-validated receipt upload, positive page-count
metadata, actor-owned listing, IndexedDB offline capture and Canvas editing. The
remaining sections describe the target architecture for quarantine, extraction,
retention workflows and expense linkage under TASK-119–135.

### Identity and authorization

- Organisation login code, organisation-scoped `app_user.username`, nullable email
  and the separate `user_company_role` assignment table are implemented by TASK-106.
  Migration 0046 backfills existing email users and current `user_company.role_id`
  grants without changing their access. The company-unique `employee.user_id` link
  is enforced by TASK-107.
- Store the pre-activation credential as an AES-GCM encrypted temporary secret with
  expiry/reveal audit. First activation changes the password, captures email and
  destroys the encrypted copy. HR reset creates a new one-time credential and revokes
  existing sessions.
- `employee.self.read` and `employee.team.read` are implemented. Role permission union
  decides capability; Session tenant, active Employee link, direct reports and
  effective-dated direct/tree grants decide row scope. Later HR/expense/finance/
  payment/tax permissions and self-approval checks remain with their workflow tasks.
- Manager is a reporting-derived capability with explicit grant provenance. A linked
  employee gains a system-managed Manager role while active direct reports exist;
  reconciliation removes only that system grant. Manually authorized Manager grants
  remain intact and the User Management editor presents them as non-removable.
- Existing generic HR resources remain management-only. `/api/my/*` controllers expose
  bounded actor-owned views and reject client-selected `employeeId`; manager leave
  projections omit private reason and rejection details.
- The My Work shell uses `transaction-list-v1` for all five entry points. Capability
  navigation reads `/api/my/context`, never client role labels: self routes appear for
  a linked employee, while Team Calendar/My Approvals require `team.available`.
  Employee-only API sessions fall back from the management dashboard to a restricted
  shell; unfinished claims and receipts are not fabricated. TASK-114 promotes My
  Approvals to a privacy-redacted Canonical workflow with real decisions and bounded
  delegation.

### Shared workflow and document services

- Working calendars and leave policies have stable identities plus retained,
  non-overlapping confirmed versions. ISO weekdays and confirmed holiday facts drive
  calculation; draft official imports are deliberately ignored. Half-day arithmetic
  uses integer half-day units internally and returns fixed two-decimal days.
- Leave entitlement is projected only from immutable `leave_balance_entry` facts.
  Database triggers reject mutation, company-scoped entry keys make command replay
  idempotent, and employee-row locking serializes paid-balance reservations.
  Submission appends `reserve`; a later outcome appends `use` or `release`. An
  insufficient reservation returns the exact paid/unpaid split instead of creating a
  negative available balance.
- Governed leave separates a mutable, version-checked state projection from immutable
  revision and event facts. Employee commands derive ownership from Session; HR
  on-behalf creation is explicit. Owner “delete” means reasoned Void, Pending means
  withdrawal, and Approved means a separately approved cancellation. The list row
  contract opens only governed records; Legacy Policy rows stay visible but static.
  Private reasons and evidence references are returned only to the owner/HR detail,
  while manager projections contain dates, duration and evidence-required/state only.

- A versioned approval policy resolves ordered steps from domain, company, employee,
  hierarchy, type, amount/days, project and department. Approval instances snapshot
  those steps; delegation and escalation append facts instead of editing prior
  decisions. Approved, changed and cancelled leave events enqueue an idempotent
  one-way calendar projection; delivery revalidates current ERP state and supersedes
  stale jobs rather than treating an external calendar as authoritative.
- `DocumentStorageProvider` separates metadata from content. Both database and optional
  filesystem implementations stream bounded bytes, verify SHA-256 and enforce the
  same tenant/permission/retention contract. Filesystem mode is explicitly single-node.
- Upload returns a quarantined document immediately. Scan, OCR/Vision, preview and
  export run as retryable jobs/outbox work. Unknown scan state fails closed. Extraction
  stores provider/model/field/confidence; system auto-submit records the authenticated
  uploader and exact policy version.
- Sensitive reads use short-lived authorised download responses and append audit
  events. Reasoned draft Void-delete, submitted Void, posted correction, legal hold and physical
  purge are separate commands with separate permissions.

### Domain data flow

1. Leave submission snapshots policy/calendar, appends Pending balance reservation and
   creates an approval instance. Terminal rejection/withdrawal releases reservation;
   approval converts it to use. Unpaid/encashed facts become explicit Payroll inputs.
2. Expense submission snapshots receipt extraction, category/tax/FX, allocation,
   duplicate and budget decisions. Final Finance approval appends balanced GL and an
   employee payable or company-paid settlement fact in one transaction.
3. A reimbursement batch locks eligible employee payables, snapshots masked payout
   targets, requires a distinct releaser and exports a bank file. Imported results post
   only successful lines; retry never reselects a successful payable.
4. A tax-pack job snapshots eligible evidence and produces PDF, XLSX/CSV, original ZIP
   and hash manifest artifacts. Finalisation freezes the version; later evidence creates
   a superseding correction package and difference report.

### Frontend SSOT

- `my-leave`, `my-receipts` and `my-claims` use the shared transaction-list contract.
  `leave-application` and later expense decisions use `case-detail-v1`; payment/tax registers use
  `master-detail-register-v1` and posted payment detail uses `posting-detail-v1`.
- `calendar-workspace-v1` is implemented once for Team Calendar: page header, filters,
  calendar/list surface, retryable error, responsive detail drawer and governed
  actions. The route supports month/week/list views and is guarded by a dedicated
  desktop/375px layout audit; it is not a free-form exemption.
- PWA camera drafts stay in IndexedDB only until upload. Logout reports unsynced count
  and, after confirmation, removes unuploaded local images.

## 8. Testing design

- Required local gates are root/web typecheck, ESLint, Vitest, `npm run demo`, generated
  schema/drift checks, `npm run check:permissions`, Demo and API builds, and the
  live-route desktop/375px audit.
- CI adds PostgreSQL 16 migration/RLS/integration coverage and the same schema and route
  gates. Stateful browser fixtures ensure detail routes are not skipped for lack of
  context.
- Rule: every business bug or new command gets a same-slice domain/API assertion; every
  route promoted to Canonical must also prove Demo/API loading, five-language UI, write
  behavior and responsive rendering.

## 9. Authorization design — current and target

The current implementation is intentionally recorded separately from the target in
[ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md).

Current runtime facts:

- security hierarchy is `master -> company -> user/company membership`;
- users may hold multiple company roles and permissions are an Allow union;
- `user_company_role.assignment_id` is the stable assignment primary key. Live grants
  satisfy `valid_from <= now` and (`valid_until` is null or `valid_until > now`) with
  `revoked_at is null`; permissions and approval recipients use the same predicate;
- assignment-owned scope rows in `user_company_role_scope` union the validated
  `self/team/department/company` grants and target `none/company/department/team/
  employee`. Assignments with `scope_backfilled_at is null` dual-read the legacy
  `role_resource_scope` rows;
- the legacy `is_superadmin` column is retained only as migration/audit compatibility
  metadata; migration `0089_company_owner_cutover` sets it inert and the central
  evaluator no longer treats it as an authorization grant;
- active tenant administration uses an immutable, company-scoped `Company Owner`
  role with 112 explicit registered permission rows and an explicit company scope;
  the bundle does not imply platform support, business approval/payment, payroll or
  sensitive tax-evidence authority;
- permission storage remains compatibility-first, but TASK-171 now supplies an
  application-owned registry with 299 static definitions (157 compatibility and 142
  canonical, including a separate platform domain). Resource/action projections are
  registered for 116 resources, 62 actions and 5 update contracts; ordinary role
  checks resolve explicit compatibility candidates and deny unknown keys, while
  platform-domain keys are rejected before tenant role evaluation;
- module activation, tenant scope, permission, ownership and workflow authority are
  enforced by the backend for current Canonical operations;
- versioned approval policy/instance/decision/delegation tables remain the approval
  SSOT and must not be simplified during authorization refactoring.
- migration 0087 adds `user_permission_override`; `src/auth/authorization.ts` is now
  the central tenant decision service. It validates active membership, registered
  permission candidates, active assignments and override precedence. Migration 0089
  replaces the tenant Superadmin bypass with explicit Company Owner role permissions;
  legacy Superadmin rows remain inert for audit/backfill compatibility.
- Direct Sales Order and Purchase Order approve/reject action definitions now require
  `sales.approve` or `purchasing.approve`; their domain commands call
  `authorizeWithin` and then lock/validate the still-pending order and approval rows
  before mutation. Purchase Requisition approve/reject actions now require
  `purchasing.approve`; its domain command validates the active actor and central
  evaluator before locking the legacy `submitted` requisition row. Requisitions do not
  yet have a generic approval instance/step, so that submitted-state row is the
  implemented workflow authority. The targeted order/authorization/API contract tests
  pass 20/20, the requisition suite passes 9/9, and the combined regression passes
  29/29. Sales Commission run approval now also calls `authorizeWithin` for
  `sales.commission.approve` before locking the legacy `draft` run; its versioned header
  snapshot remains the implemented workflow authority and no generic approval
  instance/step is claimed. The commission suite passes 5/5 and its combined
  authorization/API regression passes 15/15. Allowance calculation approval now
  re-checks the existing `expenses.allowance.manage` permission in the domain before
  changing a locked `calculated` calculation; the allowance calculation status remains
  the implemented legacy workflow authority and no generic approval instance/step is
  claimed. Budget approval now re-checks `finance.budget.approve` in the domain before
  changing a draft budget; its existing draft/approved status, active flag, version and
  imported lines remain the workflow authority, also without a generic approval
  instance/step. The allowance/API/auth regression passes 12/12 and the
  budget/finance/API/auth regression passes 18/18.
- Governed HR leave and expense approval decisions are bound to the locked current
  workflow step. Permission authorities are evaluated with the server-resolved
  resource/module/scope context and policy-version, approval-instance and step
  identifiers; the active step must belong to the instance policy snapshot, and a
  named direct authority must still be active. There is no HR permission takeover of
  a manager-owned step and no implicit migration of older in-flight instances; their
  snapshotted authority remains authoritative. Delegation is still bounded by
  tenant/domain/authority/delegate/time/revocation, not yet by instance/step/resource/
  policy.
- `authorize()` and `authorizeWithin()` expose only safe `allowed/reasonCode` results;
  `explainAuthorization()` is reserved for the audit-read admin endpoint, which
  records every explanation. Override creation/revocation is reasoned and audited.
- `src/auth/accessMatrix.ts` and the authenticated/browser matrix checks keep the
  canonical route, module, permission and API drill-in contract together. Unknown
  business-module keys now fail closed and payroll is registered in
  `src/auth/moduleAccess.ts`; authenticated `account/*` service routes are explicitly
  non-module-gated but still require their own permissions. Migration 0088 adds the
  company-scoped `authorization_version`; core role, assignment, scope, module,
  override and invitation writes bump it atomically, while session and effective-
  capability responses expose the current marker. There is still no centralized
  capability cache, and organization changes, some policy domains, master-wide
  support grants and stale-session/direct-URL regression coverage remain open, so
  the matrix is a regression foundation rather than proof that TASK-174 is complete.

TASK-170 now adds a separate platform control-plane domain: platform principals, static
application-owned support roles, hash-backed bearer/CSRF sessions and auditable support
grants. Grants target an existing `master_fn` and optional matching `company_fn`, use
read-only/restricted-write/break-glass modes, expire within 24 hours, deny sensitive
fields by default and can be revoked immediately. `/api/platform` never accepts the
tenant cookie; platform principal/session issuance is out-of-band, and evaluating a
grant does not automatically expose or proxy business records. The employee workspace
continues to be a tenant Company Owner convenience and is a separate authority path
from platform support access.

TASK-172 now delivers assignment-scoped validity, revocation/provenance and validated
scope targets through migration 0086, with a stable assignment primary key, assignment-
owned scope rows and a dual-read fallback for unbackfilled legacy scope rows. TASK-173
is complete: migration 0087 and the central evaluator govern explicit user-level
overrides, safe explanations and strict current-step approval decisions with resolved
resource/module/scope/policy context. TASK-175 is complete: migration 0089 delivers the
Company Owner cutover, including idempotent legacy-assignment backfill, explicit
permissions, company scope, immutable template/role handling and last-owner recovery
compatibility. On 2026-08-10 production was backed up, migrations 0084–0089 were
applied, RLS was re-applied and `deploy/release.sh` completed through the existing
Cloudflare tunnel. Verification found 90 migration entries, 219 forced-RLS tenant
tables/policies, zero active legacy Superadmin flags/assignments, healthy services,
public `/health` 200 and unauthenticated session 401. Code behavior above is
authoritative. TASK-174's centralized cache invalidation, broader delegation binding
and organization/policy/support coverage remain open. Broad `role_permission` rows
remain a text compatibility store.

## 10. August 2026 implementation additions

- Migrations 0076–0078 make Sales enquiry, quotation and order authoring use immutable
  stock/non-stock line snapshots. Inventory movement and delivery apply only to stock
  lines; service lines remain invoice/GL-bearing business rows.
- Migration 0079 adds audited, active-company employee-workspace impersonation. This is
  a tenant support convenience, not platform support access.
- Migrations 0080–0081 add governed HR holiday transitions and route the active standard
  leave workflow through explicit HR permission authority while preserving original
  workflow facts.
- Migrations 0082–0083 add versioned Staff Calendar appointments, bounded recurrence,
  durable reminders and a separate one-way outbound queue. The calendar worker owns
  retries and supersession; external calendars never become authoritative.
- Tenant-scoped employee, product, customer and supplier updates use explicit field
  allowlists, optimistic versions and audit. Security-owned identity fields remain in
  dedicated lifecycle commands.
- Migration 0087 adds tenant-scoped, reasoned `user_permission_override` records with
  explicit allow/deny effects, validity/revocation metadata and resource/department
  target support. The admin explanation endpoint is privileged and append-audited;
  public authorization callers receive safe reason codes only.
- Migration 0088 adds `company.authorization_version` with default `1`. The central
  marker is read on every durable session/effective-capability projection, and the
  current lifecycle writers bump it after successful role, assignment, scope, module,
  override and invitation changes; Master-wide support changes bump every Company.
  Browser API requests carry the marker, stale snapshots fail closed and recover only
  through the session endpoint before reload. It is a freshness signal, not an
  authorization bypass or a replacement for the uncached current-state evaluator.

## 11. Planned Expenses & Tax v1 architecture

The 2026-08-11 source audit confirms useful foundations but no completed Company
Receipts vertical slice. `managed_document`/`document_version` preserve tenant-scoped
identity, bytes, hash, version and retention; `receipt_inbox_item` projects the
actor-owned extraction state; My Receipts provides mobile/IndexedDB capture; and the
Tax Evidence worker can compose PDF/image evidence. Today, however, My Receipts
requires a linked Employee, lists only the current uploader (bounded to 100), exposes
no metadata correction command or transaction-date query, and Tax Evidence starts
from posted Expense Claim lines rather than standalone receipts.

The target adds the minimum company-scoped receipt aggregate around the existing
managed document instead of another blob/OCR engine:

```text
Company Receipt (masterFn + companyFn)
        ├── current managed-document/version reference
        ├── confirmed receipt metadata + optimistic version
        ├── uploader/audit attribution
        └── Draft | Processing | Ready | Needs Attention | Voided
```

Upload continues through the existing security and extraction pipeline. A safe
document may be completed manually when OCR fails; OCR fields remain immutable
provenance while user-confirmed receipt facts belong to the Company Receipt aggregate.
The register queries that aggregate by active-company scope, capabilities, search,
status and inclusive `transaction_date`. Preview creates a bounded immutable selection
of all matching rows and invokes reusable PDF/document readers without importing tax,
claim, reimbursement or GL semantics.

The product entry is planned as `Expenses & Tax → Company Receipts`; exact technical
module/resource/action identifiers must be registered atomically with the backend
module catalog, permission registry, route metadata and `accessMatrix` under
TASK-177–182. Until those tasks land, neither `my-receipts` nor
`receipt-tax-evidence` may be presented as the completed v1.

## 12. Planned platform-owned Module Access Control architecture

EPIC-018's current `company_module` gate and backend checks remain implementation truth:
Company Owner can currently mutate the active Company through `admin.modules.manage`,
`/api/admin/modules` and `module-activation-control`. EPIC-064 changes authority and
entitlement layering; it is not implemented by this documentation update.

The target introduces an application-owned commercial Module Catalog used by route
metadata, resource/API registration, Demo fixtures and frontend navigation. Catalog
entries distinguish sellable business modules from baseline Dashboard/Home, My Work,
Admin, Settings and Account/Notifications services. Unknown references fail CI/startup
and runtime access fails closed.

`master_module` becomes a versioned Master entitlement with the new-Company default
allocation flag. `company_module` becomes a versioned Company allocation. Reads return
both stored layers plus `effectiveEnabled = master.enabled && company.allocated`;
Master disable never rewrites allocation. Migration rebuilds Master entitlement from
the union of current enabled Company rows before switching reads.

Platform APIs live only under the independent platform session/CSRF boundary and expose
Master/Company listing, entitlement summaries, versioned Master writes and versioned
Company allocation writes. Tenant `/api/admin/modules`, onboarding selection and Module
Activation UI are retired under TASK-186. Platform login uses the shared visual entry
but an independent realm/password/session, at most one hour with no remember option.

User simulation is a separate, explicit platform support session linked to the real
platform principal, target active user and exact Master/Company. Tenant authorization
runs as the target user without a platform bypass; writes audit both identities. The
platform workspace remains the only MAC mutation surface. Password-only platform login
without MFA is an accepted v1 risk and must remain prominent in security/release review.
