# Task Index

Reviewed: **2026-08-10**

The machine-readable task source of truth is
[`../tasks/tasks.jsonl`](../tasks/tasks.jsonl). This file is a human-readable index,
not a second task registry.

## Current totals

- Done: **171**
- In progress: **1**
- Todo: **2**
- Blocked: **1**
- Total: **175**

## Current release-quality note

This is a working-tree regression, not a new task record or a change to the totals:
`npm run audit:screens` renders all 128 routes and passes the 128 Canonical / 0 Preview
maturity contract, but currently fails 17 layout/behavior assertions across active
subnav visibility, HR Calendar detail ordering, Leave Approval's pending action and
My Work's employee tab count. It must be assigned and fixed before a release is called
green; TASK-017 remains the separate physical-device blocker.

## Current authorization programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-169 | Done | Align architecture and documentation with current authorization code |
| TASK-170 | Done | Separate platform principals and time-bounded support access |
| TASK-171 | Done | Canonical permission registry and compatibility-key migration |
| TASK-172 | Done | Assignment-scoped grants, targets and expiry |
| TASK-173 | In progress | Central authorization decision, explicit deny and safe explanation |
| TASK-174 | Todo | Fail-closed module/resource registry and authorization versioning |
| TASK-175 | Todo | Replace tenant Superadmin bypass with explicit Company Owner permissions |

## Latest completed task

- **TASK-172 — Done:** migration `0086_youthful_mac_gargan.sql` adds the stable
  `user_company_role.assignment_id` primary key, `[valid_from, valid_until)` validity,
  assignment/revocation provenance and `user_company_role_scope`. The role-assignment
  service/API supports multiple independently scoped assignments and validated
  `none/company/department/team/employee` targets; permission, approval, setup and
  impersonation checks share the active-assignment predicate. Existing
  `role_resource_scope` rows remain a dual-read fallback for assignments whose
  `scope_backfilled_at` is null. Expired and revoked assignments are denied immediately;
  the TASK-173 central decision boundary is now partially implemented in migration
  0087; authorization-version caching and Company Owner cutover remain TASK-174–175.

## Current in-progress task

- **TASK-173 — In progress:** `src/auth/authorization.ts` now provides the central
  tenant decision contract and boolean compatibility wrappers. Migration 0087 adds
  reasoned user-level `user_permission_override` rows with validity, revocation,
  resource/department targeting and explicit deny precedence. Action/resource gates,
  approval permission checks and effective-capability snapshots use the central
  evaluator. `/api/admin/authorization/explain` is restricted to audit-read users and
  writes an audit event; override create/revoke operations are also audited.
  Focused authorization, API explanation, RBAC, role-assignment, resource, approval,
  lint, typecheck, permission-registry, schema/drift and Demo build gates pass.
  Remaining before Done: strict permission-plus-active-workflow-authority behavior for
  every approval-like legacy path (including direct Sales/Purchasing decisions,
  requisition/commission/allowance/budget commands and the HR compatibility escalation)
  and broader resource/module/policy context. The full current regression run is green:
  154 files passed + 1 skipped file (155 total), 623 tests passed + 1 intentional skip
  (624 test slots), zero failures.

- **TASK-171 — Done:** `src/auth/permissionRegistry.ts` is now the application-owned
  registry. It contains 299 static definitions (157 compatibility entries and 142
  canonical entries, including a separate platform-support domain); the resource
  registry projects exact canonical permissions for 116 resources and 62 actions,
  including 5 update contracts. Ordinary role evaluation and approval authority
  resolution use explicit registry candidates and fail closed for unknown keys;
  platform-domain keys are rejected before the current tenant Superadmin bypass.
  Role editing/template cloning, leave approval configuration and expense extra-
  approval configuration reject unregistered tenant permissions. Existing broad
  `role_permission` text keys remain compatible through explicit mapping metadata;
  TASK-172 owns the assignment migration; TASK-173 now owns the central decision and
  explicit-override boundary, while authorization-versioning and Company Owner cutover
  remain pending.
  `npm run check:permissions` is the CI gate for source literals, role templates,
  resource/action contracts and compatibility metadata. The complete 152-file Vitest
  regression baseline passes in three resource-safe shards: 610 tests passed, one
  intentional skip and zero failures before TASK-172 added its four assignment/seed
  regression cases. The current full-suite run is green at 154 files passed + 1 skipped
  file (155 total): 623 tests passed + 1 intentional skip, zero failures (624 test slots).

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

1. **TASK-173-A — approval authority unification:** route every legacy approval-like
   decision through a domain-permission check plus active workflow-step authority;
   preserve the existing HR takeover behavior only as an explicit, audited compatibility
   policy until its replacement is implemented. Add adversarial tests for direct Sales,
   Purchasing, requisition, commission, allowance and budget decisions.
2. **TASK-173-B — decision-context completion:** register the remaining ownership,
   module and policy context consumed by authorization, and prove that missing context
   denies without changing the current assignment/Superadmin compatibility boundary.
3. **TASK-174-A — fail-closed registration:** reject unknown module/resource/action and
   ownership mappings; make the access matrix a CI/startup coverage gate rather than only
   a regression helper.
4. **TASK-174-B — authorization versioning:** invalidate cached/session capability state
   on role, assignment, scope, organization, module, policy and support-grant changes;
   add stale-version/direct-URL revocation tests.
5. **TASK-175 — Company Owner cutover:** replace the tenant `is_superadmin` bypass with
   explicit registered permissions, retaining last-owner recovery and platform isolation.

## Blocker

- **TASK-017:** physical-phone PWA verification. Automated desktop and emulated 375 px
  checks do not satisfy the real-device acceptance criterion.

See [ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md) for the current
implementation boundary and migration dependencies, and [EPICS.md](EPICS.md) for epic
acceptance criteria.
