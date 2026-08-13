# ERP Excellence Review — 2026-08-12

This review answers one question: what does the current codebase actually provide, and
what must change before it can credibly be called a production-grade, best-in-class ERP?
Code, migrations and tests are implementation truth. [STATUS.md](STATUS.md) owns the
current built/tested/deployed status; [SPEC.md](SPEC.md) owns binding requirements;
[TASK.md](TASK.md) and [`../tasks/tasks.jsonl`](../tasks/tasks.jsonl) own execution.

## 1. Current source baseline

| Dimension | Current source/worktree truth | Evidence boundary |
| --- | --- | --- |
| Revision | `00e2533` on `main`, plus user-owned uncommitted Platform workspace state-machine/E2E edits observed during final review | The worktree changes are preserved and source-present only; neither HEAD nor those changes prove a deployed revision |
| Schema | 99 ordered migrations through 0098; schema version 98; 249 tables | Generated Demo schema and drift checks pass |
| UI | 129 Canonical / 0 Preview routes | Source registry; 128 routes declare API support because `staff-calendar` is omitted from `API_SCREEN_ROUTES` |
| i18n | 1,545 English keys; 72 local five-language packs | Static generation/audit passes; the complete browser matrix is dated TASK-183 evidence, not rerun in this review |
| Authorization registry | 314 permission codes; 116 resources; 62 actions; 5 updates | Registry check passes |
| Access model | 59 route contracts; 13 active role templates; Company Owner 115 permissions; Master Admin 10 | Current source inventory |
| Automated tests | 170 files / 666 tests collected | Collection count only; do not describe it as passed |
| Focused review proof | 7 files / 22 tests passed | Company Receipts, Receipt Pack, Platform support/provisioning/simulation |
| PWA | cache version v261 | Current service-worker source |
| Tasks after this review | 205 total: 192 Done / 0 In progress / 10 Todo / 3 Blocked | TASK-017, TASK-193 and TASK-203 are blocked |

Historical checkpoints such as 128 routes, 1,533 keys, 69 packs, 168 files/663 tests,
244 or 246 tables, 299/303 permissions and the original 112-permission Company Owner
backfill remain valid only where their task or date is explicit.

## 2. What is already strong

- One Drizzle/PostgreSQL schema and shared transactional TypeScript command layer serve
  Demo/PGlite and API/PostgreSQL modes. This is the right foundation for parity rather
  than a disposable mock demo.
- Major ERP chains are real and tenant-scoped: Sales, Purchasing, Inventory/Warehouse,
  Finance, CRM, Manufacturing, Quality, HR/Leave/Calendar, Payroll, Projects, Service,
  Documents and Expenses include persisted commands and tests rather than toast-only UI.
- Stock, money, approvals, immutable evidence and idempotent mutations are generally
  kept behind server-authoritative transaction boundaries.
- Tenant authorization has explicit registered permissions, role assignments, scopes,
  user overrides, workflow authority, module entitlement, authorization-version
  freshness and audit rather than a single Superadmin bypass.
- Company Receipts correctly remain separate from Employee Expense Claims, Tax Evidence
  and Project Progress Claims. Reuse occurs at the governed document/PDF primitive, not
  by conflating business records.
- Platform identity, commercial entitlement, first-run bootstrap, Master/Company
  provisioning, Master Admin and exact-user simulation are implemented as a separate
  control plane instead of tenant roles.

This breadth is valuable, but ERP quality is determined by trustworthy operating
boundaries, not screen count alone.

## 3. Implementation, proof and deployment boundary

| Area | Implemented | Dated automated proof | Deployment/current-live truth |
| --- | --- | --- | --- |
| Core ERP domains | Yes, at the Canonical depth recorded in STATUS | Broad unit/API/Demo/browser history | Production path exists; current public availability is not healthy-proven |
| Company Receipts v1 core | Aggregate, confirmation, own/company register, search/date, Pack, Demo/API adapters | PGlite/PostgreSQL fixtures and browser journeys; focused 22-test review subset passes | Migrations through 0098 were deployed under TASK-192, then production was reset; no authenticated production receipt UAT/data is claimed |
| Platform MAC/bootstrap/provisioning | Source and PGlite/API tests exist | Focused tests pass | Exact deployed HEAD is unproven; production RLS/runtime-role compatibility is unresolved |
| Latest Platform UX | Password visibility, tenant-only Remember, Demo quick login and responsive shell; existing-Company control is opt-in, with `+ Create Company` opening an inline ordinal Demo draft and Cancel/success closing it | Focused PGlite E2E covers closed DOM, open/Cancel focus, scoped drafts, conflict retention, returned-`companyFn` selection and responsive containment | Source/test evidence; hosted deployment remains a release-time proof |
| Current public service | N/A | Review probes attempted | `/health` and `/api/setup/status` returned HTTP 502 during this review |
| Current CI | Workflow exists | Older source run evidence exists | HEAD run `31603746668` started zero jobs because GitHub billing/spending blocked it |

Never collapse these columns into a single “done” claim.

## 4. Verified P0 gaps

### 4.1 Production RLS and Platform Company provisioning conflict

[`production-rls.sql`](../deploy/sql/production-rls.sql) requires a non-superuser,
non-BYPASSRLS runtime role and transaction-local `app.master_fn`/`app.company_fn`.
Normal tenant commands use `withTenantTransaction`; the retired setup path also set both
values. The current Platform mutation wrapper in
[`routes/platform.ts`](../src/api/routes/platform.ts) opens a transaction but does not set
the generated Company context before
[`platformProvisioning.ts`](../src/modules/setup/platformProvisioning.ts) writes
RLS-protected tax, control-plane, module, onboarding and account rows.

The bundled Compose URL also defaults to the PostgreSQL bootstrap user, which can be a
superuser and therefore bypass FORCE RLS. The present result is an unsafe fork: compliant
runtime roles may break provisioning, while a superuser runtime makes provisioning work
by bypassing tenant defense-in-depth. Existing PostgreSQL security proof exercises the
retired setup command, not the current Platform bootstrap → Master → Company path.
TASK-195 owns the fix and real PostgreSQL proof.

### 4.2 Receipt Pack authorization downgrade

Pack creation freezes `own | company` visibility. Later Pack metadata/PDF routes verify
only that the creator still has any receipt-read permission, then the domain verifies
tenant plus creator. A creator downgraded from `read_company` to `read_own` can therefore
retain an old company-wide snapshot and other uploaders' original evidence. Current docs
previously overstated that the same visibility was reapplied. TASK-196 owns the repair,
cross-tenant/downgrade tests and export-audit decision.

### 4.3 Company Receipts workflow is backend-complete but UX-incomplete

- The Confirm button checks adapter function existence, not `.create` capability; a
  read-only user sees an action that later fails at the API.
- The Missing Date badge only navigates to My Receipts. It does not open a Company Receipt
  editor or carry a receipt identifier.
- Update and void APIs/adapters exist but have no Company Receipts detail/edit/void UI.
- The evidence picker calls the bounded first 100 My Receipts records with no pagination
  and indirectly requires Employee Self Service plus a linked Employee. Direct Company
  Receipt commands do not require Employee, but the normal capture/picker flow does.

TASK-197 owns the complete, permission-aware user workflow.

### 4.4 Platform privilege policy is internally contradictory

The platform schema states that a principal has no customer-data access without an
expiring Support Grant. `evaluateSupportAccess` is implemented but not consumed by tenant
data routes. Exact-user Platform Superadmin simulation can enter tenant reads/writes
without a grant, reason or ticket. This may be a deliberate Superadmin exception, but it
is not currently expressed as one coherent policy. Platform login is also password-only
with no MFA or sensitive-operation step-up. TASK-198 owns the ADR and controls.

### 4.5 Production and release evidence is not current

The public endpoint returned 502 during review, the precise deployed commit after the
last reset is not immutable evidence, and HEAD CI is externally blocked. `staff-calendar`
is Canonical and has domain/API work but is the only Canonical route omitted from API
screen metadata. TASK-199 restores/proves service state, TASK-200 closes route/evidence
parity, and TASK-203 remains blocked until GitHub billing permits jobs to run.

### 4.6 Malaysia SST posting and effective-date semantics are unsafe to overclaim

The canonical tax lookup treats `valid_to` as exclusive, while the Expense policy
includes that boundary day. Supplier-invoice posting also routes tax to recoverable
Input Tax without a complete SG GST versus MY SST regime/classification engine. Malaysia
SST is therefore seeded effective-dated rate data, not a proven compliant posting model.
Official 2026 sources also show classification-specific 6%, 8% and specific-rate cases,
so prose cannot be the rate authority. TASK-204 owns the interval, posting, governed
configuration and tax-owner release proof.

## 5. P1 depth after the P0 boundary

- Define measurable SLO/SLI, alert ownership, encrypted backup retention, timed RPO/RTO
  restore drills, worker backlog/dead-letter monitoring and realistic scale/query budgets
  (TASK-201).
- Give Receipt Packs concurrency-safe idempotency, history/retention/legal hold/purge,
  localized Unicode PDF, Decimal-safe browser formatting and Company-calendar date
  presets (TASK-202).
- Directly test Vision gateway/provider failures and make retry/manual/local fallback
  explicit; current encrypted connector support is not proof of a configured production
  provider, region or account (TASK-205).
- Preserve physical-device acceptance as TASK-017 and production email recovery as
  TASK-193. Browser emulation and reset primitives do not close either task.

## 6. Architecture priorities for a best ERP

The next quality bar is ordered deliberately:

1. **Isolation before features:** close RLS/runtime-role/provisioning and Pack export
   authorization before adding more business modules.
2. **Privileged assurance:** require coherent Support/Simulation policy, MFA, step-up,
   recovery and immutable attribution for the control plane.
3. **Complete user journeys:** every exposed action must be capability-aware and lead to
   a real correction/state transition, including denial and conflict states.
4. **Operational proof:** current revision, CI, availability, backups, restore and workers
   must be continuously observable rather than asserted from a past release.
5. **Scale and localization correctness:** keyset queries, Decimal values, Company time,
   Unicode artifacts and retention rules are domain correctness, not polish.
6. **Then deepen ERP integration:** after trust gates pass, add explicit, audited
   conversions from Company Receipt to company-paid AP/card, Employee Claim or Tax
   Evidence without merging those aggregates.

## 7. Review verification

Passed during this review:

- generated schema v98 / 99 migrations / 249-table drift checks;
- Demo pack v15, 1,545-key i18n bootstrap, 140 business-copy entries and 72-pack static
  i18n audit;
- permission registry: 314 codes / 116 resources / 62 actions / 5 updates;
- Demo build;
- focused Company Receipts/Pack/Platform tests: 7 files / 22 tests;
- final scan of 41 repository-owned Markdown files found zero missing local links;
  task/epic graph validation and `git diff --check` also pass.

Not passed or not run during this review:

- the browser route/i18n matrix, because the local Playwright Chromium executable is not
  installed;
- the current 170-file/666-test collection as a full execution;
- current Platform provisioning with a non-superuser PostgreSQL runtime role;
- physical-phone PWA acceptance;
- authenticated production Company Receipts UAT;
- current public health, which returned 502 rather than 200;
- HEAD CI, which GitHub blocked before any step ran.
