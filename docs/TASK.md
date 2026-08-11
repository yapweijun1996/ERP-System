# Task Index

Reviewed: **2026-08-11**

The machine-readable task source of truth is
[`../tasks/tasks.jsonl`](../tasks/tasks.jsonl). This file is a human-readable index,
not a second task registry.

## Current totals

- Done: **178**
- In progress: **0**
- Todo: **9**
- Blocked: **1**
- Total: **188**

## Current release-quality note

The 2026-08-10 release follow-up is complete: `npm run audit:screens` renders all 128
routes at desktop/mobile and passes the 128 Canonical / 0 Preview maturity plus
layout/behavior contracts. The full i18n matrix passes 1,533 canonical keys / 69 local
five-language packs across 128 routes × 5 languages × 2 viewports. The 2026-08-11
TASK-178 regression passes 159 files plus 1 skipped file (641 passed, 1 skipped tests);
`npm run smoke` passes at
desktop/mobile after the visible-only navigation-badge contract was fixed. PWA update,
access matrix, build, permission, schema and drift gates pass. TASK-017 remains the
separate physical-device blocker and does not change the machine-readable totals. The
purchase-requisition Web adapter uses the actor-input command shape.

## Current authorization programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-169 | Done | Align architecture and documentation with current authorization code |
| TASK-170 | Done | Separate platform principals and time-bounded support access |
| TASK-171 | Done | Canonical permission registry and compatibility-key migration |
| TASK-172 | Done | Assignment-scoped grants, targets and expiry |
| TASK-173 | Done | Central authorization decision, explicit deny and safe explanation |
| TASK-174 | Done | Fail-closed module/resource registry and authorization versioning |
| TASK-175 | Done | Company Owner cutover, target migration 0089, production RLS re-application and application release verified |

## Planned Expenses & Tax programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-176 | Done | Source-audit and document the approved Company Receipts-only v1 boundary; synchronize KB without code or deployment |
| TASK-177 | Done | Migration 0090, Company Receipt aggregate/domain/API, optimistic concurrency, audit and PGlite/PostgreSQL RLS proof |
| TASK-178 | Done | Migration 0091 exact-hash uniqueness and immutable OCR-provenance confirmation/manual-fallback context |
| TASK-179 | Todo | Permission-scoped own/company register and responsive UI |
| TASK-180 | Todo | Inclusive transaction-date range, search, pagination and Missing Date behavior |
| TASK-181 | Todo | Receipt Pack preview, PDF, mixed-currency register and Print |
| TASK-182 | Todo | Demo/API parity, module entitlement, authorization, accessMatrix and i18n |
| TASK-183 | Todo | Browser/release proof and final documentation/KB synchronization |

TASK-182 additionally depends on TASK-186 so Expenses & Tax adopts the platform-owned
entitlement model rather than extending the current tenant MAC authority. TASK-177–181
retain their existing dependency order and are not blocked by EPIC-064.

## Planned Platform Module Entitlement programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-184 | Done | Source-audit current tenant MAC, record the approved target and synchronize docs/KB |
| TASK-185 | Todo | Module Catalog, Master entitlement, Company allocation, platform API and Demo harness |
| TASK-186 | Todo | Remove tenant MAC permission/UI/API/onboarding authority and cut over enforcement |
| TASK-187 | Todo | Independent Platform Superadmin login/workspace and audited exact-user simulation |
| TASK-188 | Todo | Migration, authorization, dual-mode, browser and release proof plus final docs/KB |

TASK-174 has closed the cache/direct-URL dependency, so TASK-185 is now eligible. The
current application remains tenant-controlled until TASK-185 and TASK-186 are delivered;
TASK-184 did not change code, schema, routes, permissions or production.

TASK-177/178 implement the Expenses & Tax backend/capture foundation: aggregate,
uploader-only API, exact-hash protection and confirmation context over the existing
secure offline/upload/OCR pipeline. The customer-facing Company Receipts register,
date range, Receipt Pack, module entitlement and final canonical permission set remain
pending. TASK-179 is now the lowest-numbered dependency-eligible code task; TASK-185 is independently
eligible for the MAC programme.

## Latest implementation milestones

- **TASK-175 — Done:** migration
  `0089_company_owner_cutover.sql` creates or normalizes one immutable company-scoped
  Company Owner role per company, backfills 112 explicit registered permission rows and
  `* / company` scope, moves legacy Superadmin assignments idempotently, makes the
  legacy `is_superadmin` flag inert and preserves last-owner recovery compatibility.
  Central authorization now evaluates role permissions and scopes only; a legacy
  Superadmin-only assignment is denied. Focused cutover, authorization, lifecycle and
  setup tests pass. A disposable PostgreSQL 16 container passed Demo parity/true
  concurrency and the non-superuser RLS security suite. The target production database
  was backed up to `output/production-backup-20260810/erp-before-0089.dump`, migrations
  0084–0089 were applied, production RLS was re-applied and `deploy/release.sh`
  completed. Post-release checks confirmed 90 migration entries, 219 forced-RLS
  tenant tables/policies, zero active Superadmin flags/assignments, healthy services,
  public `/health` 200 and unauthenticated session 401.
- **TASK-173 — Done:** migration `0087_pink_shadowcat.sql` and
  `src/auth/authorization.ts` provide the central tenant decision boundary, safe public
  reason codes, explicit user-level override precedence and audited explanations. All
  approval slices now re-check their registered permission in the domain command. The
  versioned leave/expense workflow additionally binds permission decisions to the
  current locked step, server-resolved resource/module/scope context and policy
  snapshot; inactive named authorities are denied, and manager-owned steps cannot be
  taken over by an HR permission. Existing in-flight instances continue under their
  snapshotted authority with no implicit migration. Focused authorization, approval and
  API regressions pass 18/18 for the current strict-step slice; root typecheck passes.
  The latest full Vitest run passes 635 tests with 1 intentional skip across 156 test
  files; the prior Team Calendar fixture failures were aligned to explicit HR approval
  permissions. Instance/step/resource/policy-bound delegation remains a follow-up
  hardening item.
- **TASK-172 — Done:** migration `0086_youthful_mac_gargan.sql` adds the stable
  `user_company_role.assignment_id` primary key, `[valid_from, valid_until)` validity,
  assignment/revocation provenance and `user_company_role_scope`. The role-assignment
  service/API supports multiple independently scoped assignments and validated
  `none/company/department/team/employee` targets; permission, approval, setup and
  impersonation checks share the active-assignment predicate. Existing
  `role_resource_scope` rows remain a dual-read fallback for assignments whose
  `scope_backfilled_at` is null. Expired and revoked assignments are denied immediately;
  TASK-173 is complete in migration 0087. Migration 0088 provides the Company
  authorization-version source; TASK-174 completes browser snapshot invalidation,
  Master-wide support bumps and stale-session/direct-URL proof.

## Latest completed authorization task

- **TASK-174 — Done:** TASK-174-A treats unknown business-module keys as
  disabled at the backend gate, registers payroll and explicitly keeps authenticated
  `account/*` service routes outside business-module switching while retaining their
  route permissions. TASK-174-B now has migration 0088's company-scoped
  `authorization_version`; core role, assignment, scope, module, override and
  invitation mutations bump it atomically, Master-wide support grant changes advance
  every Company marker, and session/effective-capability projections expose it. API
  requests carry the marker; stale state receives 409, recovers through the session
  endpoint and reloads without replay. Current server decisions query live permission,
  organization and workflow-policy rows. Focused TASK-174 coverage passes 19/19.

- **TASK-171 — Done:** `src/auth/permissionRegistry.ts` is now the application-owned
  registry. It contains 299 static definitions (157 compatibility entries and 142
  canonical entries, including a separate platform-support domain); the resource
  registry projects exact canonical permissions for 116 resources and 62 actions,
  including 5 update contracts. Ordinary role evaluation and approval authority
  resolution use explicit registry candidates and fail closed for unknown keys;
  platform-domain keys are rejected before tenant role evaluation; the legacy
  Superadmin compatibility role is deprecated and no longer bypasses permissions.
  Role editing/template cloning, leave approval configuration and expense extra-
  approval configuration reject unregistered tenant permissions. Existing broad
  `role_permission` text keys remain compatible through explicit mapping metadata;
  TASK-172 owns the assignment migration; TASK-173 now owns the central decision and
  explicit-override boundary; migration 0088's source/marker and TASK-174 invalidation
  are implemented, while Company Owner cutover is delivered in migration 0089. The disposable
  PostgreSQL 16 parity, concurrency and RLS proof for TASK-175 are green, and target
  production migration and release verification are complete.
  `npm run check:permissions` is the CI gate for source literals, role templates,
  resource/action contracts and compatibility metadata. The latest full Vitest run
  passes 156 files plus 1 skipped file (635 passed, 1 skipped tests); the prior HR
  fixture failures were corrected without widening the production role templates.

- **TASK-170 — Done:** migration 0084/0085 adds platform principals, platform roles,
  hash-backed bearer/CSRF sessions, auditable support grants and exact master/company
  boundaries without making platform principals tenant users. Read-only, restricted-
  write and approval-referenced break-glass modes are bounded to 24 hours, default-deny
  sensitive fields, and revocable. `/api/platform` accepts only the separate platform
  session contract; principal/session issuance is intentionally out-of-band and the
  support evaluator is a fail-closed decision/audit boundary, not an automatic customer
  data proxy. Domain/API tests cover tenant-cookie rejection, CSRF, expiry, revoke,
  cross-tenant and sensitive-field denial. The complete 151-file Vitest set passes in
  three resource-safe shards: 606 passed, one expected skip, zero failures.

- **TASK-168 — Done:** permission-aware shell navigation, global search, quick actions,
  module state, employee workspace behavior and the role matrix are verified against
  active-company capabilities. The authoritative Manager template and Demo v15 pack now
  use company scopes for generic sales/CRM/inventory/warehouse/project/service collections
  whose rows do not carry actor ownership. Actor-derived My Work and Team Calendar APIs
  continue to enforce direct/granted-tree boundaries. The complete 149-file Vitest set
  passes in three resource-safe shards: 599 passed, one expected skip, zero failures.

## Next dependency-ordered execution slices

These are implementation slices, not new task records. They preserve the task index
statuses above and keep each change independently testable:

1. **TASK-173-A1 — Done (2026-08-10):** direct Sales Order and Purchase Order
   approve/reject actions now require their dedicated registered approval permission and
   the domain commands require an active tenant actor plus the pending order/approval
   workflow state. Adversarial tests prove permission removal leaves both rows unchanged.
2. **TASK-173-A2 — Done (2026-08-10):** Purchase
   Requisition approve/reject now routes through `purchasing.approve` plus the current
   locked `submitted` state; Sales Commission run approval now routes through
   `sales.commission.approve` plus the current locked `draft` state; allowance approval
   now re-checks `expenses.allowance.manage` before its locked `calculated → approved`
   transition; budget approval now re-checks `finance.budget.approve` before its draft
   activation transition. The HR workflow now requires the current step authority and
   passes resolved resource/module/scope/policy context into the central evaluator; no
   implicit in-flight migration or takeover is allowed. Focused strict-step coverage
   passes 18/18.
3. **TASK-174-A — Done:** unknown business-module keys now fail closed, payroll
   is part of the registered module set, and authenticated `account/*` services are
   explicitly non-module-gated while retaining permission checks. Resource/action/
   ownership denial and the access-matrix CI/browser assertions are verified.
4. **TASK-174-B — Done:** migration 0088 and atomic bump paths are implemented;
   Master-wide support changes advance all Company markers, stale browser snapshots
   fail closed and direct-URL revocation is proven after session refresh.
5. **TASK-175 — Done:** migration 0089 replaces
   the tenant `is_superadmin` bypass with an immutable Company Owner role, 112 explicit
   tenant permission rows and company scope. Legacy flags/assignments are made inert or
   backfilled idempotently; last-owner recovery and platform isolation remain covered.
  Disposable PostgreSQL 16 parity, true concurrency and RLS proof are green. The
  production backup, migration, RLS re-application, application release and public
  health/session verification completed on 2026-08-10. No physical-device acceptance
  is implied.
6. **RELEASE-I18N-001 — Done.**
   Missing local-pack keys and hardcoded/dynamic system-authored UI text were resolved;
   `node scripts/audit-i18n.mjs` passes 1,533 canonical keys / 69 local packs; the
   full matrix now passes 128 routes × 5 languages × 2 viewports. This remains an
   execution slice, not a new machine-readable task record, and is independent of
   TASK-173–175.
7. **RELEASE-SMOKE-001 — Done.** `npm run smoke` passes at desktop and mobile after
   the assertion was scoped to visible semantic badges; hidden zero-count badges remain
   in the DOM for stable accessibility behavior.

## Blocker

- **TASK-017:** physical-phone PWA verification. Automated desktop and emulated 375 px
  checks do not satisfy the real-device acceptance criterion.

See [ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md) for the current
implementation boundary and migration dependencies, and [EPICS.md](EPICS.md) for epic
acceptance criteria.
