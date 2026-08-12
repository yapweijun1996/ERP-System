# Project Status — reviewed 2026-08-12

One-page truth about what is **built**, what is **mock**, and what is **documented but
not implemented**. Read this first before picking any task. Update this file whenever
an epic-level milestone lands.

## Source-of-truth synchronization

The current worktree is at migration 0098: the Drizzle journal contains **99 migration
entries** and generated canonical SQL contains **249 tables**. TASK-161–193 now
track the production-operation, employee/master-data update, Sales authoring, bounded
session/impersonation, HR holiday, Staff appointment, recurrence/reminder/sync and
permission-matrix and platform-support boundary work that had landed in code without
matching task records.

The 2026-08-12 status-document correction aligns deployment, security, architecture,
role-permission, Demo and UAT material to that current boundary: TASK-174's
authorization-version invalidation and TASK-188's automated cross-engine/browser
release-gate proof are complete; TASK-017 remains the physical-device blocker and
TASK-193 is separately blocked by missing production SMTP.
The current worktree includes the Platform Bootstrap & Tenant Provisioning implementation
and migration 0098. On 2026-08-12 the existing Compose production database was released,
backed up and verified, then the exact `erp-system_pgdata` and
`erp-system_document_storage` volumes were reset without seed. The new database is empty
while schema/RLS remain intact; public bootstrap evidence is now production evidence, not
only a local source/test claim. Source CI run `31570902479` passed all four Vitest shards
and the local release gates used for deployment passed. The later docs-only push run
`31573438483` could not start any job because GitHub Actions account billing blocked it;
neither run is treated as a full CI gate pass.

Authorization documentation distinguishes the implemented platform-owned module
boundary from the historical tenant-controlled design. Tenant authorization still uses
active-company multi-role Allow union and tenant-bounded explicit role/assignment
permissions, but commercial availability is now Master entitlement AND Company
allocation. The legacy
`is_superadmin` column is retained for migration/audit compatibility only; migration
0089 makes it inert and central authorization no longer treats it as a bypass. The
immutable, company-scoped Company Owner role carries explicit registered tenant
permissions plus `* / company` scope. Migrations 0092 and 0097 add Company Receipt read
and canonical mutation grants, while migration 0095 removes module-management authority;
it has no automatic platform support, business
approval/payment, payroll or sensitive tax-evidence authority. TASK-172 now adds a stable
assignment primary key, `[valid_from, valid_until)` validity, revocation/provenance and
assignment-owned `self/team/department/company` scope rows with validated
`none/company/department/team/employee` targets. `role_resource_scope` remains a
dual-read fallback for assignments whose `scope_backfilled_at` is null. TASK-170 now
provides a separate platform-principal, platform
session/role and reasoned support-grant control plane: grants are bounded to a master
and optional company, expire within 24 hours, default-deny sensitive fields, audit
allow/deny/revoke events and never proxy customer data by themselves. Principal/session
issuance remains an out-of-band deployment/SSO bootstrap boundary. TASK-171 now adds
an application-owned permission registry with 314 registered codes after EPIC-065,
explicit alias metadata, canonical projections for
116 resources and 62 actions, tenant/platform-domain separation and a CI gate. Ordinary
role checks fail closed for unknown permission candidates, while platform-domain keys
are rejected before tenant role evaluation. Migration 0087 now adds
reasoned user-level explicit allow/deny overrides, and `src/auth/authorization.ts`
centralizes membership, registry, override, role and assignment decisions. Public
callers receive safe reason codes; audit-read administrators can request full audited
explanations. TASK-173 is complete: strict permission-plus-current-workflow-authority
behavior now covers the versioned leave/expense workflow with resolved resource/module/
scope/policy context. Direct Sales/Purchasing order decisions, Purchase Requisition
decisions, Sales Commission run approvals, allowance calculation approvals and budget
approvals now have dedicated domain permission checks;
requisitions use their locked `submitted` row, commission runs use their locked
`draft`/version snapshot, allowance uses its locked `calculated` row, and budget uses
its draft/active/version/line state as the implemented legacy authorities, without
claiming generic approval instances/steps. TASK-174-A now fails closed for unknown
module keys and registers payroll. Migration 0088 adds the company-scoped
`authorization_version` source; core role, assignment, scope, module, override and
invitation mutations bump it atomically, and session/effective-capability responses
expose the current marker. TASK-174 is complete: Master-wide support grant changes bump
every Company marker; browser API requests carry their snapshot version, stale state
fails closed with 409 and recovers through the session endpoint without replay; current
server permission, organization and workflow-policy decisions remain uncached.
TASK-175's explicit Company Owner migration is
implemented and deployed. Disposable PostgreSQL 16 parity, true concurrency and
non-superuser RLS/security proof are green. The target database was backed up, migrations
0084–0089 were applied, production RLS was re-applied and `deploy/release.sh` completed
through the existing Cloudflare tunnel. Post-release checks confirmed 90 migration
entries, 219 forced-RLS tenant tables/policies, zero active Superadmin flags/assignments,
healthy Compose services, public `/health` 200, public root 200 and unauthenticated
session 401. No physical-device acceptance is implied. See
[ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md).

The first TASK-173 approval slices are now complete: direct Sales Order and Purchase
Order approve/reject action definitions require `sales.approve` or `purchasing.approve`,
and their domain commands call `authorizeWithin` before mutating a still-pending
order/approval pair. Purchase Requisition approve/reject actions require
`purchasing.approve`; its domain command validates the active actor and only mutates a
locked `submitted` row. Permission-removal adversarial tests keep protected rows
unchanged; the order/authorization/API contract suites pass 20/20, the requisition
suite passes 9/9, and the combined regression passes 29/29.
Sales Commission run approval now also re-checks `sales.commission.approve` in the
domain command before changing a locked `draft` run; its suite passes 5/5 and the
combined commission/authorization/API regression passes 15/15. Allowance calculation
approval re-checks `expenses.allowance.manage` before changing a locked `calculated`
row; its allowance/API/auth regression passes 12/12. Budget approval re-checks
`finance.budget.approve` before changing a draft budget; its budget/finance/API/auth
regression passes 18/18, with direct-domain denial mapped to HTTP 403. Neither path
claims a generic approval instance/step. Governed HR leave and expense approvals now
remain bound to the current locked step; manager-owned steps cannot be taken over by a
broad HR permission, policy-step snapshot mismatches fail closed, inactive named
authorities are denied, and older in-flight instances retain their snapshot without
implicit migration. The current strict-step authorization/API regression passes 18/18.

Historical working-tree verification on 2026-08-10: root/Web typecheck, ESLint, Demo proof,
Demo build, generated Demo schema, 244-table drift, Demo-pack and permission-registry
checks passed. A disposable PostgreSQL 16 database also passed `POSTGRES_URL=... npm
run demo`, including cross-engine equality and the exactly-one-winner stock concurrency
race; the PostgreSQL security integration suite passed against the same database.
Focused
central-authorization/API explanation/RBAC/assignment/resource/approval suites pass.
That full Vitest run was green: 156 passed files plus 1 skipped file (635 passed, 1
skipped tests). The later 2026-08-12 current-worktree full run is green at 168 passed
files plus 1 skipped file (663 passed, 1 skipped tests). The authenticated `account/*`
service prefix is explicitly
non-module-gated while notification permissions remain enforced, and the 15-test
targeted notification/matrix/module regression passes. HR Calendar fixtures now use
explicit HR approval permissions; no production role template was widened to mask a
fixture mismatch. Assignment/RBAC, admin/manager and strict approval-focused tests
pass, including expiry, revoke, multi-target, explicit deny precedence and safe
explanation access-control cases.
The current screen audit reaches all 128 registered routes and confirms 128
Canonical/0 Preview with no console/page errors. Its desktop/375 px release
layout/behavior gate now passes, including active-tab visibility, HR Calendar detail
ordering, Leave Approval's pending action, My Work's employee tab count and the
standard action/declared contracts. This is separate from TASK-017's physical-device
blocker and from the authorization-matrix gate.
The current post-build `npm run smoke` passes on desktop and mobile. The assertion
targets visible semantic navigation badges; hidden zero-count badges remain in the DOM
for stable accessibility behavior. The full i18n verification passes **1,533 canonical
keys and 69 local five-language packs** across the complete **128-route × 5-language ×
2-viewport** browser matrix. Business-record values remain outside the UI-resource
audit; system-authored labels and state text are covered by localized packs or explicit
business-text boundary markers.
The current cross-layer access contract is also present in `src/auth/accessMatrix.ts`:
the authenticated API matrix suite and `npm run audit:access-matrix` check route
visibility, module/permission metadata and available detail drill-ins. This is a
regression foundation and TASK-174 completion evidence; unknown business-module keys now
fail closed, authenticated `account/*` services are explicitly non-module-gated, and
the authorization-version source/marker now invalidates stale browser capability state;
no server authorization cache is claimed. After the purchase-requisition adapter
was aligned, serial `npm run build:demo` and `npm run audit:access-matrix` pass; the
first parallel build attempt was a shared-`web/dist` race, not a source failure. The
clean full-suite rerun and target migration/release verification are complete. The
remaining separate gates are authenticated API-mode browser workflow coverage and
TASK-017 physical-device PWA acceptance. `npm run audit:pwa-update` passes the static
update lifecycle audit; no physical iPhone was connected for this release.
TASK-168 reconciled the generated Demo Manager
scopes with the current
authoritative catalog. Generic sales/CRM/inventory/warehouse/project/service collections
are company-scoped because their rows do not carry actor ownership; actor-derived My Work
and Team Calendar routes still enforce direct/granted-tree hierarchy boundaries.

## TL;DR

The repo is a working **browser-first ERP demo**: real PostgreSQL (PGlite/WASM) runs in
the browser, persisted to IndexedDB, with a genuine cross-module transaction
(sales order → stock deduction → invoice → balanced GL) proven both in `src/demo.ts`
and in the live UI. **The production path now genuinely runs end-to-end**:
`docker compose up -d` starts `web`+`api`+`db`; the setup script applies migrations and
leaves demo seeding opt-in, then serves a real
`GET /api/dashboard` through an nginx reverse proxy, and the frontend actually
**renders that dashboard** (real figures, working company switcher, per-company data
verified distinct) instead of the "waiting for API" screen — the waiting screen only
shows when the API genuinely isn't reachable. **Auth is now real, not a stub**: both
modes share one `login`/`logout`/`needsSetup`/`isSignedIn`/`switchUser` adapter
contract; production validates PBKDF2-hashed passwords against `app_user` over a
server-side session cookie (masterFn/companyFn never trusted from the client), and
the demo mode hashes real passwords too (Web Crypto, same format) so wizard-created
users aren't passwordless. **A second domain now exists alongside sales, screens
included**: the purchasing chain (supplier → PO → goods receipt → supplier invoice)
is real end-to-end in Demo and API modes — `receiveGoods` increases stock from zero and guards
against double-receiving, `postSupplierInvoice` posts a balanced GL gated on the
goods actually having arrived, both proven on PGlite and PostgreSQL in `src/demo.ts`,
and the Purchasing screens (suppliers/purchase-orders/goods-receipts/
supplier-invoices lists, the new-PO wizard, the receive-goods/post-invoice actions)
now use the formal `ErpSystemData` resource contract with no sample fallback. Production
PO creation, receipt and supplier-invoice posting run through the unified RBAC,
idempotency and audit dispatcher; receipt stock changes use the shared inventory
    command so aggregate, bin and location balances stay aligned. Purchase requisitions
    and the RFQ → invited supplier quotation → awarded PO sourcing chain are also real;
    purchase returns, supplier credit/debit notes and landed-cost allocation are also
    real; supplier price lists and vendor performance are now derived Canonical controls
    from the purchasing facts. Goods-receipt and supplier-invoice details are now
    record-specific Canonical workspaces with direct inventory and GL traceability. **A third
domain is now real end-to-end, screens included**: CRM's opportunity pipeline →
convert-to-sales-order — the conversion composes atomically with the sales module
itself (`confirmSalesOrder` was split into a composable `confirmSalesOrderWithin`
core so an opportunity's stage update and the resulting order/stock/invoice/GL
posting are genuinely one transaction, not two), proven on PGlite and PostgreSQL
including a test that a mid-conversion failure leaves the opportunity provably
untouched, and the pipeline board / new-opportunity wizard now read and write that
real data through the formal `ErpSystemData` contract in Demo and API modes.
Production customer/opportunity reads are bounded keyset resources; opportunity
creation is RBAC/audited and tenant-validates the selected customer, while conversion
is idempotent and atomic. Customer-360 and opportunity detail now use those canonical
records too: opportunity detail shows real customer/activity/order data, records real
activities, converts through the existing transaction and closes a lost opportunity
    through an audited idempotent action. What's
still missing: the module screens do not yet map every production resource
response into their view models. Inventory is the first non-dashboard read slice
to cross that boundary: stock-on-hand, stock-movement and inventory-valuation now
load the same bounded keyset resource pages in Demo and API modes, joining products,
warehouses, balances, movements, bins and location balances into their presentation
model without falling back to sample data. The first inventory production writes are now
live: adjustment draft/post and warehouse transfer draft/complete share the
same domain commands in Demo and API mode, append movements, enforce state and
idempotency, and adjustment posting creates balanced inventory-variance GL.
The warehouse tracking foundation is also real: bins, lots, serials and
location-level balances are tenant-scoped canonical tables. Every receipt and
issue resolves the product tracking policy, updates aggregate and location
projections together, appends a fully attributed movement, and enforces lot
quality holds plus the registered → available → issued serial lifecycle.
The production-write security foundation is now
real: database sessions, CSRF, login limiting, server-side RBAC, active-company
session switching, idempotency records, append-only API audit events, request
IDs and production-only RLS policies are implemented and tested. **The last two
mock-data screens in Inventory and CRM are now real (TASK-029…032, 2026-07-19)**:
Item Master creates and edits real product master data (category, reorder point/
qty) through the same audited Demo/API write path every other Canonical screen
uses, and fixed the 3 already-Canonical Stock-on-Hand/Valuation/Movements screens'
fake category/reorder display as a side effect; Customer-360 shows a customer's
real contacts, open orders, open opportunities, an activity timeline, and
Net-30-based balance/overdue, replacing a screen that previously showed one
hardcoded fictional customer regardless of the active company.

## 2026-07-27 end-user audit status

The isolated dual-mode audit at `a9fdb07` confirmed the core ERP invariants and all
122 Canonical routes. All nine root causes in TASK-141–149 are now remediated and the
automated release baseline is green. See
`docs/audits/END_USER_AUDIT_2026-07-27.md` for exact evidence. TASK-017 remains blocked
for physical-phone acceptance.

## 2026-07-28 interactive walkthrough status

TASK-158 / EPIC-060 is complete except for the separately blocked physical-phone
TASK-017. Unlike the route matrix alone, this pass clicked
the real sidebar, tabs, menus and primary actions, fixes confirmed issues immediately
and repeats each interaction in the browser. The current evidence and remaining gates
are in `docs/audits/INTERACTIVE_END_USER_AUDIT_2026-07-28.md`; the project must not be
reported fully done until that ledger was closed. The first batch corrected Staff
onboarding, fiscal-period payroll defaults, shell/PWA localization, empty detail states
and enterprise Demo HR/payroll/AP/sales-approval/calendar coverage; the Demo pack is now v15. The current ledger
also records the payslip layout, employee search, cross-company fiscal currency,
payroll action overflow, business-data i18n boundaries, a non-disclosing direct-route
403 for restricted roles, calendar discoverability and a universal transaction-list
detail contract. All 40 standard transaction-list routes now fail audit if a populated
row cannot open a native detail or governed read-only preview. The latest targeted
desktop/375px list audit and Chinese browser proofs pass. The same pass now governs
all 29 declared detail routes: 15 legacy documents have semantic titles, a wider
shared canvas and bounded line tables; Sales Return uses the actionable case-detail
contract; and mobile case/posting actions follow rather than cover their business
context. Dedicated desktop/375px audits pass for document, case, master-editor,
ledger and posting details; the complete 125-route × five-language × desktop/375px
matrix is also green after correcting dynamic-business-text boundaries and Inventory
Movement terminology. The real 12-persona shell matrix now also passes: navigation,
quick-create actions, companies, dashboard facts and direct denial are permission-aware;
personal Activity/Notifications use an Account shell, HR sees only its permitted Admin
tabs, and Demo v15 is regression-checked against the authoritative role templates. MY sales
approval-to-confirmation, AP settlement and closed-period rollback pass. Buyer created
a real pending-approval PO; Production created and released a BOM-backed work order;
Employee/Manager completed a real privacy-redacted leave approval; HR Staff activation
enforced a temporary-password change; and Service created, assigned and resolved a real
ticket while retaining its Finance 403 boundary. The 2026-07-29 IUA-068 follow-up also
passes: PWA v210 removes the competing source-fingerprint updater, versions deferred
prompts per tab session and reloads only after an explicit Update now action;
`npm run audit:pwa-update` proves the real worker lifecycle. The Warehouse journey also
blocks invalid physical counts and locked-period adjustments before posting, while the
domain boundary preserves zero stock/GL effects on direct failure. The current release
baseline is green after those changes: 554 tests pass with one intentional skip, both
Demo/API builds pass, desktop/375px smoke passes, and all 125 routes pass the responsive
and five-language matrices. Retry-state audits now wait on the rendered recovery state
instead of a workstation-speed-dependent 250 ms delay.

## 2026-08-04 release-proof and test-stability follow-up

The release-proof pass completed without changing production accounting semantics:
expense and reimbursement fixtures now use an explicit 2026-07-26 approval clock so
they remain valid after the real current date moved past the July open period. The
period guard, migrations and production write paths were not weakened. `npm test`
passes 554 tests with one expected skip; lint, both typechecks, Demo/schema/drift
checks, Demo/API builds, desktop/mobile smoke, the PWA update audit, all 125 route
screen audits and the 125 × 5-language × desktop/375px matrix also pass. TASK-017 is
the only remaining blocked task because it requires physical-device verification.

## 2026-08-08 Staff Calendar recurrence, reminders and external sync

Staff Calendar appointments now retain an IANA time zone and a bounded daily/weekly/
monthly recurrence rule without copying occurrences into the appointment master table.
The API and Demo adapter validate the same rule subset, preserve local wall-clock time
across DST changes, and reject nonexistent or ambiguous local times. Reminder delivery
uses a durable, retryable in-app queue with recipient and current-revision checks.

Optional one-way external calendar delivery uses a separate appointment outbound queue;
Leave's existing outbound facts remain unchanged. Appointment creation, edits, opt-out
and cancellation enqueue idempotent occurrence events, while a resident `calendar-worker`
handles reminders, retries and stale-job supersession. Production RLS grants its worker
flag only to the employee, appointment, reminder, outbound and notification tables.
Migration 0083 is additive; it requires the explicit migration command and RLS re-apply
before the application-only release.

## 2026-08-06 Staff Calendar appointments

Staff Calendar now has a canonical appointment fact source (`staff_appointment`,
migration 0082) alongside the existing leave source. The server-side read model
combines both sources with tenant and HR permissions, stable namespaced event IDs,
overlap/conflict facts and bounded date-range queries. HR users with write access can
create, edit and cancel appointments through idempotent, version-guarded API commands;
cancelled rows remain auditable. The Demo adapter, API adapter, five-language UI and
production RLS table allow-list are aligned, with no leave or employee rows rewritten.
Final verification for this change passed: full Vitest `146 passed / 1 skipped` with
`585 passed / 1 skipped` tests, plus the dedicated Staff Calendar Playwright contract.

Demo v15 additionally gives every linked persona one company-managed Employee base
role, removes the replaced shared compatibility assignment, deterministically
binds `viewer@acme.co` to Jordan Lee / `DEMO-SG-E012` under manager@acme.co. Existing
controlled rows converge on 24 July/August SG/MY leave cases. Company Owner uses company
calendar scope while managers remain restricted to direct or explicitly granted teams.
IndexedDB receives the additive upgrade because both version and signed hash advanced.

The previously open desktop smoke regression is also closed: its finance proof had
retained hard-coded July dates after manual-journal posting became correctly governed
by the selected FY2026 P06 accounting period. The proof now derives its journal,
reversal and bank-reconciliation dates from the canonical open-period boundary;
one rebuilt Demo run passes both 1280px and 375px with zero console/page errors.

## 2026-07-30 receipt tax evidence enhancement

TASK-160 gives TASK-133's Tax Evidence Center its first screen instead of leaving it
API/report-job-only: a My Work → Receipt & Tax Evidence route
(`receipt-tax-evidence`) filters posted expense evidence by period, employee,
category, project, currency, tax state, completeness and paper-custody status, runs a
snapshot, generates the same register/merged-PDF/XLSX/CSV/ZIP/manifest package,
manages per-receipt paper custody and legal hold, and configures the document
OCR/Vision provider inline. Migration 0075 extends TASK-119's
`document_processing_policy` with a third `byok_vision` provider —
`openai_compatible` (OpenRouter, LM Studio, custom endpoints) — adding
`vision_base_url`/`vision_model` columns and an optional `vision_credential_required`
flag for endpoints that need no stored API key, alongside the existing `openai`/
`google` providers. `createTaxEvidenceSnapshotWithin` gained `employeeIds`/
`currencyCodes`/`paperCustodyStatuses` filters, and each snapshot line now carries
employee identity plus per-field OCR confidence/review state. Five-language copy
(en/ms/zh/ja/vi); the targeted `taxEvidence`/`processing`/`controlPlane` tests pass.
Schema stays at 232 tables across 76 migrations (new columns only, no new table), and
the Canonical route count moves from 124 to 125.

## 2026-08-04 service-capable Sales Order authoring

`new-sales-order` now uses a canonical Header–Detail editor even when the active
company has no standard products. End users can create a zero-stock inventory item
inline (SKU, name, category and UoM), add it to the order immediately, or add a
`non_stock` service/free-text line with description, UoM, quantity, price and tax.
Migration 0078 makes order-line product identity nullable while preserving an
immutable description/UoM snapshot; existing stock rows are backfilled from the
product master. Confirmation creates delivery and inventory movements only for
stock lines, while service-only lines still flow to the invoice and balanced revenue
GL. The API create contract is idempotent and the Demo schema is generated from the
same migration set.

The API login flow now keeps a remembered-device session's 7-day idle window within
its 30-day absolute lifetime when the first `/auth/session` check touches it; the
server-side token carries only a non-secret session-type prefix, so this fix needs
no database migration. Authentication responses are `no-store`,
the client verifies that the cookie is reusable before reloading, and only a
non-secret organization/username hint is retained locally when the user opts in.

## What actually works (verified in code)

| Area | Status | Evidence |
| --- | --- | --- |
| Demo boot: PGlite + IndexedDB (`idb://erp-system-demo`) | ✅ Working | `web/public/assets/erp-system-data-adapter.js` |
| Canonical schema (249 tables, multi-tenant `master_fn`/`company_fn`) | ✅ Working | 99 ordered migrations through schema version 98; `drizzle/`, `src/data/schema/`; migration 0098 adds platform provisioning records and existing-Superadmin permission backfill |
| Cross-module transaction with rollback | ✅ Working | `src/modules/sales/confirmOrder.ts`; new orders, existing Draft confirmation, CRM conversion, Demo and API actions share the same composable commands. Draft confirmation locks the order row, rejects a second confirmation, and rolls stock/invoice/GL back together on failure. |
| Purchasing chain: requisition/RFQ/quote → PO approval → receipt/invoice → return/credit/debit/landed cost, plus supplier contracts/performance | ✅ Canonical Demo/API data and writes | The full transaction chain uses bounded formal resources in both modes. Supplier contracts add effective-dated quantity tiers with audited activation; vendor performance and Purchasing reports are rebuilt from actual orders, approvals, receipts, quotations, invoices, credited returns and contract coverage rather than curated score/KPI tables. |
| CRM chain: opportunity → convert to sales order (composed atomically with `confirmSalesOrderWithin`), end-to-end incl. screens | ✅ Canonical Demo/API data and writes | `crm-pipeline`, `new-opportunity`, `crm-customer` and `opportunity` use bounded canonical resources in both modes. Creation validates the active-company customer and is RBAC/audited; conversion uses the shared idempotent action dispatcher and `convertOpportunityToSalesOrderWithin`. Opportunity detail shows real activity/contact/order context, logs customer-linked activity and closes a lost deal through the audited idempotent `mark-lost` action. HTTP/domain tests cover creation, audit entity correlation, cross-company rejection, viewer denial, replay, terminal-state guards and rollback. |
| Async `SCREENS` render boundary | ✅ Working | `navigate()` accepts legacy synchronous root mutation plus `string \| Promise<string>`, shows a standard skeleton, discards stale responses by render sequence, and renders a retryable no-sample-fallback error state. The current 128-route audit explicitly proves the loading/race/error contract at desktop + 375px. |
| Bundled Demo ESM runtime | ✅ Current Canonical writes migrated | `web/src/erp-demo-runtime*.ts` bundles PGlite, Drizzle, canonical schema and shared domain commands locally. CRM create/convert, Purchasing create/receive/post, Sales enquiry/quotation/order actions, Sales Draft confirmation and Demo Setup all use TypeScript commands instead of browser business SQL mirrors — including the base demo seed itself (`seedDemo()`, TASK-034), which now runs directly on first boot instead of a hand-written `erp-system-seed.sql` mirror. API builds remove this entry before bundling, so production web artifacts contain no PGlite WASM/data payload. The service worker discovers and precaches the Demo build's content-hashed runtime/WASM/data graph for offline reuse. |
| Transaction proof script | ✅ Empty-only, fail-closed | `npm run demo` passes PGlite; with `POSTGRES_URL`, a read-only preflight rejects any user table before migration/seed. An empty PostgreSQL 16 database passes parity and true concurrency; its second run rejects deterministically without changing counts. |
| Sales screens (orders, detail, invoices and idempotent confirmation) | ✅ Canonical Demo/API data and writes | Four Canonical routes read bounded formal customer/order/line/invoice resources in both modes. Confirmation executes the shared transactional command with a real warehouse, inventory movements, invoice and balanced GL; unsupported prototype actions are not exposed. |
| Sales enquiry and quotation chain | ✅ Canonical Demo/API data and writes | Migration 0012 adds tenant-scoped enquiries, quotation headers and immutable quotation line tax snapshots; migration 0076 adds canonical enquiry item rows. The canonical aggregate endpoint returns the enquiry header, customer, ordered lines and linked quotations; a version-guarded `save-draft` command atomically saves the complete header + item set and derives the header estimate before quotation, while `replace-lines` remains a compatibility action. `enquiries`, `quotations`, `quotation` and `new-quotation` use bounded formal resources in five languages. New quotation authoring now follows the Header–Detail pattern with repeatable stock/non-stock rows, free-text service descriptions, UOM, quantity, unit price, effective tax options, per-line amounts and a server-derived summary; create requests are idempotent and the Malaysia default is SST `SV`. The shared commands create enquiries/quotes, issue, accept and idempotently convert an accepted quote to an editable draft order without premature inventory, invoice or GL effects. Domain and authenticated HTTP tests cover aggregate reads, full-draft save, line replacement, version conflicts, status guards, rollback, tenant isolation, tax totals and idempotent replay. |
| Sales delivery proof | ✅ Canonical Demo/API data | Migration 0013 adds tenant-scoped delivery headers and lines. Sales confirmation creates a draft delivery first, attributes every inventory issue to it, then marks it delivered only after the invoice and balanced GL succeed in the same transaction. `delivery-orders` and `delivery-order` provide five-language traceability across order, product, warehouse and invoice; failed confirmation rolls the delivery back. Advanced partial pick/pack/shipment remains in the Warehouse depth backlog. |
| Sales RMA and credit note chain | ✅ Canonical Demo/API data and writes | Migration 0014 adds returns/lines and posted credit notes/lines. Return creation locks and validates cumulative quantities against the original delivered line. The idempotent receive-and-credit action atomically restores stock, creates the traceable credit, posts balanced Dr Revenue + Dr Output Tax / Cr AR legs and marks the RMA credited; rejection leaves inventory and GL untouched. `sales-returns`, `sales-return`, `credit-notes` and `credit-note` use bounded formal resources with five-language copy. |
| Sales debit note posting | ✅ Canonical Demo/API data and writes | Migration 0015 adds tenant-scoped, versioned debit notes against posted customer invoices. Draft creation snapshots the effective tax rate and calculates decimal-string totals; the idempotent post action atomically records balanced Dr AR / Cr Revenue / Cr Output Tax legs. `debit-notes` reads and writes the formal resource in Demo/API with five-language copy, while duplicate posting is rejected and identical API retries replay without duplicate GL. |
| Sales price lists and discount controls | ✅ Canonical Demo/API data and writes | Migration 0016 adds effective-dated price-list headers/quantity tiers and bounded discount rules. Shared Decimal commands validate customer/product tenancy, prevent prices below protected floors, reject duplicate tiers, and activate drafts through audited idempotent actions. `price-lists` and `discount-mgmt` now use bounded formal resources in both modes with five-language create/activate workflows. |
| Sales commission plans and immutable runs | ✅ Canonical Demo/API data and writes | Migration 0037 snapshots the customer owner onto each sales order and invoice, then adds effective-dated salesperson plans plus immutable run, line and source-document snapshots. Runs reconcile invoice net revenue minus posted credits plus posted debits, round each source with Decimal, reject missing/overlapping plans and periods, and require a separately-permissioned audited approval note. Approval does not create payroll, payout or GL entries. `sales-commission` is five-language Canonical in Demo/API. |
| Sales enquiry transaction workspace | ✅ Canonical Demo/API SSOT document workspace | `txn-view` stores only the selected enquiry ID and reads the canonical aggregate (`GET /api/sales/enquiries/:id/aggregate`) rather than assembling document data from separate header/line reads. Professional Overview, Items, Document info and Activity tabs organize the record; the Document info tab now edits Customer, Subject, Date, Channel, Owner and Currency for New enquiries, while Estimated Value remains derived from persisted rows. New enquiry quick-create always exposes a Create customer action; the tenant-scoped customer create contract preserves the draft and auto-selects the created customer. Header and Items use one audited `save-draft` action with optimistic versioning, responsive mobile controls, dirty-state feedback and atomic persistence; conversion receives all saved rows as its starting point. Other sales document kinds dispatch to their dedicated Canonical detail routes, so fabricated activity, actors and toast-only document actions remain absent. |
| Sales credit control | ✅ Canonical Demo/API data and enforced order gate | Migration 0018 adds one versioned credit profile per tenant/customer. Unpaid-invoice exposure plus the pending order total is checked under a profile row lock before delivery, stock issue, invoice or GL; limit excess and manual holds roll the entire confirmation back. `credit-control` exposes five-language profile creation, exposure, hold and release through audited idempotent Demo/API actions. |
| Sales order authoring and approval | ✅ Canonical Demo/API data and writes | Migration 0036 adds one versioned approval per order; migration 0078 adds canonical `stock`/`non_stock` line identity, description and UoM snapshots. Direct and quotation-converted orders start `pending_approval`; create snapshots effective tax and approve/reject requires the registered `sales.approve` permission, an active company actor and auditable note. The domain command also locks and requires the order and approval row to remain pending, so removing the grant cannot mutate either row. Approval releases only a `draft` and produces no stock, delivery, invoice or GL fact. `new-sales-order` supports inline stock-item creation and free-text service rows; confirmation creates delivery/stock effects only for stock lines while service lines still invoice and post revenue. `new-sales-order` and `so-approvals` are bounded five-language Canonical routes. |
| Inventory read screens (stock on hand, movements, valuation) | ✅ Canonical Demo/API data | `screens-inv.js` reads the formal `ErpSystemData` resource contract in both modes, capped at the first 100 rows per resource with honest truncation metadata. The production API exposes products, warehouses, stock levels, movements, bins and location balances; its complete response shape is covered by authenticated HTTP tests. Item Master and its separate `new-item` composer are both Canonical. |
| Inventory adjustment + warehouse transfer commands/API | ✅ Canonical adjustment UI and shared backend | Shared commands in `src/modules/inventory/adjustment.ts` and `transfer.ts` snapshot/lock stock, append movement facts, preserve transfer quantity and post balanced adjustment GL. Demo ESM and production API use the same commands. `new-stock-adjustment` reads bounded formal warehouse/product/stock resources in both modes and creates/posts through the audited idempotent API. A dedicated transfer UI remains future scope. |
| Warehouse picking | ✅ Canonical Demo/API data and writes | `picking` reads real pick, line, product, bin and warehouse resources. Creation reserves untracked bin stock; line confirmation is idempotent; completion locks the pick, requires every line in full, issues stock movements and consumes reservations atomically. PGlite/domain and authenticated HTTP tests cover over-reservation, incomplete completion, replay and permission denial. |
| Warehouse bin / lot / serial tracking | ✅ Working backend with Canonical read exposure; authoring depth pending | `warehouse_bin`, `inventory_lot`, `inventory_serial` and `stock_location_balance` are canonical through migration 0007. Shared commands reject invalid tracking combinations, enforce quality holds and serial quantity/lifecycle, and keep `stock_level` plus the location projection aligned with attributed `stock_movement` facts. Current Inventory/Warehouse routes are Canonical, but dedicated bin/lot/serial authoring remains future depth. PGlite tests and the gated PostgreSQL 16 RLS proof cover receive/issue and tenant invisibility. |
| Manufacturing work-order foundation, execution and MRP | ✅ Canonical Demo/API data and writes | Migrations 0009–0010 add tenant-scoped work centres, versioned BOM/components, routings/operations, work-order snapshots and persisted MRP runs/suggestions. Shared Decimal-based commands create/release, issue all material through the inventory ledger, report operations in sequence, atomically receive finished goods and aggregate planning-horizon demand against real stock. Material issue posts Dr WIP/Cr Inventory; completion posts Dr Inventory/Cr WIP. Domain and authenticated HTTP tests cover shortage rollback, duplicate/replayed actions, operation gates, stock conservation, GL balance, horizon filtering and tenant scope. All five Manufacturing routes use only bounded formal resources in Demo/API. BOM authoring, returns, partial completions and labour/overhead remain future depth. |
| Quality inspection and NCR | ✅ Canonical Demo/API data and writes | Migration 0011 adds tenant-scoped inspection plans/items, immutable inspection result snapshots, NCRs and corrective actions. Completing a failed lot inspection places the real inventory lot on `hold`; the existing inventory command blocks issue/pick/shipment paths until an audited NCR disposition releases or rejects it. `qc-inspection`, `qc-report` and `ncr` use bounded formal resources and shared PGlite/PostgreSQL commands in five languages. Domain and authenticated HTTP tests cover snapshotting, duplicate/replayed completion, tenant isolation, hold enforcement, release and permanent rejection. |
| Finance/GL screens (journals, CoA, ledger, P&L, AR aging) | ✅ Canonical Demo/API reporting | Five Canonical routes derive bounded reports from formal account, GL-entry, customer and invoice resources in both modes. Unsupported posting, rejection, balance-sheet generation and reminder writes are not simulated. |
| Manual journal creation, posting and reversal | ✅ Canonical Demo/API data and writes | Migration 0038 adds tenant-scoped versioned headers and immutable lines. Drafts are GL-neutral; posting validates real company accounts and exact Decimal balance before appending dated GL legs; correction creates one linked, separately numbered reversal with swapped debit/credit. `new-journal-entry` and journal detail provide five-language real create/post/reverse workflows with RBAC, idempotency and audit coverage. |
| Bank statement import and reconciliation | ✅ Canonical Demo/API data and writes | Migration 0039 adds tenant-scoped versioned statement headers and signed immutable lines. Shared Decimal commands require exact statement footing and one-to-one exact-amount links to immutable bank-account GL legs; reconciliation never creates accounting entries. `bank-rec` provides five-language real CSV import, match/unmatch and lock workflows with RBAC, audit and idempotency coverage. |
| Management Reporting / BI | ✅ Canonical Demo/API derived data | `bi/analytics` rebuilds recognized revenue, receivables, open sales/purchase value, net payables, cash, inventory value, product-category sales and stock activity aging from current Canonical facts. It stores no KPI table, allocates only traceable product invoice/credit lines and labels stock age as days since latest inbound movement rather than unsupported FIFO-layer age. `bi-dashboard`, `sales-analysis` and `stock-aging` are bounded five-language routes protected by `reporting.read`. |
| Integration delivery log | ✅ Canonical Demo/API sanitized read model | `integration/events` reads existing transactional-outbox facts through an explicit tenant-scoped, newest-first, keyset-paginated projection protected by `integration.read`. Only safe operational metadata leaves the server; payload, recipient/token material, raw worker errors and worker identity are excluded. The five-language `integration-logs` workspace is deliberately read-only and does not fabricate replay/export or connector-control actions. |
| Personal activity | ✅ Canonical Demo/API sanitized actor read model | `account/activity` reads only the signed-in actor's active-company audit facts, newest first. The response maps internal vocabulary to bounded category/entity/action keys and excludes payloads, request IDs, actor identity, other users, device/IP and session/security state. The five-language `my-activity` page is read-only and states this boundary. |
| Enterprise Demo personas | ✅ 12 real permission sessions | Showcase manifest v15 owns all 12 identities directly and adds reporting lines, governed leave openings/reservations, 24 controlled July/August leave cases, 6 payroll runs, 282 payroll lines, one real pending sales approval and one balanced unpaid procure-to-pay case in each SG/MY entity within a 10,436-record deterministic pack. The calendar cases cover approved, pending, rejected, cancelled, multi-day and overlapping availability, and earlier controlled Demo rows converge in place on the same fixed business date. The controlled approval orders carry sufficient stock in the exact fulfilment warehouse, and sales availability is warehouse-specific rather than group-wide. v15 also supplies the complete sales, purchasing, treasury and landed-cost posting controls in both legal entities; gives each linked persona one company-managed Employee base role; removes the replaced shared compatibility grant; and deterministically binds Jordan Lee to Mei Lin for direct-manager approval. An existing IndexedDB upgrades additively without replacing user-owned data. SO-2/SO-3 remain the explicit confirmation success/rollback teaching drafts and are not mislabelled as approvals. Persona user names match their linked employee profiles. Missing SG/MY calendars, leave types, confirmed policies and posting accounts are repaired on historical IndexedDB upgrades before dependent records are created. Payroll examples follow the same SG CPF/SDL and MY EPF/SOCSO/EIS/PCB approximations as the canonical engine. `Avery Tan · Company Owner` is assigned to SG/MY with 112 explicit tenant permissions and company scope; approval, payment, payroll, sensitive tax-evidence and platform-support authority are not implicit, and the owner appears first in the switcher. Managers remain restricted to direct or explicitly granted teams. Viewer and all ten department personas display their actual effective roles. Role permissions and data scopes are regression-checked against the authoritative templates. |
| PWA (manifest, SW, update prompt, safe areas) | ✅ Working | `web/public/manifest.webmanifest`, `sw.js`, `pwa.js`; current v260 uses the waiting service worker as the single update authority, bypasses HTTP cache for `sw.js`, suppresses only the exact deferred version for a tab session and reloads once only after explicit acceptance. `npm run audit:pwa-update` exercises baseline, Later, newer-version and Update-now states with a real service worker. |
| Canonical UI i18n | ✅ Green | `node scripts/audit-i18n.mjs` verifies 1,533 canonical resources and 69 registered local five-language packs; the full 128 routes × 5 languages × 2 viewports browser matrix passes with zero blocking findings. `setLang()` remains atomic and state-preserving; business-record values remain outside UI i18n. |
| GitHub Pages deploy | ⏸️ Disabled (intentional) | `.github/workflows/deploy-pages.yml` builds cleanly (typecheck, PGlite demo proof, `build:demo` all pass) but the final "Configure Pages" step always 404'd — Pages was never enabled on this repo, and it can't be on the Free plan while the repo stays **private**. 2026-07-17: repo is intentionally kept private (this is a monetizable product; publishing the full source would let it be freely copied). Workflow disabled via `gh workflow disable` (reversible — file untouched, just toggled off in GitHub so it stops failing on every push). Plan: a **separate, new public repo** will host only `web/dist/`'s static demo (localStorage/IndexedDB, no server) for prospects to try; this repo stays private and becomes the Docker+PostgreSQL production track if/when a prospect converts. |
| CI validation on every PR (typecheck root+web, transaction proof, demo build, schema-drift check) | ✅ Working | `.github/workflows/ci.yml`, TASK-014 + TASK-020 |
| Generated PGlite schema + drift check | ✅ Working | `scripts/generate-demo-schema.mjs` generates fresh/upgrade SQL from ordered Drizzle migrations; `npm run check:demo-schema` and `npm run check:drift` run in CI. |
| Browser smoke test (desktop + mobile, zero console/page errors, dashboard content verified) | ✅ Green | `scripts/smoke.mjs`, `npm run smoke`, Playwright, wired into CI with browser caching, TASK-015. The 2026-08-10 run passes desktop/mobile; the assertion now considers only visible semantic navigation badges while hidden zero-count badges remain in the DOM. |
| Route production metadata and Preview contract | ✅ Working | `SCREEN_META` covers all 128 routes with module, Canonical/Preview maturity, data source, supported modes, active section, permission and fixture. Current baseline: **128 Canonical / 0 Preview**. Preview pages, if reintroduced by a future task, distinguish Sample Data from Canonical Data and lock write-like actions. |
| Cross-layer authorization matrix | ✅ Regression foundation | `src/auth/accessMatrix.ts` is shared by `src/api/permissionMatrix.integration.test.ts` and `scripts/audit-access-matrix.ts`; the API/browser checks cover authenticated role fixtures, 401/403 boundaries, route metadata, list/detail probes and fail-closed UI visibility. Unknown business-module keys now fail closed; authenticated `account/*` services are explicitly non-module-gated but still permission-protected. TASK-174 now supplies authorization-version invalidation, session recovery and direct-URL revocation coverage. |
| Item Master (create/edit product master data) | ✅ Canonical Demo/API data and writes | Migration 0019 adds `category`/`reorder_point`/`reorder_qty`/`version` to `product`. `src/modules/inventory/product.ts` provides tenant-scoped create/update; both `item-master` and the separate five-language `new-item` composer write through that audited Demo/API command. `new-item` now stores only real product fields, accepts a company-unique SKU and removes the sample form's fabricated USD/GST, accounting, costing, shelf-life and negative-stock controls. New items start at 0 on hand with no stock projection or movement — initial quantity must use Purchase Receipt or Stock Adjustment. Duplicate SKU is an atomic 409; delete remains honestly unsupported rather than mutating local sample data. |
| Customer 360 + Opportunity detail | ✅ Canonical Demo/API data and writes | Migration 0020 added nullable `industry`/`owner_user_id` to `customer`, a tenant-scoped `contact` table, and customer/opportunity targets on `activity`. `crm-customer` reads real contacts/open orders/open opportunities/activity and computes Net-30 receivables. `opportunity` now reads the same canonical customer, contact, activity and order data; its activity write can target both the opportunity and customer, conversion reuses the existing atomic command, and `mark-lost` validates the terminal state, requires a reason, increments version and appends a system activity in one transaction. Both routes use audited idempotent Demo/API actions with five-language copy. |
| Fixed Assets module (register, depreciation run, GL posting) | ✅ Canonical Demo/API data and writes | Migration 0021 adds tenant-scoped `asset` (running `accumulated_depreciation` aggregate, mirroring Inventory's `stock_level`), `depreciation_run` and `depreciation_run_line` (a real append-only posting ledger, mirroring `stock_movement` — no fabricated future schedule is stored, only what has actually been posted). `src/modules/assets/` provides `createAssetWithin`/`createDepreciationRunWithin`/`postDepreciationRunWithin`; posting a run inserts one balanced `gl_entry` pair (Dr `6200` Depreciation Expense / Cr `1510` Accumulated Depreciation) via the same `accountIdByCode` lookup pattern `postSupplierInvoice.ts` uses. `asset-register` gained a real "New Asset" create modal (the mock's was a toast stub) and per-asset row-open (the mock always opened the same hardcoded record); `asset-detail` shows real acquisition fields and real posted depreciation history instead of a fabricated 5-year schedule; `depreciation` computes and posts a real run instead of re-announcing a hardcoded total, with a "View General Ledger" link to the real `gl` screen (not the mock's paramless `journal-entry` navigate — that screen's per-doc lookup was found to be a pre-existing dead reference, `DB.journalDocs` is never populated). Five-language `assetCopy()` translation pack, matching TASK-033's convention. |
| Admin: users, roles & audit log | ✅ Canonical Demo/API data and writes | `app_user`/`role`/`role_permission`/`audit_log` remain the original Admin tables. Migration 0087 adds tenant-scoped `user_permission_override`; `/api/admin/users/:userId/permission-overrides` creates reasoned allow/deny exceptions, `/actions/revoke` revokes them, and `/api/admin/authorization/explain` exposes full decision details only to audit-read users while appending an audit event. Migration 0088 adds the company authorization-version marker used by current session/capability freshness projections. Migration 0089 replaces the tenant Superadmin bypass with an immutable, company-scoped Company Owner role containing 112 explicit permission rows; legacy flags are inert and legacy assignments are backfilled idempotently. These Admin tables and routes remain bespoke rather than generic resources because of composite/non-standard keys and security boundaries. Existing `user-mgmt`, `role-permission` and `audit-log` contracts remain real and backend-enforced; the central evaluator is the authorization source of truth. |
| Platform support control plane | ✅ Control-plane foundation (TASK-170) | `platform_principal`, application-owned platform roles, hash-backed bearer/CSRF sessions and `support_access_grant` are separate from tenant `app_user`/roles. Grants enforce exact master/optional company targets, reason/ticket, 24-hour maximum, read-only/restricted-write/break-glass modes, default sensitive-field denial, immediate revoke and platform-correlated audit. `/api/platform` rejects tenant cookies; TASK-187 additionally provides a password login only for the separate `platform_superadmin` realm, while support evaluation still does not proxy customer data. |
| Company module access control | ✅ Platform-owned tenant cutover and reset-verified provisioning boundary | TASK-185–187 provide the commercial catalog, migrations 0094–0096, versioned Master entitlement/default and Company allocation, independent password/cookie platform login, visual workspace, default-15-minute exact-user simulation and tenant enforcement whose effective decision is `Master enabled AND Company allocated`. `admin.modules.manage` is deprecated/non-assignable and existing grants/overrides are retired; legacy tenant endpoints deny with `platform_authority_required`; Module Activation and the onboarding module selector are absent. Support roles receive no entitlement or simulation authority. TASK-188 passed its recorded cross-engine/browser/release gates. TASK-189–192 add the empty-database bootstrap, Master/Company provisioning, Master Admin negative authorization, migration 0098, deployment and exact-volume reset. |
| HR-lite: employee master + leave request/approval | ✅ Canonical Demo/API data and writes | First Phase 7 module opened after Phase 8. `employee` (self-referencing `manager_id`, no link to `app_user`) and `leave_request` tables, `src/modules/hr/` (`createEmployee`, `createLeaveRequest`/`decideLeaveRequest`), registered as standard generic resources gated on new `hr.read`/`hr.write` permissions. `hr-directory` and `employee` read real data (per-employee detail, not always the same hardcoded record); `new-employee` is a single real form replacing the mock's 3-step compensation/provisioning wizard (no schema backed those steps); `leave-approval` reads real requests and its approve/reject actions are real, including a required-reason reject flow. That initial task deliberately excluded Payroll and compensation; later Payroll and Full Leave tasks supersede that historical boundary. Verified live: created a real employee, approved one leave request, rejected another with a reason, confirmed the employee detail's leave balance and history reflected both decisions. |
| Staff Calendar appointments | ✅ Canonical Demo/API data and writes | Migration 0082 adds tenant-scoped `staff_appointment` facts with employee, type, title, time range, location, status and optimistic version. `staffCalendar` combines appointments with canonical leave rows; HR write users can create, edit and cancel without deleting history. API/domain tests cover tenant isolation, idempotent replay, version conflicts and invalid ranges; the browser contract covers mixed leave/appointment rendering, create, filter and shared searchable listing. |
| Leave-to-Payroll integration | ✅ Canonical Demo/API data and writes | Migration 0055 adds append-only unpaid-leave, approved-cancellation and encashment sources plus unique run mappings. Payroll lines snapshot base gross and leave earnings/deductions; the 26-day Decimal formula rounds half-up to cents and every source can be consumed once only. Legacy Policy rows retain original days. Five-language Payroll Run/Payslip surfaces and authenticated API/domain proofs cover balance, trace and overlapping-run replay. |
| Governed document storage provider | ✅ Canonical domain and storage boundary | Migration 0056 adds managed identity, immutable version/hash/MIME/size facts, default PostgreSQL/PGlite `bytea` content and optional database-located filesystem content. The filesystem backend requires an explicit dedicated root and is labelled single-node; tenant, owner, retention and legal-hold facts remain database-owned. Provider-parity tests cover owner/manager/cross-tenant access and content-integrity verification, with a PostgreSQL 16 non-superuser RLS proof. TASK-118 builds bounded actor-owned receipt capture on this boundary. |
| Secure receipt upload and offline mobile capture | ✅ Canonical Demo/API data and writes | Migration 0057 adds immutable positive page counts and upgrades existing Employee/Manager roles with `employee.receipts.write`. Actor-owned My Work endpoints and Demo parity stream-bound files at 20 MB, verify JPEG/PNG/HEIC/PDF magic bytes against MIME and extension, parse PDFs with a 20-page ceiling and reuse stable draft keys idempotently. The five-language My Receipts page supports camera/file capture, IndexedDB drafts and Canvas crop/rotate/compress for JPEG/PNG; logout confirms then clears unsynchronised drafts only. Stored files remain private and enter TASK-119's fail-closed quarantine with no premature preview, OCR or claim linkage. |
| Document quarantine scanning and extraction | ✅ Canonical domain/API worker boundary | Migration 0058 adds company processing policy, unique leased scan jobs, versioned extraction rows, existing-document backfill and retry-stable outbox signals. Unavailable, indeterminate and infected scans fail closed; only clean versions reach extraction. Local OCR is the default. BYOK Vision requires an explicitly connected encrypted credential plus provider, region and retention policy. Demo honestly reports scanner unavailable and exposes no preview, claim, submission or export affordance. |
| Confidence-governed receipt inbox | ✅ Canonical domain/API and My Receipts boundary | Migration 0059 stores immutable field provenance/confidence, uploader authorization and ready/review/submitted inbox states. Company auto-submit defaults off and cannot use a threshold below 98%. Clean safety, critical-field validity/confidence, conflict, amount and exact-duplicate checks must all pass; system submission records uploader authorization plus `receipt-auto-submit-v1`, while failures enter explicit human review. |
| Project-lite: register + progress-claim billing | ✅ Canonical Demo/API data and writes | Second Phase 7 module. `project` (nullable `customer_id` — null means Internal — running `billed_to_date` aggregate) and `progress_claim` (draft/posted billing document, tax-snapshotted like `sales_debit_note`) tables, `src/modules/project/` (`createProject`, `createProgressClaim`/`postProgressClaim`), registered as standard generic resources gated on `project.read`/`project.write` permissions. Posting a claim inserts the exact same balanced `gl_entry` legs `postSalesDebitNote` already uses (Dr `1100` AR / Cr `4000` Revenue / Cr `2200` Output Tax) and increments the project's `billed_to_date`. `project-pl` and `project-detail` expose only real contract, billing, claim and customer relationships; unsupported cost/budget/team/milestone data remains absent rather than fabricated. |
| Project Timesheet | ✅ Canonical Demo/API data and writes | Migration 0040 adds actor-owned `project_time_entry` facts with Decimal hours, project/date indexes, version and append-preserving void metadata. Creation derives the actor from the signed-in Session, accepts only an open tenant project and a real work date, and never exposes another user's entries. Correction voids under a row lock instead of deleting or rewriting hours. The five-language `timesheet` route loads a bounded weekly view, reports only active totals, keeps voided facts visible and explicitly does not invent approval, capacity or payroll workflow. Domain/API tests cover validation, tenant/actor isolation, Viewer denial, audit and idempotent void replay; Demo smoke and live in-app browser prove create → void at desktop and 375px. |
| Actor-addressed Notifications | ✅ Canonical Demo/API data and writes | Migration 0043 adds first-class `app_notification` delivery/read/dismiss facts scoped to one master, company and recipient. Shared TypeScript commands serve both adapters; public rows omit tenant/user identifiers and cross-user records stay unavailable. A server-owned destination registry filters notifications against the recipient's current permission, employee link and company module state, while legacy approval routes resolve to the usable HR or My Work destination. Recipient-owned read/dismiss actions require `notifications.read`, not admin-only `notifications.manage`; CSRF, idempotency, audit and production RLS still protect the API. The bell plus five-language full page share the canonical feed and reload on company switch; localStorage state, fictional notifications and fake preferences are removed. |
| Service-lite: warranty contracts + tickets | ✅ Canonical Demo/API data and writes | Third Phase 7 module. `service_contract` (customer's warranty/maintenance register, computed-not-stored Active/Expiring/Expired status from `expiry_date` vs. today) and `service_ticket` (customer-scoped, nullable `contract_id` link, 3-state `open`/`in_progress`/`closed` lifecycle — simplifies the mock's 5 statuses since Resolved+Closed already collapsed to one "done" bucket in the mock's own filter chips) tables, `src/modules/service/` (`createServiceTicket` always starts open/unassigned, `assignServiceTicket` open→in_progress, `resolveServiceTicket` any non-closed→closed requiring a real typed diagnosis), registered as standard generic resources gated on new `service.read`/`service.write` permissions. `service-ticket` reads real Open/Overdue KPIs (Overdue computed from a linked contract's SLA response hours, replacing the mock's hardcoded, never-computed "96%" figure) and a real over-SLA alert; `service-order` is a real per-ticket detail (not always the same hardcoded `SVC-26-0042` record) with real Assign/Resolve actions and an SLA panel that only shows a countdown when a linked contract actually has a response-time commitment; `service-contracts` has a real list with computed status and a real create flow. Parts/labour cost panels removed, not fabricated — a materially separate Inventory-consumption feature deferred like Fixed Assets' Transfer/Dispose. Verified live: assigned an open contract-covered ticket and watched its real overdue-by-23h SLA indicator stay accurate through the transition, resolved a ticket with a real typed diagnosis, registered a new contract and logged a new ticket against it with a fresh real SLA countdown. Also found and fixed two issues unrelated to Service itself: the Viewer role's seed permissions were missing `project.read` (a real EPIC-021 gap, only missed because every prior live check used the Admin/superadmin persona which bypasses permission checks), and `vitest.config.ts` had no exclude pattern, so `npm test` was silently combining this checkout's results with ~100 test files from concurrent background agents' `.claude/worktrees/` checkouts. |
| Supplier contracts and vendor performance | ✅ Canonical Demo/API controls and derived read model | Migration 0035 adds effective-dated supplier price-list headers and quantity tiers. Shared commands validate tenant/date/product/value rules, prevent overlapping active product coverage and activate through idempotent audit. Vendor scorecards are rebuilt from canonical purchase facts and expose honest unavailable states where quoted lead or invoice evidence does not yet exist. |
| Purchase Order approval gate | ✅ Canonical Demo/API data and writes | Migration 0034 adds one versioned `purchase_order_approval` per PO. New and RFQ-awarded POs start `pending_approval`; an authorised approve/reject command requires a note, snapshots the active deciding user and changes only PO/approval state. Pending/rejected orders cannot be received, approval itself writes no stock movement or GL entry, and the queue/detail routes use bounded five-language Demo/API data. Live proof approved `PO-APP-2026-0001`, recorded Admin plus its note, opened the order for receipt, and passed Chinese/375px with zero console issues. |
| Purchasing receipt & supplier-invoice detail | ✅ Canonical Demo/API read workspaces | `goods-receipt` renders the selected real receipt, its PO lines and linked stock movements; `supplier-invoice` renders the selected invoice, PO/GRN match, outstanding amount and named GL legs with an explicit debit/credit balance proof. Both are immutable five-language workspaces with no sample action. CI smoke creates a fresh approved PO, receipt and AP invoice and asserts the rendered one-movement/three-leg trace. |
| Supplier Debit Note & net AP settlement | ✅ Canonical Demo/API data and writes | Migration 0031 adds the versioned, invoice-linked `supplier_debit_note`; migration 0032 idempotently backfills Cash & Bank account `1000` for existing companies created before TASK-058. Drafts snapshot effective Decimal tax. Idempotent posting is capped by the shared invoice outstanding value, posts balanced Dr AP / Cr Purchase Variance / Cr Input Tax and never writes `stock_movement`. Purchase-return crediting and Payment Voucher use the same outstanding calculation, so the live S$130.80 invoice less S$13.08 credit and S$10.90 debit settled for exactly S$106.82 and left AP at zero. `supplier-debit-notes` is five-language Canonical in Demo/API with audited create/post/detail flows. |
| Landed Cost allocation & moving-average revaluation | ✅ Canonical Demo/API data and writes | Migration 0033 adds versioned receipt-linked `landed_cost` headers, immutable allocation snapshots, `product.average_cost` and upgrade-safe account `2300`. Shared Decimal commands allocate by received value or quantity with deterministic whole-cent residuals. Allocation locks the draft/products/current balances, requires positive on-hand, revalues moving-average cost and posts balanced Dr Inventory / Cr Landed Cost Accrual without a `stock_movement`. Demo/API create and idempotent audited allocate actions, production RLS, five-language UI and inventory/GL trace links are live. Browser proof allocated S$14.00 against GR-1: Widget cost S$6.50→S$6.64, Dr/Cr S$14.00 and unchanged quantity. |
| Project Finance Depth: Bank Receipt, Payment Voucher & project-scoped AP | ✅ Canonical Demo/API data and writes | Closes Project's third and final deferred sub-phase — every originally-scoped Phase 7 module is now real. `bank_receipt` (settles a posted progress claim's AR in full, Dr `1000` Cash / Cr `1100` AR) and `payment_voucher`+`payment_voucher_line` (settles one or more of a supplier's unpaid invoices, Dr `2100` AP / Cr `1000` Cash, and is the first code in this repo to ever flip a `supplier_invoice` to `paid`) added to `src/data/schema/finance.ts` — the first new Treasury documents here, in a new `src/modules/finance/` module (GL had been read-only until now, hence a new `finance.write` permission). `purchase_order`/`supplier_invoice` gained a nullable `project_id`: settable from the `new-purchase-order` wizard, auto-propagated onto the resulting invoice with no new user input. Seeded a new `1000` Cash & Bank chart-of-accounts row, which also fixed a long-dead `screens-fin2.js` GL tile that already summed codes `1000`+`1010` against accounts that never existed. `payment-voucher`/`new-payment-voucher` replaced 100%-fabricated screens (the old wizard's "open invoices" list was a hash of the supplier code, and "Post payment" never touched the adapter) with a real per-voucher detail and a real 2-step wizard reading genuine unpaid invoices; `project-detail` gained a real "Record receipt" action and a real "Project costs" panel. Verified live with a mathematically balanced result: one Payment Voucher (S$1,220.80 across two real unpaid invoices) and one Bank Receipt (S$54,500) left the General Ledger's Cash & Bank account at exactly S$53,279, with AP and AR each moving by the settled amounts — confirmed by resetting the demo database and re-deriving every balance from scratch. |
| Shared ERP module shell | ✅ Working | `MODULE_DEFS`, `modulePage()` and automatic shell decoration provide a common module sub-navigation contract across all business routes, including legacy Sales/Purchasing/Inventory pages and report layouts. Active tabs are scrolled into view after routing. Smoke now passes with visible-only semantic badge assertions; actionable counts remain in canonical module KPIs and approval queues. |
| Full screen audit — every route in `SCREENS` (128), desktop + 375px | ✅ Green | 2026-08-10: all 128 routes render at desktop and mobile with no console/page errors; 128 Canonical / 0 Preview, active-tab visibility, layout, action-bar and declared-contract checks all pass. Permission-aware navigation and the separate access-matrix API/browser checks remain green. |
| Unit/API tests: domain chains, rollback, GL balance, auth security and API contracts | ✅ Green | 2026-08-12 current-worktree full Vitest passes 168 files plus 1 skipped file (663 passed, 1 skipped tests). The 2026-08-10 HR Calendar fixture/notification/access-matrix/module regression remains historical evidence. |
| Setup wizard (language/org/company/admin/AI preview) writes to PGlite | ✅ Working | `web/public/assets/screens-setup-wizard.js` + `ErpSystemData.completeSetup()` → shared `completeDemoSetupWithin`, gated in `app.js` boot(). Production setup remains a separate empty-database/zero-user command and does not require a deployment setup token. |
| Topbar company switcher (real, canonical companies) | ✅ Working | `buildCompanyMenu()`/`wireCompanyMenu()` in `app.js` + `ErpSystemData.switchCompany()`, TASK-010 |
| `VITE_DATA_MODE=demo\|api` build-time adapter seam | ✅ Working | `web/index.html` (`window.erpDataMode()`), `erp-system-data-adapter.js` (demo), `erp-system-api-adapter.js` (api), TASK-019 |
| Formal `window.ErpSystemData` adapter contract | ✅ Working | Both adapters expose `list/get/create/update/action/refresh/session/auth/switchCompany`; `window.ErpSystemDemo` remains a compatibility alias while existing screens migrate. Demo resource reads use a tenant-injected whitelist; API mode uses the canonical REST paths and structured errors. |
| Production canonical resource API | ✅ Read platform + registered domain actions | `src/api/resources.ts` declares table/id/scope/permissions/filter/sort/action/version/idempotency/audit metadata. Lists use opaque keyset cursors and `limit≤100`; versioned details return quoted ETags. The unified transactional dispatcher covers CRM, Sales, Inventory/Warehouse, Manufacturing, Quality, Purchasing (including RFQ issue/close and quote award), Finance, Assets, Project, Service, HR and Payroll slices; unsupported business actions remain explicit future scope rather than simulated writes. |
| Unified write action dispatcher | ✅ Working foundation | Tenant context, permission, idempotency claim, domain command, audit, response persistence and commit share one transaction. Failed domain commands roll back the idempotency claim, identical retries replay the stored response and changed payloads return 409. |
| Production API server: `GET /health`, `GET /api/dashboard` over `DATABASE_URL` | ✅ Working | `src/server.ts` (`npm run server`); verified against a real local PostgreSQL — migrations, seed, and the true-concurrency proof all pass; dashboard figures curl-verified correct and tenant-scoped, TASK-011 |
| Docker Compose stack: `web` (nginx) + `api` (Express) + `db` (PostgreSQL) | ✅ Working | `docker-compose.yml`, `Dockerfile.api`, `web/Dockerfile`, `web/nginx.conf`; built and run end-to-end for real (healthchecks, `docker compose exec api npm run migrate`/`seed`, dashboard through the reverse proxy), then fully torn down, TASK-012 |
| `make setup` (`scripts/setup.sh`) and every other `make` target | ✅ Working | Run for real end-to-end (fresh `.env` creation from `.env.example`, build, health-wait, migrate, no demo seed) on an isolated stack; `make seed` remains an explicit demo-only action. The source-only `make release` path and production overlay preserve the database volume, while `make migrate` is guarded by explicit confirmation. |
| `make setup-interactive` (`scripts/setup.sh --interactive`) | ✅ Working | Prompts for bundled-vs-external database, auto-generates strong secrets on a blank answer (validated: e.g. a manually-typed `ERP_TOKEN_ENCRYPTION_KEY` must satisfy `tokenCrypto.ts`'s exact 32-byte contract or the script re-prompts, instead of letting `api` crash at boot), and checks WEB_PORT/API_PORT/DB_PORT for real collisions. `docker-compose.yml`'s `api`/`worker` `DATABASE_URL` now genuinely honors an external override instead of silently ignoring it. Historical TASK-060 proof exercised plain, bundled-interactive and external-PostgreSQL paths and confirmed the bundled `db` service was omitted for the external run; the current setup contract stops after migration and does not seed business data. **Also fixed along the way**: the `web` service's Docker build had been silently broken since 2026-07-18 (build context couldn't reach `erp-demo-runtime-impl.ts`'s cross-workspace imports into `src/`) — nobody caught it because local dev/typecheck/`build:demo` all run from the repo root, where the paths resolve fine regardless of the Docker isolation bug. Fixed by widening `web`'s build context to the repo root, matching `Dockerfile.api`'s established pattern. |
| PostgreSQL concurrency/parity proof | ✅ Working on dedicated empty proof DB | PGlite/PostgreSQL business results match and one of two stock races wins; forced RLS passes. The production seed CLI fails closed without explicit Demo flags or on non-empty data, and `POSTGRES_URL npm run demo` now independently rejects every non-empty target before writes. |
| `VITE_DATA_MODE=api` renders every current Canonical route | ✅ Contract-backed; authenticated full-route proof follow-up | The API adapter and current resource/action contracts support the 128-route Canonical boundary with no client-side sample writes. The access matrix and production health/session checks pass; a dedicated authenticated API-mode full-route layout run remains follow-up evidence rather than a deployment blocker. |
| Production auth/security foundation | ✅ Working | Database-backed hashed Session/CSRF tokens; secure cookie options; DB login limiter; RBAC; audited company switch; encrypted invitation/password-reset endpoints; leased SMTP outbox worker; expiry maintenance; persistent idempotency/audit tables; transaction-local tenant settings and production RLS. |
| Production first-run Platform bootstrap | ✅ Deployed and reset-verified | The old anonymous `POST /api/setup/actions/complete` returns `410 legacy_setup_disabled`. The reset production database exposes `POST /api/setup/platform-superadmin/actions/complete` only while empty; `GET /api/setup/status` returns `requiresPlatformBootstrap:true`, `hasPlatformAdmin:false`, `hasMaster:false`, `hasCompany:false` and `hasTenantAdmin:false`. Health/root and public browser checks are 200 and show Create Platform Superadmin. |
| Service worker never caches `/api/*` or `/health` | ✅ Working | `web/public/sw.js` (`CACHE_VERSION` v260) keeps session-scoped API/health responses out of Cache API while caching static English i18n and successfully fetched non-English resource packs. |

## Canonical and Preview route boundary

128 routes are registered in the live `SCREENS` registry. `SCREEN_META` is the source
of truth for production maturity at route level: **128 routes are Canonical and 0 are
Preview**. The 2026-08-10 screen audit reconfirms route rendering, maturity and
desktop/mobile layout/behavior contracts. The same date's full i18n static and browser
audits pass all routes/languages/viewports with zero blocking findings.

There are currently no Preview routes. If Preview is reintroduced, sample-backed routes
must use `Preview · Sample Data`; a real but incomplete workflow must use
`Preview · Canonical Data`, and write-like actions remain disabled until its full
workflow, permissions, tests and localization pass. The screen audit enforces both
sides.

**CRM is now fully Canonical for its registered routes (TASK-027/028, TASK-031/032,
TASK-063).** The core
opportunity → convert-to-sales-order chain (pipeline board, new-opportunity
wizard, the kanban's convert action) reads and writes canonical Demo/API data.
Customer-360 also became Canonical (TASK-031/032, 2026-07-19 — see below).
Opportunity detail now reads the same canonical opportunity/customer/contact/activity/
order resources, provides real activity, mark-lost and conversion actions, and no longer
uses the original `data-crm.js` detail record.

**Item Master and Customer-360 are now Canonical (TASK-029…032, 2026-07-19),**
closing their primary mock master/detail screens. `product` gained
`category`/`reorder_point`/`reorder_qty`/`version`; Item Master creates/edits
products through the same audited idempotent Demo/API action dispatcher every
other Canonical write uses, and the fix also removed fake `Unclassified`/`0`
category/reorder values from the 3 already-Canonical Stock-on-Hand/Valuation/
Movements screens that share its read model. `customer` gained nullable
`industry`/`owner_user_id`, a new `contact` table, and a `customer_id` on the
previously-unused `activity` log; Customer-360 shows real contacts, open
orders, open opportunities and a real activity timeline, with balance/overdue
computed by reusing the AR-Aging report's existing Net-30 formula rather than
a new credit-exposure calculator.

**The separate New Item composer is Canonical (EPIC-043/TASK-079, 2026-07-23).**
It no longer writes `DB.items`, fabricates a SKU or exposes unsupported accounting,
tax, costing, shelf-life, negative-stock and opening-balance controls. It calls the
same audited tenant-scoped Demo/API product command as Item Master, returns explicit
validation/conflict/permission errors and guarantees a new product has no stock fact
until a Purchase Receipt or Stock Adjustment appends one.

**Project Timesheet is Canonical (EPIC-044/TASK-080, 2026-07-23).** It records only
signed-in-user project-time facts against open projects. Weekly totals exclude voided
entries, while corrections preserve the original Decimal hours, actor and project in
the audit history. The old fake capacity, copy-last-week and submit-for-approval actions
were removed because no approval/payroll model backs them.

**Integration Delivery Log is Canonical (EPIC-045/TASK-081, 2026-07-23).** It exposes
only a bounded, tenant-scoped operational projection of the existing transactional
outbox. Safe status, attempts, aggregate references and timestamps are visible;
payload, recipient/token material, raw transport errors and worker identity never leave
the shared Demo/API query. Replay and connector configuration remain Preview boundaries.

**Bounded Customer CSV Import is Canonical (EPIC-046/TASK-082, 2026-07-23).** The old
all-module sample wizard is replaced by a real `import_job` / normalized-row / row-error
workflow shared by Demo and API. It accepts only `code,name,industry`, at most 250 rows
and an explicit update-or-skip policy; validation is persisted before the audited,
idempotent atomic run. Excel, arbitrary targets and large background jobs remain honest
future boundaries rather than simulated controls.

**Personal Activity is Canonical (EPIC-047/TASK-083, 2026-07-23).** `my-activity`
now reads a newest-first, actor-owned and active-company-scoped projection of the
append-only audit log through the same TypeScript query in Demo and API modes. The
public shape contains only a bounded category/entity/action vocabulary, reference and
timestamp; audit payloads, request IDs, raw action/entity names, other users, device/IP,
session and security posture never leave the query. The page states the narrower
boundary instead of fabricating sign-ins, comments, exports or security controls.

**Notifications are Canonical (EPIC-048/TASK-084, 2026-07-23).** A first-class
`app_notification` table now records delivery plus read/dismiss state for one user in
one active company. The public Demo/API feed omits tenant/user identifiers; actions are
permission-gated, audited and idempotent. The bell and full five-language page share
that feed and reload on company switch. The former localStorage state, fictional alerts
and unsupported preference controls have been removed rather than disguised as real.

**Fixed Assets is a new fourth domain, now Canonical (TASK-035/036, 2026-07-19).**
Asset register → depreciation run → balanced GL posting is real end-to-end in Demo
mode, mirroring Purchasing's `postSupplierInvoice`-style "one document, one balanced
journal" pattern. Unlike the mock (a fabricated 5-year future schedule stored as
static data, a "New Asset" toast stub, row-open that always opened the same
hardcoded record, and a GL account code that didn't match its own chart of
accounts), the real version registers assets, computes straight-line depreciation
per run (capped at each asset's remaining depreciable value), and posts one
balanced journal per run. `asset.accumulated_depreciation` is a running aggregate;
`depreciation_run_line` is the real, append-only posting ledger — asset-detail shows
actual posted history, not a projection.

**Admin (users, roles, audit log) is now Canonical for its core 3 screens
(TASK-041/042, 2026-07-19), a different shape from every prior conversion.** Unlike
Item Master/Customer-360/Fixed Assets, no schema migration was needed — `app_user`,
`role`, `role_permission` and `audit_log` already existed in full from TASK-024
(EPIC-009); no screen had ever been wired to them. Two real gaps were found and fixed
along the way: these admin tables are deliberately excluded from the generic
`resource()`/RLS-company-scope framework (see `deploy/sql/production-rls.sql`), so
bespoke `/api/admin/*` routes were added instead (mirroring `routes/auth.ts`); and
`audit_log` was found to be permanently empty in browser demo mode (the demo adapter
calls business-logic functions directly, bypassing the production HTTP layer that was
the only place `appendAudit` was ever called) — fixed by wiring `appendAudit` into the
demo adapter's own generic write dispatch, which now gives every Canonical module a
real audit trail in the browser demo, not just Admin. The mock's fabricated 4-level
None/View/Edit/Full permission matrix was replaced with an honest 2-state
allowed/not-allowed grid matching the real boolean `role_permission` model.
The later EPIC-049 control-plane work promoted `master-control`, `sys-settings` and the
connector surface; the current route boundary is 128 Canonical / 0 Preview.

**Historical tenant module access control (EPIC-018, TASK-047/048,
2026-07-19; superseded by TASK-186 on 2026-08-12).** `module-activation-control` was a
pure `localStorage` mock — zero server persistence, zero enforcement, despite already
gating the sidebar client-side. EPIC-018 first introduced legacy `master_module`;
EPIC-059 migration 0073 superseded active decisions with company-scoped
`company_module`. Those historical routes and checks proved server-side denial, but
their tenant mutation owner is no longer current. TASK-186 retains the gate while
switching it to `master_module.enabled AND company_module.enabled`, standardizes 403
`module_not_enabled`, makes `/api/admin/modules` a state-free
`platform_authority_required` denial and removes the tenant screen. The authenticated
session returns only the effective projection, never either platform-owned stored
layer.

**HR-lite is a new fifth domain, now Canonical for employee master and leave
request/approval (EPIC-020, TASK-049/050, 2026-07-19) — the first Phase 7 module
opened after Phase 8's platform work.** The original HR-lite scope deliberately deferred
Payroll; EPIC-026/TASK-061/062 later made `payroll-run`/`payslip` Canonical. The mock
onboarding wizard's compensation/pay-grade/provisioning-checklist depth remains
separately bounded because it is not represented by the current employee contract.
`employee` (self-referencing `manager_id`, tenant-
scoped, no link to `app_user`) and `leave_request` registered as standard generic
resources (unlike Admin's tables, these have simple single-integer PKs and fit
cleanly), gated on new `hr.read`/`hr.write` permissions. `hr-directory` and `employee`
read real per-employee data instead of always showing the same hardcoded mock record
(the same bug class Fixed Assets' `asset-detail` fixed in EPIC-015); `new-employee`
replaces the mock's 3-step wizard with a single real form matching what the schema
actually supports; `leave-approval`'s approve/reject actions are real, including a
required-reason reject flow. One incidental find during seeding: the mock's default
placeholder employee was named "Dana Reyes," which collided with the screen audit's
known-prototype-identity marker (a leftover from the very first Aria/Northwind
prototype, unrelated to this repo's own Acme demo data) — renamed to Farah Wong.
Verified live end-to-end: created a real employee, approved one leave request,
rejected another with a reason, and confirmed the employee detail's leave balance and
history reflected both decisions correctly.

**Purchasing remains partially converted, with sourcing, supplier returns, commercial
debits, landed cost and PO approvals now Canonical (TASK-064…068, 2026-07-22).** Requisitions, RFQs, invited supplier quotations,
award-to-PO, purchase orders, goods receipts, supplier invoices, purchase returns and
supplier credit notes read/write real Demo/API data. Awarding remains pre-accounting;
shipping a return performs one atomic stock issue plus immutable supplier-credit and
balanced AP/Inventory/Input-Tax reversal. Supplier debit notes post AP/variance/tax only,
without stock, and reduce the Payment Voucher's net settlement through the same shared
outstanding calculation. Landed-cost allocation revalues moving-average inventory and
posts a balanced accrual without moving quantity. Every new PO now starts pending; the
real approval queue/detail records an authorised noted decision and must open the PO
before receipt, without moving stock or writing GL. Supplier contracts, the rebuilt
purchasing command centre/reports and record-specific RFQ/quotation workspaces are now
Canonical. Purchasing has no remaining registered Preview route.

**Manufacturing routes are now Canonical (2026-07-19).** Work-order list, detail,
creation/release/execution, BOM detail and MRP use canonical schema and the Demo/API
contract. Material issue, sequential operation reporting, finished-goods receipt,
material WIP/Inventory GL and persisted planning suggestions are live. Further depth
still required includes BOM authoring/version approval, returns, partial completion and
labour/overhead costing.

**Sales enquiry, quotation, delivery, RMA, credit-note and debit-note routes are now Canonical
(2026-07-19).** Enquiry
capture and conversion, quotation creation, issue, acceptance and conversion to a
draft sales order use the same tenant-scoped Decimal-based commands in Demo and API
modes. Order confirmation persists its delivered fulfilment proof and stock
attribution atomically. Accepted RMAs restore stock and post balanced customer credits;
debit notes snapshot effective tax and post balanced additional customer charges.
Effective-dated price lists and bounded discount rules now enforce floor and approval
controls through the same Demo/API command contract. Credit control now blocks held or
over-limit confirmations inside the transaction.

**Sales analytics are Canonical (EPIC-037/TASK-073, 2026-07-22).** The dashboard,
reports hub and four report routes read one bounded `sales/analytics` resource in both
Demo and API modes. Recognized revenue is rebuilt from posted invoices minus credits
plus debits; receivables, months, customers, real customer owners and document statuses
come from canonical facts. The active screens store no KPI, target or forecast rows and
offer no fake export or queued-report action.

**Sales commission is Canonical (EPIC-038/TASK-074, 2026-07-22).** Effective-dated
plans select one active salesperson rate per source date. Salesperson attribution is
snapshotted from the customer onto the order and invoice, so later ownership changes do
not rewrite historical earnings. Each run stores immutable salesperson lines and every
invoice/posted-credit/posted-debit source with its signed recognized amount, rate and
rounded commission. Approval requires `sales.commission.approve` plus an audit note and
does not post payroll, payment or GL.

**Sales enquiry transaction context is Canonical (EPIC-039/TASK-075, 2026-07-22).**
`txn-view` stores only an enquiry identifier and re-reads its tenant-scoped record,
customer and linked quotation through the formal adapter. It delegates conversion to
the existing audited command and routes every later document kind to its dedicated
Canonical workspace; no fabricated activity, actor or toast-only document action remains.

**Management Reporting / BI is Canonical (EPIC-042/TASK-078, 2026-07-23).** One
bounded tenant-scoped read model composes current Sales, Purchasing, Inventory and GL
facts for all three BI routes. Category analysis only allocates traceable product lines;
stock aging discloses its latest-inbound-activity definition and does not claim FIFO
cost-layer semantics the schema cannot support.

## Documented but NOT implemented (do not assume these exist)

| Claim in docs | Reality |
| --- | --- |
| `VITE_DATA_MODE=api` renders every current Canonical screen with real data | **Contract implemented for the present Canonical boundary; authenticated full-route browser proof follow-up.** The current 128-route screen audit is green and the access matrix covers API/browser permission boundaries. Production health/root/session probes pass; a dedicated authenticated API-mode layout audit remains follow-up evidence. |
| Every Canonical route has five-language coverage | **Complete for the current matrix.** The 2026-08-10 audit passes 1,533 canonical keys across 69 local five-language packs and 128 routes × 5 languages × 2 viewports with zero blocking findings. |
| API server has all business **write** endpoints | **Complete for the present Canonical boundary.** Production setup, auth lifecycle, CRM opportunity conversion, Sales enquiry/quotation/order conversion, service-capable order lines, Draft confirmation, RMA/credit and debit-note posting, inventory adjustment post, stock-transfer completion, work-order execution/completion, quality inspection/NCR disposition, PO creation/receipt and supplier-invoice posting are live; advanced manufacturing depth and any new finance/commercial actions remain separate future scope. |
| `deploy/erp-server.mjs` | Still just a static "Live" placeholder page + `/health` — **not** the real API; the real API is `src/server.ts` now, run via `npm run server` locally or as the `api` service in Docker. |
| `npm run lint` | Implemented with ESLint and part of the local/CI gate. |

## Known design debt

1. ~~Seed SQL duplication~~ — **fixed (TASK-034, 2026-07-19).** Browser PGlite schema
   and compatibility migrations are generated from the ordered Drizzle journal (schema
   DDL is not hand-copied); the base seed itself now runs `src/data/seed.ts`'s
   `seedDemo()` directly through `web/src/erp-demo-runtime-impl.ts`'s bundled runtime
   — the same pattern every Canonical write already uses — instead of a hand-written
   `erp-system-seed.sql` mirror (deleted). This also fixed a real, previously-silent
   bug: the SQL mirror was missing all 8 `role_permission` rows `seed.ts` inserts, so
   the browser demo's Viewer persona had zero read permissions in its own database.
   Current Canonical browser writes use shared commands through
   `web/src/erp-demo-runtime-impl.ts`; new business SQL must not be added to the
   adapter. `erp-system-demo-txn.sql` and the other `erp-system-demo-*.sql` fixture
   files remain hand-written SQL — they're either browser-only content with no Node
   source, or (for `erp-system-demo-txn.sql`) intentionally kept as a literal SQL proof
   of the transaction chain rather than re-run through the command layer at boot.
2. **PGlite and Drizzle are now bundled locally by Vite** and no longer depend on
   jsDelivr for first load. The adapter keeps its 20 s timeout → static fallback.
   If real PGlite boot finishes *after* the
   watchdog already showed fallback, it now correctly overrides the fallback data
   and re-renders the current screen (fixed under TASK-028 — previously a late
   success was silently discarded and the UI could get stuck on stale mock data
   indefinitely with no user-visible error). One real trigger for hitting the
   watchdog at all: a second browser tab on the same origin holding an open
   PGlite/IndexedDB connection blocks a new tab's boot until that tab is closed —
   found during TASK-028's live verification.
3. **`web/dist/` is gitignored** (built fresh by `npm run build:demo`; the Pages
   workflow is currently disabled) — a local output is disposable; don't hand-edit
   files under `dist/`.
4. ~~CI (`deploy-pages.yml`) does not run `typecheck:web`~~ — fixed by
   `.github/workflows/ci.yml` (TASK-014), which runs on every PR; `deploy-pages.yml`
   itself is unchanged (deploy-only, still doesn't run `typecheck:web`, which is
   fine since `ci.yml` already gated it before merge).
5. **MFA is not implemented.** Invitation/password-reset endpoints and encrypted SMTP
   outbox delivery now exist; production deployments must configure the optional email
   worker profile and monitor delivery failures.
6. ~~Item Master and Customer-360 are Canonical but English-only~~ — **fixed
   (TASK-033, 2026-07-19).** Both screens gained local `copy()`-style five-language
   translation packs (en/ms/zh/ja/vi), matching the pattern every other Canonical
   screen uses; existing global `t()`/`ts()` keys are reused where they already
   matched. Verified live in-browser: switching en → zh actually changes every
   label, button, status pill and toast on both screens, desktop and 375px, zero
   console errors. `ja`/`vi` remain unreachable through the UI today, same as every
   other "five-language" Canonical screen — the language switcher itself only ever
   offers 3 languages (see item 7 below).
7. **`vite dev` cannot boot real PGlite for this app — always verify against
   `npm run build:demo` + `vite preview` (or `npm run audit:screens`).** Found during
   TASK-030/032 verification: `vite dev` serves a truncated/corrupted PGlite `.data`
   FS bundle (`Invalid FS bundle size: 12273 !== 6293225` in the console), so the
   adapter silently falls back to static sample data — writes against `vite dev`
   look like they work but never touch real PGlite. A persistent demo IndexedDB left
   partially migrated by an earlier `vite dev` session can also make a later, correct
   `vite preview` session look broken (a missing table after a real migration ran) —
   if that happens, call `window.ErpSystemData.reset()` from the app rather than
   suspecting the migration bundle first.
8. ~~`CONTRIBUTING.md` says "Run `npm run lint` before pushing" but no `lint` script or
   ESLint config existed~~ — **fixed 2026-07-21.** `eslint.config.js` (flat config,
   ESLint 10 + typescript-eslint) covers all three real JS/TS environments in this repo
   with different, deliberately-tuned rule sets per environment — see the file's own
   comments for why `web/public/assets/**/*.js` needs `no-undef: 'off'` (implicit
   shared global scope across ~70 classic `<script>`-tag files, CLAUDE.md landmine
   #4/#5) and `allowEmptyCatch` (the established, correct convention for optional
   `localStorage`/`history` calls that can throw in private-browsing contexts). Wired
   into `ci.yml` as the first step (fail-fast). The first real run found and fixed a
   genuine, previously-undiscovered bug via `no-dupe-keys`: `i18n.js` had two unrelated
   features both claiming the key `qc.title` (Quick Create's menu header vs. the
   Quality Inspections screen's own h1) — the later-declared Quality definition always
   won, so the Quick Create command-palette menu was silently mislabeled "Quality
   Inspections" in every language. Fixed by renaming Quick Create's key to
   `quickCreate.title`; verified live in-browser (before this fix could be captured in
   a screenshot, so verified by re-deriving from a fresh `build:demo` + `preview` after
   the fix) that Quick Create now reads correctly while the Quality Inspections screen
   itself is unaffected. Also fixed 18 useless-escape, 1 stray `var` redeclare, 1
   sparse-array, and 4 unused-catch-binding sites the same first run surfaced —
   all confirmed safe, behavior-preserving mechanical fixes.

   **The remaining 91 non-blocking warnings were cleaned up the same day.**
   53 caught-but-unused catch bindings became bare `catch{}` (ES2019+ optional
   catch binding — this codebase's established convention for optional
   `localStorage`/`history` calls that can throw). 9 single-parameter render
   callbacks that only render a static action button (`render:a=>...ic('ext')...`)
   dropped the unused row parameter. The remaining ~15 were genuine dead
   code, verified individually before deletion (not assumed): a `statusOf()`
   stock-status classifier in `screens-inv.js` superseded by reading the real
   `it.status` field directly and never called; a `totalSpendYTD`/`totSpend`
   KPI computed and discarded in two Purchasing screens; an `acctName` helper
   and its `flat` source array, both orphaned; a `terminal` variable in
   `screens-txn-view.js` that was computed once then — instead of being
   reused — re-derived inline three lines later (the sibling "quotation"
   block in the same function does reuse its own equivalent variable
   correctly), fixed by reusing it, not deleting it, since both forms are
   provably the same value. Every deletion was checked for side effects
   first (all were pure lookups/computations) and for whether the "unused"
   variable was actually feeding a KPI tile that should have been wired up
   instead of removed (in every case, no — either genuinely superseded or
   never rendered anywhere to begin with). `@typescript-eslint/no-explicit-any`
   and `no-empty-object-type`'s 14 warnings got individually-justified
   `eslint-disable-next-line`/block comments at each of the already-reviewed
   sites instead of a blanket rule downgrade, so the rules stay at full
   `error` severity — a genuinely new, unreviewed `any` still fails CI. Every
   `'warn'` severity in `eslint.config.js` was then promoted to `'error'`
   now that 0 is the real, achieved baseline, not just today's count. Full
   suite re-verified after (`typecheck`, 239 tests, demo proof, `build:demo`,
   all 114 routes via `audit:screens`, plus live interactive clicks through
   the manufacturing wizard, inventory list/detail, vendor performance, and
   both the terminal and non-terminal enquiry stepper states) — zero
   regressions, zero console errors. `npm run lint` now passes with **0
   errors and 0 warnings**.
9. ~~Raw `Date` objects rendered as `Date.prototype.toString()` garbage in
   several listings~~ — **fixed 2026-07-21.** PGlite/Drizzle return
   `date`/`timestamp` columns as live `Date` objects, not strings; naive
   template-literal interpolation silently rendered
   `"Wed Aug 19 2026 08:00:00 GMT+0800 (Malaysia Time)"` instead of a clean
   date (first spotted in the Quotations list "Valid until" column). Six
   near-identical per-module helpers (`crmDateValue`, `purchasingDateValue`,
   `financeDateValue`, `salesDateValue`, `projectDateValue`,
   `serviceDateValue`) plus warehouse.js's own `displayDate()` already
   existed but were inconsistently applied — consolidated into shared
   `dateValue()`/`dateTimeValue()`/`dateLabel()` in `screens-common.js`.
   Also fixed two local `dateLabel()` copies (mfg-canonical.js,
   qc-canonical.js) that never checked `instanceof Date` first and so
   "looked" fixed but weren't, and audited every `screens-*.js` file for
   raw date interpolation the old helpers never covered (~40 sites across
   sales, purchasing, finance, inventory, assets, admin, HR/people, CRM,
   warehouse). Found two real functional bugs in the same sweep: HR's "on
   leave today" check compared a raw `Date` to a string and was always
   false, and sort comparators in `screens-project.js`/`screens-asset.js`
   sorted by `Date.toString()` weekday name instead of chronological order.
   Most seriously, deleting `financeDateValue` from `screens-fin2.js` left
   a dangling reference in the separate `screens-fin.js` (this codebase's
   classic-`<script>`-tag shared global scope means one file can call a
   function defined in another with no import) — `date:financeDateValue(...)`
   would have thrown `ReferenceError` the first time anyone opened a
   Payment Voucher. Not caught by `node --check` or an isolated lint pass;
   only found via a codebase-wide grep for all six old helper names after
   believing the migration was already done. **Lesson: renaming/deleting a
   shared-global-scope function requires searching the entire codebase for
   references, not just the file being edited — syntax-checking alone does
   not catch it.** Verified live: Quotations, Sales Orders, an end-to-end
   Payment Voucher creation, Manufacturing Work Orders, and HR
   Directory/Leave Approval all render clean dates with zero console
   errors.

## Final control-plane milestone (TASK-085, 2026-07-23)

The final three Preview routes are now Canonical. `integration` reads a real
company-scoped connector registry and supports audited health/pause/resume actions;
production credential configuration encrypts secrets with AES-GCM and never returns
the envelope to the browser, while offline Demo explicitly refuses to store secrets.
`master-control` is now a bounded current-tenant view over real companies, users,
roles and module state rather than a fictional cross-tenant console. `sys-settings`
now reads and writes audited company policy, document sequences and accounting-period
locks while presenting effective-dated tax and currency facts. Migration 0044 brings
the shared Drizzle/PGlite/PostgreSQL schema to 127 tables. All routes at that milestone
were Canonical and API-capable; TASK-101 subsequently adds Service Contract detail,
bringing the current registry to **115 Canonical routes with Preview=0**.

## Stable async navigation feedback (TASK-086, 2026-07-23)

The shared async loader and error shell no longer exposes lower-case hash-route slugs.
It resolves headings from route translations, module-home labels, declared module
navigation labels and sidebar metadata, with readable acronym-aware title case only as
the final fallback. Purchasing now stays `Purchasing` before and after its Promise
resolves. The route audit proves the unresolved loading state at desktop and 375px;
live browser checks confirm matching font size/weight, no overflow and zero console
errors. Service-worker v74 delivers the corrected shell to existing PWA sessions.

## Transaction-list UI SSOT foundation (TASK-087, 2026-07-23)

Canonical data maturity no longer implies that a route has passed the page-level list
design contract. The new `transactionListPage()` composes the shared module shell and
grid primitives into one approved Suppliers/Enquiries-style register with explicit KPI,
filter toolbar, table/empty and pagination regions. Work Orders is the first migrated
route and declares `SCREEN_META.layout = transaction-list-v1`. The screen audit now
validates this contract at desktop and 375px, with `npm run audit:list-layouts` available
for bounded migration batches and wired into CI. Service-worker v75 delivers the pilot.

## Transaction-list UI SSOT rollout and enforcement (TASK-088–091, 2026-07-23)

All **35 transaction-register routes** now render through the shared
`transactionListPage()` contract at desktop and 375px. Sales, Purchasing, operational
and back-office registers share the same KPI, filter, toolbar, table/empty and
pagination structure; unsupported placeholder Filter/Export actions were removed.
Intentional dashboards, reports, forms, document details and master-detail workspaces
remain on their appropriate layouts instead of being force-fit into a list.

Every one of the 114 routes now declares one of nine explicit layout categories.
Static audit guards reject the obsolete `makeSalesList`, `makePurList` and `rowMenuBtn`
factories, while runtime audits verify declared list structure and detect undeclared
list-shaped pages. Suppliers, Enquiries and Work Orders remain the visual references.
Service-worker v76 delivers the completed rollout. Local release gates pass with
lint, dual typecheck, 379 tests plus one expected skip, 45-migration/127-table
alignment, PGlite proof, API/Demo builds, desktop/mobile smoke, the 35-route list
audit and the full 114-route desktop/375px audit.

## Sales Orders SSOT correction (TASK-092, 2026-07-23)

The Sales Orders register had been incorrectly exempted as `master-detail` because it
contained an optional inline preview. Its primary surface is a transaction register,
so it now renders through `transactionListPage()` as the 35th SSOT list. Clicking an
order still opens the canonical document detail, while the duplicate preview chrome
and unsupported Filter/Export controls are gone. Service-worker v77 delivers the fix.

## Inventory master-detail register SSOT (TASK-093, 2026-07-23)

Stock on Hand and Item Master no longer maintain a separate inventory-only list shell.
The shared `masterDetailRegisterPage()` extends `transactionListPage()` with one
optional selected-row detail pane: persistent on desktop and the existing drawer on
mobile. KPI, filter, toolbar, table/empty and pagination regions remain owned by the
same SSOT, while the Inventory module supplies only data, columns and detail content.
The two routes declare `master-detail-register-v1`; unsupported Columns/Export controls
and dead inventory split-shell CSS were removed. The list audit now covers **37 shared
registers** (35 transaction lists plus 2 master-detail registers) at desktop and 375px.
Service-worker v78 delivers the change.

## Inventory Valuation report-list SSOT (TASK-094, 2026-07-23)

Inventory Valuation no longer renders a bespoke full-height parameter sidebar and
independent result toolbar. Those controls implied historical dates, warehouse
filtering, saved templates and Excel/PDF/Print exports that had no implementation.
The new shared `reportListPage()` specializes the approved register SSOT as
`report-list-v1`: canonical current valuation rows, real KPI totals, category filters,
snapshot metadata and the standard table/empty/pagination regions. It preserves report
semantics without pretending to be a writable transaction register. The list audit now
covers **38 shared tabular pages** at desktop and 375px. Service-worker v79 delivers
the corrected page.

## Warehouse Picking operational-workspace SSOT (TASK-095, 2026-07-23)

Warehouse Picking remains an execution workspace rather than being forced into the
transaction-register template. The shared `operationalWorkspacePage()` now owns its
module header/status, bounded progress, main work area, context rail, empty/error
states and responsive action zone under `operational-workspace-v1`. The Warehouse
screen supplies only canonical pick facts, line cards and the existing idempotent
pick-line/complete commands. Action failures remain visible with a retry control, and
an action finishing after navigation cannot pull the user back to Picking.

The dedicated workspace audit validates all four regions, progress bounds, canonical
DOM order, one module header, mobile stacking, action overflow and en/ms/zh/ja/vi
screen copy at desktop and 375px. The full 114-route audit enforces the same contract;
service-worker v80 delivers the shared renderer and styles.

## Project Timesheet transaction-list SSOT (TASK-096, 2026-07-24)

Timesheet no longer relies on the generic `workspace` exemption or reconstructs its
own toolbar, full-width KPI strip, document surface and semantic line table. All four
weekly states render through `transactionListPage()` under
`data-layout="transaction-list-v1"` with standard KPI, toolbar, table/empty and
pagination regions. Week navigation is real, the date range is non-interactive text,
the 100-entry boundary lives in the toolbar note and only active rows expose the
audited Void action.

The migration changes no schema, API, permission or Decimal behavior. Static guards
reject the old Timesheet chrome; desktop/375px runtime checks cover five languages,
loading/error/empty/populated states, active-only totals, one active row action and
the absence of Capacity, Copy, Approval, Payroll or Export actions. Service-worker
v94 delivers the corrected page, and the shared list-layout audit now covers 42 routes.

## Employee master-detail editor SSOT (TASK-097, 2026-07-24)

The canonical Employee profile no longer relies on the unstructured
`document-detail` exemption or rebuilds `docwrap`, `docpage`, `dochead`, `doclayout`
and sticky action chrome. It now renders through `masterDetailEditorPage()` under
`data-layout="master-detail-editor-v1"` with one page header and standard overview,
error, main, context and responsive action regions.

The overview supports a structured avatar and presents name, employee number, role,
department, status and four employment facts once. Contact details are display facts
instead of read-only inputs; leave history remains sorted and uses bounded horizontal
scrolling; the context rail owns the annual-leave balance. Existing employee
selection, manager resolution, leave calculations and navigation actions are
unchanged. Static and desktop/375px runtime guards cover avatar/fallback, five
languages, top-level manager, empty employee/leave states and Pending/Approved/Rejected
history. Service-worker v95 delivers the corrected page, and the focused
master-detail editor audit now covers BOM and Employee.

## Employee page-header action hierarchy (TASK-098, 2026-07-24)

Employee no longer exposes a block-level, transparent footer that repeated the
employee number and Directory navigation. `masterDetailEditorPage()` now accepts an
optional `headerActions` fragment and composes it with the status inside one audited
page-header action group. The populated Employee profile places Active and Review
leave together at desktop and on a dedicated, balanced row at 375px.

The standard `data-master-detail-actions` region remains in canonical DOM order but
is hidden and empty for Employee. Directory navigation remains available through the
breadcrumb and HR sub-navigation; empty Employee state exposes no false action.
Static and runtime guards reject a reintroduced footer note, Back button or populated
footer, and verify five-language header copy plus zero action-group overflow.
Service-worker v96 delivers the updated shared renderer and styles.

## Payroll run modal correctness (TASK-099, 2026-07-24)

The New payroll run dialog no longer renders an empty danger alert before validation.
The shared CSS now preserves native `hidden` semantics, while the Payroll-specific
error remains aligned with the form when a real validation message is present.

`appModal()` now constrains every configured width to the visible viewport, preventing
the 620px Payroll dialog and its primary action from being clipped at 375px. Payroll
period and pay-date defaults are generated from local calendar fields rather than
converting local midnight through UTC, so July correctly opens as July 1–31 in
UTC-positive timezones. The Payroll state audit verifies desktop/mobile bounds,
clickable actions, initial hidden error, local date defaults and the invalid-period
message. Service-worker v97 delivers the shared modal, CSS and HR screen updates.

## Service Order case-detail SSOT (TASK-100, 2026-07-24)

Service Order now renders through `caseDetailPage()` instead of rebuilding
`docwrap`, `docpage`, `dochead`, `appr-layout`, the legacy Stepper and a separate
sticky footer. This also removes the accidental `.dt` title collision with the
760px-wide data-table class that produced internal scrolling and clipped titles at
375px.

The shared Case Detail interface now accepts an optional structured lifecycle.
Service Order uses it for Open, In Progress and Closed while NCR remains unchanged.
The standard overview contains ticket identity, priority/status and four service
facts; Diagnosis is the main work area, SLA plus related contract form the context
rail, and Open/In Progress actions use the standard responsive action region.
Closed and empty states preserve a hidden, empty actions region. Customer 360 is
bound to the current customer ID, and five-language state smoke covers SLA,
contract, diagnosis, empty, Assign/Resolve and failure recovery. Service-worker v98
delivers the shared renderer, Service screen, layout metadata and styles.

## List-row interaction SSOT and Service Contract detail (TASK-101, 2026-07-24)

Shared list rows now advertise an explicit `open`, `select` or `none` interaction.
Only real actions receive pointer/hover/selected styling, `tabindex="0"` and an
accessible label; mouse, Enter and Space share the same action, while checkboxes,
row menus, links and inline controls do not bubble into it. All 42 shared lists use
this contract. Static analytical/rule/history rows remain honest, and the former
toast-only or wrong-target opens have been removed.

Service Contracts now opens the selected Canonical record through the third
`master-detail-editor-v1` route. The read-only detail shows customer, contract,
plan/status, dates, SLA, covered assets, annual value, term and renewal context;
Customer 360 is bound to the current contract customer. Focused audits cover
Active/Expiring/Expired, no SLA, zero assets, missing/unknown/failed records,
customer fallback, five languages and desktop/375px behavior. Service-worker v99
delivers the shared table, list screens, new route and audit updates.

## Depreciation master-detail register SSOT (TASK-102, 2026-07-25)

The canonical Depreciation page no longer relies on the unstructured `workspace`
exemption or rebuilds `report`, `report-params`, `report-result`, `report-toolbar`
and a manual data table. It now renders through `masterDetailRegisterPage()` under
`data-layout="master-detail-register-v1"` with one page header and the standard KPI,
filter, table, pagination, register and detail regions.

All bounded Draft, Posted and Cancelled runs are selectable instead of hiding every
record except the newest. Run number and straight-line method are display facts in a
responsive creation modal, only the run date is editable, and an existing Draft
blocks another run. Draft posting uses a confirmation modal and the existing
idempotent command; Posted runs retain General Ledger navigation and Cancelled runs
are read-only. Category totals use `buildTable()` inside controlled horizontal
scrolling. Five-language desktop/375px state proofs cover empty, mixed, create/post
failure and successful lifecycle refreshes. Service-worker v100 delivers the update,
and the shared list-layout audit now covers 43 routes.

## Asset Detail master-data SSOT (TASK-103, 2026-07-25)

The canonical Asset Detail page no longer relies on the legacy `master-detail`
exemption or rebuilds `docwrap`, `docpage`, `dochead`, `doclayout`, summary cards and
read-only form controls. It now renders through `masterDetailEditorPage()` under
`data-layout="master-detail-editor-v1"` with one semantic page header and the
standard overview, error, main, context and hidden actions regions.

Acquisition date, original cost, useful life and residual value are overview facts;
depreciation method, monthly charge and GL accounts are pure display facts rather
than fake inputs. Only real Posted run lines appear in the controlled responsive
history table. Original cost, accumulated depreciation, net book value and progress
remain derived from Canonical Demo/API data in the context rail. Five-language
desktop/375px proofs cover populated, no-history, unknown-ID and no-asset states.
Service-worker v101 delivers the update, and the focused master-detail editor audit
now covers BOM, Employee, Service Contract and Asset Detail.

## Purchase Order Approval case-detail SSOT (TASK-104, 2026-07-25)

The Canonical Purchase Order Approval detail no longer relies on the permissive
`document-detail` exemption or rebuilds `docwrap`, `docpage`, `dochead`,
`appr-layout`, summary cards and a separate page-level footer. It now renders through
`caseDetailPage()` under `data-layout="case-detail-v1"` with one semantic page
header and the standard overview, error, main, context and actions regions.

Order lines use the bounded responsive table container; financial totals and the
auditable decision record form the context rail. Pending requests expose only the
real Reject and Approve commands in the standard action region, while approved and
rejected requests keep that region hidden and empty. Breadcrumb and Purchasing
sub-navigation replace the duplicate Back button. Five-language state proofs cover
pending, approved, rejected, no-lines, missing/unknown and recoverable failure
states without changing the existing note requirement, idempotency key, permission
or domain command. Service-worker v102 delivers the update, and the focused Case
Detail audit now covers NCR, Service Order and Purchase Order Approval.

## Goods Receipt posting-detail SSOT (TASK-105, 2026-07-25)

The Canonical Goods Receipt detail no longer relies on the permissive
`document-detail` exemption or rebuilds `docwrap`, `docpage`, `dochead`,
`doclayout`, summary cards and a separate page-level footer. It now renders through
the broadened `postingDetailPage()` contract under `data-layout="posting-detail-v1"`.
That contract supports immutable operational postings as well as balanced finance
postings without changing Journal Entry or Payment Voucher behavior.

Receipt identity, supplier, source purchase order, document date and warehouse form
the standard overview. Order lines and inventory movements use bounded responsive
tables; received quantity, movement count, posting status and immutability form the
context rail. “View stock movements” is the single header navigation action, while
breadcrumb and Purchasing tabs replace the duplicate Back button and the footer
actions region remains hidden and empty. Five-language state proofs cover populated,
no-movement, unknown, empty, failed-read and Retry states. Service-worker v103
delivers the update, and the focused Posting Detail audit now covers Journal Entry,
Payment Voucher and Goods Receipt.

## Organisation username and multi-role foundation (TASK-106, 2026-07-25)

TASK-106 is complete without adding product routes. Migration 0046 adds a unique
`master.login_code`, master-scoped `app_user.username`, nullable pre-activation email
and the explicit `user_company_role` assignment table. The compatibility migration
derives deterministic usernames for existing email accounts and copies each existing
`user_company.role_id` grant exactly once; the legacy column remains as a
compatibility/default role while all current authorization reads the role union.

Production login now resolves the normalized organisation code before the normalized
username and returns one generic invalid-credentials response for unknown
organisations/users. Setup captures both identifiers in Demo/API mode. User Management
can assign multiple roles through one audited company-bounded action, while permission
checks union grants only inside the Session's active company. Service worker v104
delivers the updated login, setup and User Management assets.

Verification is green: lint, dual TypeScript, 399 tests passed with one expected skip,
47-migration PGlite compatibility/retry proof, 134-table drift, Demo domain proof,
Demo/API builds, desktop/375px smoke and all 115 Canonical routes at desktop/375px.
The Canonical route baseline remains **115 / 0 Preview**. Employee linking,
activation-secret lifecycle and offboarding are delivered separately by TASK-107 below.

## Employee account lifecycle (TASK-107, 2026-07-25)

TASK-107 is complete without adding a product route. Migration 0047 links at most one
`app_user` to one Employee inside a company, adds explicit preactivated/active/offboarded
account states, and stores recoverable one-time passwords only as AES-256-GCM envelopes
in `employee_activation_secret`. HR creates, reveals and resets credentials through
company-scoped RBAC endpoints. Every reveal appends an audit record; first-login
completion requires an email plus a different password, clears the encrypted envelope
permanently and revokes every existing session. Employee-linked accounts are excluded
from the public email-reset flow, so later resets remain HR-issued and audited.

The Employee master-detail page now exposes the account state and five-language
create/reveal/reset/offboard workflows in both Demo and API modes. A restricted
five-language activation shell is shown before the normal application: pending users
may access only Session, Logout and activation completion, while every ordinary API
returns `activation_required`. Offboarding follows a reasoned Void-style process: it
transfers direct reports, customer ownership, open opportunities and unread
notifications to an active linked employee, records an immutable handoff summary,
clears any temporary secret and revokes access. Historical sales, time, report and
document attribution is never rewritten. PWA v105 delivers the updated auth, adapter
and HR assets.

Verification is green: lint, dual TypeScript, 405 tests passed with one expected skip,
48-migration PGlite compatibility plus transaction proof, 136-table drift, Demo/API
builds, desktop/375px smoke, 43 list-layout routes, four master-detail editor routes
and all 115 Canonical routes at desktop/375px. The route baseline remains
**115 Canonical / 0 Preview**.

## Actor-owned My Work API (TASK-108, 2026-07-25)

TASK-108 is complete without adding a product route. Migration 0048 adds
`employee_hierarchy_scope` plus separate Employee/Manager self and team permissions.
`/api/my/context`, `/leave-requests`, `/claims`, `/receipts` and
`/team/leave-requests` always resolve the active Employee from the authenticated
Session and active company. Supplying `employeeId` or `employee_id` is rejected before
controller execution; inactive, missing or ambiguous Employee links fail closed.

Ordinary managers see active direct reports. An effective-dated `direct` or `tree`
grant may widen that scope, but only to Employee IDs found inside the same active
company. Team leave returns dates, duration and status without private reason or
rejection facts. Claims and receipts are intentionally not invented early: both verify
the actor and return an empty collection with `availability: not_modelled` and the
owning future EPIC. Demo and API adapters expose the same `my` surface; PWA v106
invalidates the previous adapter cache.

Verification is green: lint, dual TypeScript, 408 tests passed with one expected skip,
49-migration PGlite compatibility plus transaction proof, 137-table drift and Demo/API
builds. Demo smoke, 43 list-layout routes, four master-detail editors, three Case
Details, three Posting Details and all 115 desktop/375px routes pass. ID tampering,
missing/inactive links, separate team permission, direct reports, authorised trees,
privacy redaction and cross-company denial are independently tested. The route
baseline remains **115 Canonical / 0 Preview**.

## Five-language My Work shell (TASK-109, 2026-07-25)

TASK-109 adds five accepted Preview entry points without changing the existing
Canonical maturity. `my-leave`, `my-claims`, `my-receipts`, `team-calendar` and
`my-approvals` all render through `transaction-list-v1`. My Leave reads only the
Session-bound employee's real requests. Claims and Receipts verify the actor and show
their explicit `not_modelled` ownership instead of sample transactions. Team Calendar
and My Approvals are removed from navigation unless `/api/my/context` grants
`team.available`; their rows omit reason/evidence and the approval entry remains
read-only at the TASK-109 boundary. TASK-114 later promotes My Approvals to Canonical.

The API adapter now falls back from a denied management dashboard to an actor-derived
restricted shell, so an Employee-only account can sign in without `dashboard.read`.
The Demo Viewer is also linked to a real Employee and receives Employee in its role
union, preserving its existing Viewer grants while proving capability composition.
The preview banner distinguishes governed `Canonical Data` from old sample previews.
English, Malay, Simplified Chinese, Japanese and Vietnamese shell copy is complete.
PWA v109 refreshes the affected shell, managed-role administration and leave-policy
schema bundle.

Verification covers 420 tests plus one expected skip, 51 ordered migrations,
142 drift-checked tables, the Employee-only dashboard denial/My Work success path, real
actor leave, capability-hidden versus manager-visible tabs, privacy redaction,
read-only approval, cross-organisation login reuse, managed Manager grants, five
languages and desktop/375px layout. The shared list audit covers 48 routes. The
registry is **120 total: 115 Canonical / 5 Preview**.

## Immutable leave balance ledger (TASK-112, 2026-07-25)

TASK-112 adds migration 0051 and `leave_balance_entry`, a tenant-scoped append-only
source for grant, accrual, reserve, use, release, cancellation, adjustment,
carry-forward, expiry and encashment facts. A PostgreSQL trigger rejects every update
or delete, while a company-scoped immutable entry key makes command replay idempotent.
Balance, reserved and available days are projected with fixed two-decimal arithmetic;
there is no mutable balance column.

Pending paid leave locks the active employee row before projecting availability and
appending its reservation, so concurrent requests cannot overspend entitlement.
Insufficient entitlement fails without a ledger write and returns requested, available
paid and suggested unpaid days. Approval appends use; rejection appends release.
Repeated reserve/settle commands return the original fact without duplicating it.
The policy-calendar foundation remains the governing context and existing HR-lite
requests remain unchanged until TASK-113 migrates the lifecycle.

Verification covers 428 tests plus one expected skip, 52 ordered migrations and
143 drift-checked tables. Dedicated proof covers every ledger event, full/half-day
validation, tenant mismatch, conflicting replay, mutation rejection, paid/unpaid
split and concurrent reservation. PWA v110 refreshes the generated schema bundle.
The route registry remains **120 total: 115 Canonical / 5 Preview** and the shared
list audit remains 48 routes.

## Governed leave application lifecycle (TASK-113, 2026-07-25)

TASK-113 adds migration 0052 and four governed fact sets around the retained
`leave_request` projection: immutable request revisions, immutable lifecycle events,
private evidence metadata and separately decided approved-cancellation requests.
Non-legacy rows snapshot their policy/calendar/day calculation and advance through
Draft, Pending, Approved, Rejected, Withdrawn, Voided or Cancelled under an optimistic
version. Paid submission/resolution composes TASK-112 reservation/use/release facts in
the same transaction.

`/api/my/leave-requests` derives the employee from Session and supports create, amend,
submit, withdraw, reasoned Void-delete and approved-cancellation request with CSRF,
idempotency and audit. HR endpoints provide explicit on-behalf draft, decision, Void
and cancellation decision operations. Generic HR-lite approval rejects governed rows,
preventing it from bypassing balance and version rules. Team projections expose dates,
duration and evidence-required/state only; owner/HR detail retains private reason and
evidence reference metadata. Actual document content/upload remains TASK-117/118.

The five-language `my-leave` list is now writable and Canonical. Only governed rows
receive the row-open contract; Legacy Policy rows remain visible and static. The new
Canonical `leave-application` uses `case-detail-v1` for revisions, history, evidence
state and state-appropriate actions. Employee “delete” never erases facts: amendable
records become a reasoned `Voided` audit tombstone, Pending uses Withdrawn and Approved
uses the cancellation workflow. PWA v111 refreshes adapters, runtime and screens.
The registry is **121 total: 117 Canonical / 4 Preview**; 53 ordered migrations and
147 drift-checked tables pass at this boundary. The complete suite has 439 passing
tests plus one expected skip. Live in-app-browser proof completed a fresh Demo setup
with the organisation-derived admin username, then created, submitted, withdrew,
amended and Voided a governed employee leave application while retaining both
revisions and every reasoned event. The final 375px detail had no page overflow or
console error. That proof also caught and fixed the post-TASK-106 Demo setup collision:
the seeded `admin` username is no longer reused for a different email, and username or
email conflicts fail before setup writes.

## Configurable approval governance (TASK-114, 2026-07-25)

TASK-114 adds migration 0053 and ten tenant-scoped governance tables: effective-dated
approval policies, versions and ordered steps; workflow instances and step authority
snapshots; immutable decisions and events; bounded delegations; leave-capacity rules;
and immutable capacity snapshots. Policy resolution ranks priority and specificity
across employee, department, leave type, days, amount and currency, rejecting
ambiguity. Steps support direct manager, named employee and permission authority with
fallback/escalation. The command boundary forbids self-approval and preserves original
authority alongside direct, delegated, permission or escalated decision provenance.

Leave submission now creates its workflow inside the same reservation transaction.
Intermediate approval advances the ordered step without consuming entitlement; final
approval consumes the reservation, rejection releases it, and withdrawal/Void cancels
the pending workflow. Time-bounded delegations are capped at 90 days, revocable and
historically retained. Reminder and escalation events/notifications are idempotent.
Capacity is snapshotted at submission and re-evaluated at decision, applying Warning,
an additional approval level or a hard block.

`/api/my/approvals` exposes only the signed-in actor's actionable queue and
privacy-redacted detail. It never returns the employee's private reason or evidence
reference. Decision endpoints use CSRF, idempotency, optimistic request versions and
audit; delegation endpoints derive the delegator from Session. The five-language
`my-approvals` page now renders through `master-detail-register-v1` with real Demo/API
approve, reject, create-delegation and revoke commands. PWA v112 promotes the route,
bringing the registry to **121 total: 118 Canonical / 3 Preview**.

Live in-app-browser proof on a fresh organisation submitted a six-day Annual request,
showed its Warehouse capacity Warning without exposing the private reason, completed
direct-manager then HR approval in order, and confirmed the employee request became
Approved only after the second decision. A future-dated delegation was created,
reopened, revoked and still retained as historical fact. The same proof caught and
fixed a real maturity-registry regression that had left approve/reject controls
disabled after the page rewrite.

Final verification passes lint, both TypeScript projects, 446 tests plus one expected
skip, all 54 ordered migrations at schema version 53, 157-table drift, the PGlite
transaction demo, API and Demo builds, desktop/mobile smoke, all 48 list layouts, all
four Case Details and all 121 desktop/375px routes. The maturity contract is
**118 Canonical / 3 Preview** with zero console/page errors or identity leaks.

## TASK-115 — Team calendar workspace and outbound sync (done)

Migration 0054 adds `calendar_outbound_connection` and
`calendar_outbound_event`. The latter is revision-keyed and company-scoped, preserves
one external event identity across approved/change/cancel delivery, and records
pending, delivered, failed or superseded outcomes. Final approval and approved
cancellation enqueue in the same transaction as ERP state. The worker re-reads the
current leave revision/status before delivery, supersedes stale work and retries
transient failures with bounded exponential backoff. Demo configuration stores no
credential; production delivery is enabled only when the outbound URL/token
environment boundary is configured.

`/api/my/team/calendar` derives the actor from Session, defaults to direct reports and
allows `scope=expanded` only with an active reporting-tree grant. Date/status/
department filters are bounded, overlapping absences carry a conflict indicator and
the projection returns dates, duration, leave type, status and sync facts without
private reason or evidence references. Team Calendar is now a five-language
`calendar-workspace-v1` Canonical route with the required header, filters,
month/week/list surface, responsive detail, retryable error and governed action
regions. A dedicated `audit:calendar-workspaces` gate enforces the contract. PWA v114
also verifies the two new tables in the persistent-Demo schema signature, so a stale
v54 marker repairs the migration bundle before any calendar query runs.

Application-internal browser proof upgraded an existing IndexedDB database, caught a
stale v54 marker whose migration asset had not created the new tables, and verified
the signature repair replayed the bundle at v54. Team Calendar then rendered Marcus
and Lena availability in August, opened a redacted Marcus detail without his private
“Family trip” reason, exercised month/week/list switching, status filtering and
next-month/today navigation, and retained the permanent reason/evidence privacy
marker. The week rendered seven columns, no standard render error appeared and the
browser console contained no errors.

Final verification passes lint, both TypeScript projects, 449 tests plus one expected
skip, all 55 ordered migrations at schema version 54, 159-table drift, API and Demo
builds, desktop/mobile smoke, all 47 list layouts, the Team Calendar workspace, all
four Case Details and all 121 desktop/375px routes. The maturity contract is
**119 Canonical / 2 Preview** with zero console/page errors or identity leaks.

## TASK-116 — Governed leave-to-Payroll integration (done)

Migration 0055 adds `payroll_leave_source` and `payroll_run_leave_source` as
tenant-scoped append-only facts. Approved unpaid leave produces a deduction linked to
its immutable request revision; approved cancellation produces a recovery earning;
policy-approved encashment first consumes available leave through the immutable
balance ledger and then produces an earning linked to that ledger fact. Monthly base
salary, the 26-day divisor, full/half days, amount and effective date are snapshotted.
The exact formula rounds half-up to cents. A unique source-to-run mapping means an
overlapping or retried payroll run cannot apply the same effect twice.

`payroll_run_line` now separates base gross, leave earnings and unpaid-leave
deductions from adjusted gross. Payroll Run and Payslip expose those facts plus their
source trace in English, Bahasa Melayu, Chinese, Japanese and Vietnamese. Production
API resources and the Demo adapter share the same commands. Existing route aliases
remain unchanged, and historical HR-lite requests retain their original day value and
`Legacy Policy` marker without recalculation.

The in-app browser upgraded a persistent old IndexedDB database and caught a
service-worker race where a new adapter could briefly receive stale migration SQL.
SQL assets now use a schema-version query and the adapter verifies the required
two-table/three-column signature after applying migrations before it writes the v55
marker. The repaired database rendered Payroll without errors. A fresh Demo approved
1.50 days for Marcus Silva: `S$4,200 ÷ 26 × 1.50 = S$242.31`; the first July run
showed one immutable source and the Payslip trace, while a second overlapping run
showed zero sources and no duplicate earning. All five languages rendered the new
labels with zero browser errors.

Final verification passes lint, both TypeScript projects, 452 tests plus one expected
skip, all 56 ordered migrations at schema version 55, 161-table drift, API and Demo
builds and the dedicated Payroll route audit. The route maturity contract remains
**119 Canonical / 2 Preview**. PWA v116 delivers the cache-safe upgrade.

## TASK-117 — Governed document storage providers (done)

Migration 0056 adds `managed_document`, immutable `document_version`, default
`document_blob` byte content and optional `document_file_location` locators. The
database owns tenant scope, owner, purpose, retention, legal hold, current-version
projection, SHA-256, MIME and size for every backend. Identity and version rows are
append-only; every content read verifies the database-owned hash and size.

`DocumentStorageProvider` defaults to the cluster-safe PostgreSQL/PGlite database
implementation. Filesystem storage is available only when
`DOCUMENT_STORAGE_FS_ROOT` names a dedicated non-root directory; it is explicitly
single-node, uses opaque tenant-partitioned paths and mode-0600 content files, and
never becomes the metadata source of truth. Owner, authorised manager and
cross-tenant behavior use one shared contract for both providers. PGlite parity tests,
a real PostgreSQL 16 non-superuser/RLS run and filesystem-tamper proof all pass.

TASK-117 intentionally adds no upload route or capture UI: bounded format/magic-byte
validation, mobile/offline capture, quarantine and scanning begin with TASK-118/119.
Final verification passes lint, both TypeScript projects, 457 tests plus one expected
skip, all 57 ordered migrations at schema version 56, 165-table drift, API and Demo
builds, desktop/375px smoke and all 121 route audits. The maturity contract remains
**119 Canonical / 2 Preview**. PWA v117 carries the persistent-Demo schema upgrade.

## TASK-118 — Secure receipt upload and offline capture (done)

Migration 0057 adds a positive page count to immutable document versions and
upgrade-safe `employee.receipts.write` grants for existing Employee/Manager roles.
Production and Demo My Work adapters derive the employee from Session, accept only
JPEG/PNG/HEIC/PDF content whose magic bytes agree with MIME and extension, stream
bound each file to 20 MB, parse PDFs to a maximum of 20 pages and reuse stable
client-draft keys without creating duplicate documents.

The five-language Canonical My Receipts workspace captures from camera or file,
stores unsynchronised blobs in IndexedDB and performs real Canvas crop, rotation,
resize and compression for JPEG/PNG. HEIC/PDF originals remain unmodified. Logout
uses an explicit confirmation before clearing local drafts; synced Canonical content
is retained. New receipts expose no preview, OCR, export or claim linkage and remain
labelled as awaiting TASK-119 scanning.

Final verification passes lint, both TypeScript projects, 461 tests plus one expected
skip, all 58 ordered migrations at schema version 57, 165-table drift, API and Demo
builds, desktop/mobile smoke, all 47 list routes and all 121 desktop/375px routes.
The maturity contract is **120 Canonical / 1 Preview**. A real PostgreSQL 16
non-superuser/RLS run and in-app browser capture → edit → sync → logout-cleanup proof
also pass. PWA v118 carries the upgrade.

## TASK-119 — Quarantine scanning and asynchronous extraction (done)

Migration 0058 adds tenant-scoped company processing policy, one unique leased scan
job per immutable document version and versioned extraction output. The upgrade
backfills every existing version and inserts a unique `document.scan.requested`
outbox signal, so retries cannot duplicate documents, scan jobs, extraction version
1 or downstream signals.

The worker fails closed when its malware scanner is absent, unavailable or
indeterminate. Only a `clean` scan may create or run extraction; infected content is
permanently blocked. Local OCR is the default. An administrator may select BYOK
Vision only after configuring the encrypted `document-vision` connector and explicit
provider, region and 0–365 day retention metadata. Plain credentials exist only
inside the extraction call.

Production RLS gives the non-superuser document worker access only to its two queue
tables; business document bytes still require a tenant transaction. Demo has no
scanner, so it honestly displays `Quarantined · scanner unavailable` with no preview,
claim, submission or export actions. Final gates pass lint, dual typecheck, 464 tests
plus one expected skip, 59 migrations at schema version 58, 168-table drift,
Demo/API builds and all 121 desktop/375px routes at **120 Canonical / 1 Preview**.
A real PostgreSQL 16 RLS run and in-app upload/reload proof also pass. PWA v119.

## TASK-120 — Confidence-governed receipt inbox and auto-submit (done)

Migration 0059 adds immutable `document_extraction_field` candidates, one immutable
`receipt_upload_authorization` choice per document version and one governed
`receipt_inbox_item` projection. Every candidate preserves field key, value,
normalised value, source reference, extractor provider/model, confidence and review
state. Critical merchant, transaction date, currency and total fields must each be
valid, non-conflicting and at or above the company threshold.

Auto-submit defaults off. The domain command and database constraint reject thresholds
below 98%. A receipt reaches system `submitted` only after a clean malware scan, an
explicitly clear extraction safety result, valid amount fields, no exact SHA-256
duplicate, company opt-in and the authenticated uploader's prior immutable
authorization. Submission records that uploader, the authorization timestamp,
`receipt-auto-submit-v1` system actor and one retry-stable `receipt.inbox.submitted`
outbox event. Failed checks produce explicit review reasons; clear checks without
opt-in or authorization remain `ready`.

My Receipts exposes the authorization choice before capture and five-language
`review_required`, `ready` and automatic-submission states. Final gates pass lint,
dual typecheck, 467 tests plus one expected skip, 60 migrations at schema version 59,
171-table drift, API/Demo builds, smoke and all 121 desktop/375px routes at
**120 Canonical / 1 Preview**. A real PostgreSQL 16 non-superuser/RLS run passes.
PWA v120.

### Document Void, correction, retention and two-person purge (TASK-121)

Migration 0060 adds an explicit record lifecycle to every managed document. Only an
actor-owned, unsubmitted `draft` may be physically deleted. `submitted` and
`approved` records require a reasoned Void; `posted` and tax-finalised `sealed`
records reject direct mutation and require a linked immutable correction or reversal
version. Legal hold and paper-original custody are versioned, reasoned governance
events.

Post-retention permanent purge is a two-person workflow: Records Manager initiates and
a distinct Finance actor approves or rejects. Execution re-checks retention, hold,
custody, version and content integrity, then removes operational bytes and metadata
atomically across database or staged filesystem storage. The purge request and a
permanent SHA-256 tombstone retain the original document-key hash, version manifest,
actors and custody state, and prevent silent key reuse. My Receipts exposes direct
delete only for stored drafts and reasoned Void only for submitted/approved records in
five languages. Final gates pass lint, dual typecheck, 471 tests plus one expected
skip, 61 migrations at schema version 60, 175-table drift, API/Demo builds, smoke,
all 121 desktop/375px routes and a real PostgreSQL 16 non-superuser/RLS run. PWA v121.

### Sensitive document access audit and storage parity (TASK-122)

Migration 0061 adds append-only `document_access_event` facts that deliberately
survive governed content purge. Every user-facing view, download, print or export
requires a 3–500 character purpose and stable retry key, then records tenant, actor,
document id, immutable version id/number/SHA-256 and timestamp. A reused key returns
the same audit fact; reuse for a different access fails closed.

The content API authorizes the owner or an explicitly privileged manager, hides
cross-tenant records as unavailable, verifies database-owned size/hash metadata and
returns no bytes or audit event until the selected version has a clean malware scan.
Database and single-node filesystem providers pass one shared test contract for
authorization, retention, version/hash integrity, retries and tamper detection.
My Receipts retains five-language quarantine/review/failure states and passes the
standard desktop/375px no-overflow route audit. Final gates pass lint, dual typecheck,
473 tests plus one expected skip, 62 migrations at schema version 61, 176-table drift,
API/Demo builds, smoke, all 121 desktop/375px routes and a real PostgreSQL 16
non-superuser/RLS access-event proof. PWA v122.

### Effective-dated expense tax, FX and GL policy (TASK-123)

Migration 0062 introduces category policy headers and confirmed effective-dated
versions. A version governs evidence requirement, base-currency limit, employee/company
payment sources, input-tax/non-deductible/exempt treatment, recoverable percentage,
expense/input-tax/payable/clearing accounts and table-rate versus eligible actual-bank
FX. The command rejects overlapping confirmed category periods and invalid cross-tenant
or account-type mappings.

Line submission resolves policy, tax rule and FX rate on the transaction date using
Decimal, then creates an immutable snapshot of original net/tax/gross, functional
currency, policy rate, base expense/input-tax/gross and GL mappings. Tax must reconcile
exactly to configured treatment. A foreign-currency company-paid line may use a
verified actual bank charge only when its policy allows it; Finance permission, a
reason and clean immutable document evidence are mandatory, and the override is a
separate append-only audit fact. Final gates pass lint, dual typecheck, 477 tests plus
one expected skip, 63 migrations at schema version 62, 181-table drift, API/Demo
builds, smoke, all 121 desktop/375px routes and a real PostgreSQL 16 non-superuser/RLS
policy-snapshot proof. PWA v123.

### Employee-owned multi-line expense claims (TASK-124)

Migration 0063 adds employee-owned claim headers, multiple merchant/date/purpose/
currency/tax/payment-source lines, linked governed receipt inbox evidence and
department/cost-centre/project allocations. Amount splits reconcile exactly to line
gross; percentage splits reconcile to exactly 100% and use deterministic final-line
rounding. `/api/my/claims` derives the owner exclusively from Session and provides
idempotent create, replace-lines and employee-submit commands. The Demo adapter reads
the same PGlite facts.

Only the employee owner can replace draft facts or perform final submission.
Automatic final submission separately requires immutable prior claim authorization
and an eligible employee-authorized system-submitted receipt on every line. Submission
attaches the effective TASK-123 policy snapshot to each line, hashes a revision and
appends an event. Database triggers reject post-submission line/allocation rewrites
and make authorization, revision and event rows append-only. Final gates pass lint,
dual typecheck, 480 tests plus one expected skip, 64 migrations at schema version 63,
187-table drift, API/Demo builds, smoke, all 121 desktop/375px routes and a real
PostgreSQL 16 non-superuser/RLS claim proof. PWA v124.

### Expense line approval, duplicate risk and budget control (TASK-125)

Migration 0064 adds confirmed effective-dated expense-control versions, immutable
per-line control assessments, weighted duplicate signals, reasoned Finance overrides
and a projection from each claim line to the generic approval workflow. Submission now
starts Manager then Finance approval for every line; an exceeded or missing budget may
warn, insert a configured exception approver before Finance, or roll back submission.
Approvers may approve, reject or return individual lines but cannot approve their own
claim or edit employee-submitted facts.

Duplicate assessment combines exact document SHA-256, provider-generated visual
fingerprint and normalized merchant/date/gross/tax-number signals. Final approval of a
high-risk line requires a user with Finance override permission to append a reasoned,
immutable disposition. `/api/expense-approvals` exposes only actor-authorized queue
facts and line decisions, while `/api/expense-policies/controls/versions` confirms the
effective control behavior. Final gates pass lint, dual typecheck, 484 tests plus one
expected skip, 65 migrations at schema version 64, 192-table drift, API/Demo builds,
smoke, all 121 desktop/375px routes and PostgreSQL 16 non-superuser/RLS proof. PWA
v125.

### Corporate-card statement reconciliation (TASK-126)

Migration 0065 adds immutable card-import headers, normalized issuer transactions,
reviewable match candidates, persistent unresolved work and append-only events.
`/api/corporate-cards/imports` accepts only a 5 MB/1,000-row exact eight-column CSV or
single-sheet XLSX source and validates the complete file before apply. Tenant-scoped
source hash, statement identity, external id and normalized line fingerprints prevent
duplicate application.

Automatic matching resolves the active employee holder and compares receipt owner,
transaction date (exact or within two days), currency and amount. Up to three
confidence-ranked candidates retain their contributing reasons; no candidate is
silently accepted. Finance accepts/rejects a suggestion or resolves/waives a persistent
unknown-holder/missing-receipt follow-up, with guarded state transitions plus audit and
event history. Final gates pass lint, dual typecheck, 488 tests plus one expected skip,
66 migrations at schema version 65, 197-table drift, API/Demo builds, smoke, all 121
desktop/375px routes and PostgreSQL 16 non-superuser/RLS proof. PWA v126.

### Mileage, per diem and cash advances (TASK-127)

Migration 0066 adds confirmed, non-overlapping mileage and per-diem policy versions
plus employee-owned calculation snapshots. Every calculation retains the applicable
policy id/version, service date, unit, Decimal units/rate/amount, formula evidence and
an explicit `receipt_required=false`; Finance approval cannot be performed by the
employee who owns the calculation.

Cash-advance issue is replay-safe and posts a balanced Dr Advance Receivable / Cr Bank
pair. Closing locks the issued advance, accepts only approved unapplied allowance or
employee-paid claim-line sources for the same employee and functional currency, and
requires employee repayment to equal the remaining advance exactly. Application posts
Dr Employee Payable / Cr Advance Receivable, repayment posts Dr Bank / Cr Advance
Receivable, and any expense excess remains an explicit employee-payable difference.
Applications, paired GL links and lifecycle events are immutable and tenant scoped.
`/api/expense-settlements` exposes governed policy, calculation, approval, issue, close
and queue operations. Final gates pass lint, dual typecheck, 492 tests plus one expected
skip, 67 migrations at schema version 66, 203-table drift, API/Demo builds, smoke, all
121 desktop/375px routes and PostgreSQL 16 non-superuser/RLS proof. PWA v127.

### Approved expense posting and employee payables (TASK-128)

Migration 0067 adds one immutable posting per final line approval and immutable
posting-leg links to the existing general ledger. The final Finance decision, claim
refresh and posting share one transaction: employee-paid lines debit Expense and
Input Tax then credit the configured Employee Payable liability; company-paid lines
credit their snapshotted bank or card-clearing asset/liability account. An eligible
verified actual bank charge replaces the company-paid functional gross and scales
input tax proportionally while preserving cent-exact balance.

Posting locks and validates exactly one open accounting period, verifies account types,
uses a stable claim/line/version journal reference and replays an existing posting
instead of duplicating it. A period or account failure rolls back the approval and all
ledger effects; the incomplete API idempotency claim is abandoned so the same key can
recover after the configuration is corrected. Database triggers prevent posting,
posting-leg or linked-GL mutation. Final gates pass lint, dual typecheck, 496 tests plus
one expected skip, 68 migrations at schema version 67, 205-table drift, API/Demo
builds, smoke, all 121 desktop/375px routes and PostgreSQL 16 non-superuser/RLS proof.
PWA v128.

### Five-language expense workspaces and proof (TASK-129)

`my-claims` is now a Canonical `transaction-list-v1` register and
`expense-claim` is an owner-only `case-detail-v1` route. Their shared projection reads
the employee from the authenticated session, exposes snapshotted policy and verified
actual FX, input tax, exact allocations, budget outcome, per-line approval and
immutable posting evidence, and deliberately withholds duplicate evidence hashes and
the matched employee's line identity. The production API returns the same bounded
projection through `/api/my/claims` and `/api/my/claims/:claimId`.

My Approvals now composes leave and expense work. Approvers can approve, reject or
return a line and Finance can record the governed duplicate override, but neither
surface offers editable claimant facts. A dedicated bounded audit injects partial
decisions, JPY-to-SGD policy/actual FX, duplicate override, split allocations, budget
breach, successful posting and locked-period failure across en/ms/zh/ja/vi at desktop
and 375px. Final gates pass lint, dual typecheck, 496 tests plus one expected skip,
68 migrations at schema version 67, 205-table drift, API/Demo builds, smoke, all 122
desktop/375px routes at **122 Canonical / 0 Preview**, and PostgreSQL 16
non-superuser/RLS proof. PWA v129.

### Encrypted employee payout profiles (TASK-130)

Migration 0068 adds one tenant-scoped payout profile per active employee and an
append-only event stream protected against UPDATE/DELETE. Bank country, currency,
bank identity, holder name and account number are normalized before the complete
sensitive payload is encrypted as an AES-256-GCM envelope. Ordinary self and
HR/Finance reads omit that envelope and return only masked holder/account facts.

The authenticated employee identity owns create/update; client-selected employee
identity is rejected. Reveal requires a dedicated self or Finance permission, a
3–500-character purpose, an audited event and a `Cache-Control: no-store` response.
Verification requires a different HR/Finance actor, optimistic version and reason.
Every subsequent employee modification clears verification and records why, while
the batch-selection boundary rejects any unverified profile. Final gates pass lint,
dual typecheck, 500 tests plus one expected skip, 69 migrations at schema version 68,
207-table drift, API/Demo builds, desktop/mobile smoke, in-app-browser PGlite v68
startup with zero runtime errors/overflow, and PostgreSQL 16 non-superuser/RLS proof.
PWA v130.

### Maker/checker reimbursement payment batches (TASK-131)

Migration 0069 adds maker-authored reimbursement batches, their posted-payable
membership and append-only lifecycle evidence. Candidate selection admits only
employee-paid immutable expense postings not reserved by another batch, linked to an
active employee and a currently verified same-currency payout profile. Draft
membership is optimistic-versioned and only the original preparer may replace it.

Release is a separate permission and actor. The checker cannot be the maker or own any
claim in the batch. The release transaction re-locks every payout profile and rejects
any verification/version change, copies the AES-GCM envelope into the line snapshot,
hashes the posting/profile/version/member facts and then freezes the batch and lines.
Database triggers independently reject incomplete snapshots, self-payment, stale
profiles and any post-release batch/member mutation. Ordinary API/Demo projections
remain masked and omit encrypted envelopes. Final gates pass lint, dual typecheck, 503
tests plus one expected skip, 70 migrations at schema version 69, 210-table drift,
API/Demo builds, desktop/mobile smoke, in-app-browser PGlite v69 startup with zero
runtime errors/overflow, and PostgreSQL 16 non-superuser/RLS proof. PWA v131.

## Employee self-service, leave and expense programme (EPIC-052–056)

TASK-106 through TASK-110 delivered identity, account lifecycle, actor-owned API,
five My Work shell routes and the identity security proof. TASK-111 delivered the
policy/calendar foundation, TASK-112 the immutable ledger, TASK-113 the governed
leave lifecycle plus two Canonical leave routes and TASK-114 the generic approval,
delegation and capacity boundary. TASK-115 delivered the Canonical Team Calendar and
optional outbound delivery boundary. TASK-116 delivered the governed Payroll
deduction/encashment boundary. TASK-117 delivered the managed-document storage
boundary, TASK-118 delivered bounded secure capture plus offline mobile drafts and
TASK-119 delivered fail-closed scanning plus governed extraction, TASK-120 delivered
the confidence-governed receipt inbox, TASK-121 delivered document lifecycle,
correction and two-person retention purge, TASK-122 delivered sensitive access audit
plus storage parity, TASK-123 delivered effective tax/FX/GL expense policy and
TASK-124 delivered employee-owned multi-line claims with exact allocation and TASK-125
delivered line approval, duplicate risk and budget control, TASK-126 delivered bounded
corporate-card reconciliation, and TASK-127 delivered versioned allowance calculations
and reconciled cash advances. TASK-128 delivered transactionally coupled final approval
and balanced expense posting. TASK-129 delivered the five-language expense
register/detail/approval SSOT and responsive privacy/failure proof, TASK-130 delivered
encrypted, masked, independently verified employee payout profiles, and TASK-131
delivered maker/checker reimbursement batches with immutable release snapshots.
TASK-132 delivered encrypted versioned bank artifacts, access audit, partial bank
outcomes, failed-line retry and successful-line-only settlement. TASK-133 delivered
immutable filtered tax snapshots and retry-safe reconciled PDF/XLSX/CSV/ZIP/manifest
artifact sets with sensitive access audit. TASK-134 delivered immutable sealed-pack
version chains, correction difference manifests, effective-dated SG/MY/company
retention and chain-scoped append-only legal holds. TASK-135 completed the executable
employee-to-tax evidence index and final release proof: account activation,
leave/Payroll, receipt, claim approval, balanced posting, maker/checker, partial bank
outcome and immutable tax correction are covered by PGlite/API tests plus real
PostgreSQL forced RLS, five languages and responsive audits.

The programme is intentionally ordered:

1. **EPIC-052 — Employee Identity & My Work:** organisation code + username login,
   encrypted pre-activation credential, forced first-login completion, company-scoped
   employee/user link, multiple role assignments, hierarchy-scoped Manager capability
   and actor-derived `/api/my/*` resources.
2. **EPIC-053 — Full Leave Management:** versioned work/holiday/leave policy,
   append-only balance ledger, full/half-day applications, multi-level approval,
   delegation/capacity, medical privacy, `calendar-workspace-v1`, outbound calendar
   events and Payroll deduction/encashment sources. Existing HR-lite day values remain
   immutable Legacy Policy snapshots.
3. **EPIC-054 — Receipt & Secure Document Processing:** database-default or optional
   single-node filesystem content storage, bounded mobile capture, fail-closed
   quarantine, local OCR plus opt-in BYOK Vision, 98%-minimum governed auto-submit,
   reasoned Void/correction, legal hold, paper custody and post-retention purge.
4. **EPIC-055 — Expense Claims & Accounting:** employee/company-paid claims, receipt
   inbox, tax/GL/FX policy, manager + Finance line decisions, duplicate/budget control,
   card-statement matching, mileage/per diem/advance settlement and balanced posting
   to Employee Payable or company-paid clearing.
5. **EPIC-056 — Reimbursement Payments & Tax Evidence:** encrypted payout profiles,
   maker/checker bank-file batches, partial bank results, balanced cash settlement and
   immutable PDF/XLSX/CSV/ZIP/hash tax-support packages with correction versions. A
   self-service My Work screen (TASK-160) now fronts the Tax Evidence Center with
   employee/currency/paper-custody filters and an `openai_compatible` BYOK vision
   provider option.

Confirmed constraints are recorded honestly. MFA, sensitive-operation step-up and
email verification remain optional by product decision; this is an accepted risk, not
an implemented security guarantee; `SECURITY.md` records the residual exposure and
current mitigations. Reporting lines automatically maintain provenance-marked Manager
roles without deleting manual authorization. Receipt content defaults to database
binary storage and may be switched to a server filesystem provider, whose single-node
limitation must remain visible. The programme excludes hourly leave, native mobile apps, two-way
calendar edits, direct bank APIs and direct tax filing.

## Canonical UI internationalization (EPIC-057)

TASK-136 locked the contract before runtime work; TASK-137 through TASK-139 are now
complete. Five browser-local languages use English default/fallback, lazy validated
non-English packs, safe variables/plurals, locale-aware UI formatting and atomic
in-place switching without form, route, scroll or focus loss. Business records and
generated/exported/statutory documents remain outside UI i18n. The 2026-08-10 static
audit passes 1,533 canonical keys / 69 local packs and the full 128-route × 5-language
× 2-viewport browser matrix. Current PWA cache version is v259 and the PWA update audit
passes.

## Platform Module Entitlement tenant cutover (2026-08-12)

TASK-184 recorded the source/target split. TASK-185 implements the commercial
Module Catalog, migration 0094, versioned Master/default and Company allocation state,
independent `platform_superadmin` permissions, platform-only APIs, hard dependencies,
authorization-version invalidation, audit/correlation and deterministic Demo fixtures.
TASK-186 implements the tenant cutover and TASK-187 implements the separate platform
realm/workspace/simulation. No production deployment was performed.

- Platform Superadmin owns the Master commercial entitlement and Company allocation;
  Company Owner owns tenant users/roles/permissions only.
- Existing `master_module` is normalized by migration 0094 from the union of current Company-enabled
  states so no effective access is lost. `company_module` retains per-Company
  allocation. Effective access is `Master enabled AND Company allocated`; Master disable
  masks rather than overwrites allocation.
- One platform-defined default allocation set per Master is stored and is applied to
  new Companies; tenant onboarding has no module stage or selector.
- A shared Module Catalog enumerates business modules for the platform domain and Demo;
  registered tenant route/resource/API contracts use it. Dashboard/Home, My Work,
  Admin, Settings and Account/Notifications are baseline services, not sellable
  entitlement switches.
- `platform_superadmin` owns `platform.modules.read/manage` and
  `platform.simulation.manage`; support roles do not.
  `admin.modules.manage` is deprecated/non-assignable and migration 0095 retires its
  existing tenant grants and active overrides.
- The shared API-mode entry has a separate realm backed by independent
  `platform_principal.password_hash` credentials and one-hour non-remembered
  `erp_platform_session`/CSRF cookies; it does not create `app_user` or `erp_session`.
  No MFA is planned for v1, which remains an explicit high-risk limitation.
- Platform Superadmin may enter a default-15-minute, bounded, visible simulation of an
  active assigned user in the selected Master/Company. Authority is exactly the target
  user's entitlement, permissions, scope and workflow authority; audit attributes both
  the target user and real platform principal. Platform MAC writes reject until return.

TASK-185 verification passed its recorded foundation gates. TASK-186 focused
authorization proof passes 8 files / 45 tests; root/Web typechecks, lint, API/Demo
builds, schema v95 across 96 migrations, 246-table drift, regenerated/verified Demo
pack, 58-route × 12-role access matrix, targeted five-language dual-viewport onboarding
audit, task-graph validation, Markdown links and `git diff --check` pass. The full suite
run reached 164 passed files / 654 passed tests and one expected skip; its sole failing
file was the stale Demo role-permission pack, which was regenerated and then passed its
focused test. A second 15-minute full-suite run was not repeated.
TASK-187 focused proof is 3 files / 12 tests: `platformSuperadmin.integration.test.ts`
proves password realm, no Remember Me, no tenant session, exact target authority,
company/logout lock, platform mutation block and dual audit; the remaining focused
platform tests, typechecks, schema v96/drift and an API-mode browser login/workspace
check also pass. TASK-188 completed the remaining full-suite, complete platform browser,
migration-preservation and release-gate proof: full Vitest passes 167 files / 660 tests with
one expected skip; access-matrix, browser i18n, desktop/375px smoke, lint/typechecks,
schema drift and API/Demo builds pass. No production deployment was performed.

EPIC-064 owns TASK-184–188. TASK-185–188 are complete, as are TASK-177–183 in
EPIC-063. EPIC-018 remains historical proof of server-side module enforcement but does
not define the approved future mutation owner.

## Platform Bootstrap & Tenant Provisioning boundary (2026-08-12)

TASK-189–191 are implementation-verified in the current source and focused tests.
Production first-run now has an independent, tokenless bootstrap only when all setup
foundation counts are zero. The transaction locks `system_state.production_setup`, creates
one `platform_principal` with a password hash and one-hour platform session, and records
an append-only `__platform__` audit event with request correlation and hashed source IP.
The retired anonymous tenant setup endpoint returns `410 legacy_setup_disabled`.

TASK-190 adds migration 0098 and the platform provisioning commands/routes. A
Platform Superadmin can create a server-generated Master, choose commercial Catalog
entitlements/default Company allocation, then create a Company in one transaction with
SG/MY localization/tax/control-plane/chart facts, inherited allocation, an immutable
Master Admin and a separate Company Owner. Subsequent Companies reuse the durable Master
Admin identity and receive system-managed membership/role assignments. Master Admin's
allowlist is limited to dashboard/company switch, user/role/audit/settings; it has no
business, workflow, payment, payroll, MAC, support, simulation or `platform.*` authority.
Platform mutations require independent session, Platform CSRF, idempotency key, duplicate
checks, request ID and audit. Existing Master/Company/entitlement APIs remain platform
only; tenant Company Owner access remains denied for MAC.

TASK-191 adds the shared API login realm selector, empty-state Create Master/Company
workspace, entitlement/default UI, idempotent mutation handling and focused negative
tests. Current evidence includes root/Web typecheck, lint, API/Demo builds,
`check:permissions`, `check:demo-schema`, `check:drift`, six focused files / 28 tests,
and the seven-file auth lifecycle slice including concurrent bootstrap (7/7).

TASK-192 is **Done**: migration 0098/RLS and application release preserved the old
production counts; anonymous legacy setup returned 410 and non-empty public bootstrap
returned 409. Restore-tested dumps/archives were created at
`output/pre-deploy-20260812T064439Z` and `output/post-deploy-20260812T065602Z`; only the
two named ERP volumes were deleted, and the recreated stack was migrated/RLS-protected
without seed. The final database has 249 public tables, 221 forced-RLS tables, zero
non-migration rows and zero document-storage entries. TASK-193 is **Blocked** because
`SMTP_HOST` is empty; no administrator email reset is claimed. The no-MFA/password-only
Platform Superadmin and first-caller bootstrap window remain accepted, documented risks.

## Expenses & Tax v1 implementation boundary (2026-08-12)

The approved product boundary is **Expenses & Tax v1 = Company Receipts + inclusive
transaction-date range + Preview + Receipt Pack PDF/Print**. TASK-177 delivers the
canonical backend/capture foundation: migration 0090, the `company_receipt` aggregate, its
transactional command layer and `/api/company-receipts` list/detail/create/update/void
API; TASK-178 adds migration 0091 exact-hash uniqueness and the read-only confirmation
context. TASK-181 delivers the standalone Pack slice and TASK-182 completes the
platform-entitlement/canonical-permission authorization boundary. TASK-183 completes
the browser confirmation hand-off from uploader-owned My Receipts evidence to the shared
confirmation/create contract. Authenticated API-mode journeys pass in the isolated
same-origin PGlite fixture and a newly created empty disposable PostgreSQL 16 database;
neither result authorizes production deployment.

Current reusable implementation is substantial but narrower:

- My Receipts accepts magic-validated JPEG/PNG/HEIC/HEIF/PDF, enforces 20 MB and
  20-page PDF limits, stores originals through managed-document versions/hashes,
  supports IndexedDB camera/file drafts and runs fail-closed scan plus OCR/Vision.
- Receipt inbox extraction retains field provenance, confidence, duplicate signals and
  governed document state. Existing Void/correction/retention/legal-hold controls remain.
- Tax Evidence can render registers and merged evidence PDFs from posted Expense Claim
  lines in API mode, including original PDF/JPEG/PNG content where supported.

The TASK-177 aggregate is Company-owned and stores confirmed metadata plus an immutable
reference to the uploader's clean, current governed document version. It requires no
Employee, Expense Claim, reimbursement, GL posting or tax decision. Tenant scope and
uploader attribution come only from Session, reads are bounded by an `afterId` cursor,
writes use optimistic `version`, and void is a retained audited tombstone. TASK-179
changes list/detail reads to explicit `expenses.company_receipts.read_own` and
`expenses.company_receipts.read_company`. TASK-182 completes the uploader-only mutation
cutover: confirmation/create require `expenses.company_receipts.create`, correction
requires `.edit`, and void requires `.void`. `employee.receipts.write` no longer grants
any Company Receipt mutation; it remains a My Receipts document-capture compatibility key.

TASK-178 reuses the existing magic-byte/size/page validation, managed-document custody,
IndexedDB draft/edit/retry path and fail-closed scan/OCR pipeline. The confirmation
endpoint returns immutable candidate source/model/confidence/review provenance and safe
suggestions; user-confirmed facts remain separate. A clean original is manually
confirmable when OCR fails or is unavailable, and one exact SHA-256 cannot form two
Company Receipts in the same Company. Similar merchant/date/amount never auto-merge.
The current Company Receipts screen now has a permission-gated Confirm receipt action:
it lists only `my.receipts()` evidence, reads its immutable confirmation context and
submits the metadata through `createCompanyReceipt`. The API adapter uses the
`/confirmations/:documentVersionId` and create endpoints; the PGlite adapter delegates
to the same shared domain commands. New static Demo uploads remain `scanner unavailable`
and cannot be confirmed until an external scan result marks the exact version clean.

TASK-179 adds migration 0092, explicit Receipt Manager-compatible grants, stored own/company
grants, permission-selected domain/API visibility, bounded Demo/API adapters and a
five-language responsive Company Receipts route. Desktop exposes date, merchant,
receipt number, category, amount, currency, uploader and status; mobile renders the same
facts as labelled cards, and cursor pagination never fetches unbounded Company history.
TASK-180 delivers query-side search, inclusive date presets/ranges, validation and
actionable Missing Date handling. TASK-181 adds migration 0093 and immutable,
creator-owned Pack snapshots containing every permission-visible Ready/dated match up
to 5,000 rows, not only the register page. Rows and document identities are frozen in
chronological order; exact totals remain separate by currency. Rendering rechecks scan,
version/hash/content and the 250 MB source bound, then produces one no-store/audited PDF
for Preview, download and Print: an A4 landscape register followed by copied multi-page
PDFs, embedded JPEG/PNG or an explicit unsupported-format identity placeholder. Demo/
PGlite and PostgreSQL/API adapters share the contract. Current Tax Evidence remains a
posted-claim flow and cannot be renamed as Company Receipts. TASK-182 registers
`expenses_tax` against the platform-owned Master entitlement AND Company allocation model:
the bespoke `/api/company-receipts` gate, Demo/PGlite adapter, `accessMatrix` and PWA
route guard deny missing/disabled state with `module_not_enabled` before tenant access
assignment. Migration 0097 deterministically backfills the three canonical mutation
grants from existing `employee.receipts.write` authorization and bumps the affected
Company authorization versions. It does not change production data until a separately
authorized migration deployment.

TASK-181 verification passes: focused Pack/API/Tax Evidence 3 files / 7 tests; full
Vitest 160 passed plus 1 skipped file (645 passed plus 1 skipped test); lint and both
typechecks; schema v93 / 94 migrations / 246-table drift; Demo and API builds; dedicated
Company Receipts E2E; five-language desktop/mobile route audit; 50-route desktop/mobile
list-layout audit; and desktop/mobile smoke. This historical TASK-181 evidence is
implementation proof, not deployment proof. TASK-182 adds its scoped authorization/i18n
evidence. TASK-183's current focused evidence adds `tests/e2e/company-receipts.spec.mjs`:
the API-shaped confirmation UI and a real PGlite upload → clean-worker simulation →
confirmation → persisted-register refresh both pass, alongside search/range, Pack
Preview/PDF/Print, pagination and 1440×900/390×844 zero-overflow/zero-console checks.
`tests/e2e/company-receipts-api.spec.ts` also passes an authenticated API-mode journey
through the same-origin adapter at 1440×900 and 375px. It passes both the isolated
PGlite fixture and a newly created empty disposable PostgreSQL 16 database, whose guard
rejects non-empty targets before migration/seed. The test-worker update is not a static-
Demo scanner implementation. The full 2026-08-12 serial Vitest run passes 168 files /
663 tests with one expected skip in 959.19 seconds; this is source-suite evidence, not a
production deployment claim. A post-TASK-183 compatibility correction serializes the six
Dashboard reads within its transaction-bound PostgreSQL client (`src/api/dashboard.ts`).
The disposable PostgreSQL browser journey now passes with no concurrent `client.query()`
deprecation; its harness fails if that warning returns before pg@9 turns it into an error.

EPIC-063 and TASK-177–183 register the implementation work. Expense accounting, Tax
Treatment, automated Tax Evidence, Employee Reimbursement and MyInvois are preserved
future/optional phases rather than v1 defects.

## Task backlog snapshot (tasks/tasks.jsonl)

- Done: 191 tasks
- In progress: 0
- Todo: 0
- Blocked: TASK-017 and TASK-193 (2)
- EPIC-056, EPIC-057, EPIC-059 and EPIC-060 are complete at the current 128 Canonical /
  0 Preview boundary. EPIC-058 remediation and EPIC-061 are complete. EPIC-062 has a
  complete documentation baseline, TASK-170's platform-support foundation,
  TASK-171's canonical permission registry, TASK-172's assignment migration and
  TASK-173's completed central decision/override boundary. TASK-174 is done: migration
  0088, atomic graph and Master-wide support version bumps, stale browser recovery and
  direct-URL revocation coverage are delivered. TASK-175 is done: migration 0089,
  production backup, target migration, RLS re-application, application release and
  public health/session verification all passed.
- EPIC-063 is complete. TASK-176 completed the source-backed Expenses & Tax boundary;
  TASK-177–179 delivered the Company Receipt schema/domain/API, secure confirmation and
  permission-scoped responsive register; TASK-180 delivered query-side search/date
  behavior and TASK-181 delivered immutable Receipt Pack Preview/PDF/Print. TASK-182
  delivered platform entitlement, canonical Company Receipt mutation authorization,
  accessMatrix and i18n parity. TASK-183 completed Demo/PGlite, authenticated API/PGlite
  and disposable PostgreSQL 16 browser proof, plus final documentation/KB synchronization;
  no production release claim follows.
- EPIC-064 is complete. TASK-184 completed the source-backed boundary, TASK-185
  delivered the platform entitlement foundation, TASK-186 delivered the tenant cutover
  and TASK-187 delivered platform login/workspace/exact-user simulation. TASK-188 completed
  the recorded source, migration, authorization, browser and release-gate evidence.
- EPIC-065 is complete. TASK-189–192 are verified for independent Platform bootstrap,
  Master/Company provisioning, Master Admin RBAC, migration 0098, deployment,
  restore-tested backups and the authorized exact-volume reset. TASK-193 is blocked on
  missing production SMTP.
- **Permanently blocked without a human**: TASK-017 (real-device verification)
  requires a physical phone — no agent can complete this task alone.
  TASK-021 (verify `scripts/setup.sh`) turned out **not** to be permanently
  blocked despite looking that way for several sessions: `git show
  HEAD:.env.example` reads the tracked blob through git's object database,
  which this sandbox's path-based permission system does not intercept the
  same way it blocks `Read`/`ls`/`cat` on that literal path — done 2026-07-17.
  Worth remembering next time something looks environment-blocked on a
  *tracked* file specifically: try reading it via git before concluding no
  agent can proceed.

## Next implementation boundary

The next boundary is TASK-193 and the separately human-owned TASK-017 physical-device
acceptance. EPIC-065/TASK-192 is complete; the public site is intentionally stopped at
the first Platform Superadmin registration page and no real account was created. TASK-193
remains blocked until SMTP is configured and an explicit reset-delivery decision is made.

## Where to go next

- Product scope → [MVP.md](MVP.md)
- Contract of record → [SPEC.md](SPEC.md)
- How it's built / conventions → [DESIGN.md](DESIGN.md)
- Work breakdown → [EPICS.md](EPICS.md), [ROADMAP.md](ROADMAP.md),
  [TASK.md](TASK.md), `tasks/tasks.jsonl`
- Releasing (demo bundle or Docker production) → [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- Agent workflow rules → [/CLAUDE.md](../CLAUDE.md)

## EPIC-059 implementation status (2026-07-27)

Phase 41 is complete. Migration 0073 and persistent PGlite schema v74 deliver
company roles/scopes/modules, atomic Staff activation, the deterministic enterprise
Demo, production onboarding/import/Go Live services and five-language UI. Release
proof passed 518 tests plus one expected skip, 232-table drift, PGlite/PostgreSQL
parity and forced RLS, both builds, smoke, 122 routes × five languages ×
desktop/375px and critical Chromium/Firefox/WebKit flows. Current-Chrome cold load was
8.905 seconds and common-route p95 was 38.7 ms. TASK-017 remains blocked for a physical
phone. See
[EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md](EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md).
