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

The 2026-08-10 screen follow-up is complete: `npm run audit:screens` renders all 128
routes at desktop/mobile and passes the 128 Canonical / 0 Preview maturity plus
layout/behavior contracts. The i18n release gate is also complete: the static audit
passes 1,531 canonical keys / 69 local five-language packs and the full
`npm run audit:i18n` matrix passes 128 routes × 5 languages × 2 viewports with zero
blocking findings. TASK-017 remains the separate physical-device blocker; it does not
change the machine-readable task totals. The current post-build `npm run smoke` still
fails its navigation contract because 18 unexplained numeric `0` badges are visible in
both desktop and mobile runs.

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
  `TASK-173-A1` is now delivered for direct Sales Order and Purchase Order approve/
  reject decisions: the action dispatcher requires `sales.approve` or
  `purchasing.approve`, and each domain command calls `authorizeWithin` before changing
  the tenant-scoped order plus its still-pending approval row. The focused order,
  authorization and API contract suites pass 20/20 tests, with lint, typecheck and
  `npm run check:permissions` also green. `TASK-173-A2-R1` is now delivered for
  Purchase Requisition approve/reject decisions: both actions require
  `purchasing.approve`, and the domain command validates the active tenant actor and
  central authorization before locking and changing the existing submitted-state row.
  This legacy requisition path has no `approval_instance`/`approval_step`; its locked
  `submitted` state is the currently implemented workflow authority. The requisition
  suite passes 9/9 and the combined purchasing/sales/authorization regression passes
  29/29. `TASK-173-A2-R2` is now delivered for Sales Commission run approvals: the
  existing `sales.commission.approve` action permission is enforced again in the domain
  command before locking the draft run, whose existing `draft` state/version snapshot
  remains the legacy workflow authority. This path also has no generic
  `approval_instance`/`approval_step`; its commission suite passes 5/5 and the combined
  commission/authorization/API regression passes 15/15.
  `TASK-173-A2-R3` is now delivered for allowance calculation approvals: the domain
  command re-checks `expenses.allowance.manage` before changing a locked `calculated`
  row. The allowance calculation status remains the legacy workflow authority and this
  path has no generic `approval_instance`/`approval_step`; the allowance/API/auth
  regression passes 12/12. `TASK-173-A2-R4` is now delivered for budget approvals: the
  domain command re-checks `finance.budget.approve` before changing a draft budget. Its
  existing draft/approved status, active flag, version and imported lines remain the
  legacy workflow authority, with direct-domain denial mapped to HTTP 403; the
  budget/finance/API/auth regression passes 18/18.
  Focused authorization, API explanation, RBAC, role-assignment, resource, approval,
  lint, typecheck, permission-registry, schema/drift and Demo build gates pass.
  Remaining before Done: strict permission-plus-current-workflow-authority behavior for
  replacement of the explicit, audited HR compatibility escalation, plus broader
  resource/module/policy context. The current HR management path passes the
  compatibility override only when the workflow domain re-checks `hr.write`; its
  `approval_decision` keeps the original authority and `authoritySource`, and the
  focused leave-approval/application regression passes 17/17. The previously recorded
  full regression baseline remains 154 files passed + 1 skipped file (155 total),
  623 tests passed + 1 intentional skip (624 test slots), zero failures; the latest
  A2-R1 through A2-R4 slices have the focused evidence above and have not yet been
  added to a new full suite run.

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
  regression cases. The latest full attempt reached 153 passed files + 1 skipped file
  and one stale Demo showcase-pack permission assertion; the corrected Manager fixture
  now passes its showcase test 1/1, while a clean full rerun remains pending.

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
2. **TASK-173-A2 — approval authority unification (in progress; R1–R4 done):** Purchase
   Requisition approve/reject now routes through `purchasing.approve` plus the current
   locked `submitted` state; Sales Commission run approval now routes through
   `sales.commission.approve` plus the current locked `draft` state; allowance approval
   now re-checks `expenses.allowance.manage` before its locked `calculated → approved`
   transition; budget approval now re-checks `finance.budget.approve` before its draft
   activation transition. The existing HR management takeover is now explicitly
   audited compatibility behavior: only the management path supplies
   `overridePermissionKey: 'hr.write'`, the workflow domain re-checks that permission
   before covering an active step, and the decision keeps the original authority.
   Replace that compatibility policy with strict current-step authority when the
   broader workflow decision is implemented.
3. **TASK-173-B — decision-context completion:** register the remaining ownership,
   module and policy context consumed by authorization, and prove that missing context
   denies without changing the current assignment/Superadmin compatibility boundary.
4. **TASK-174-A — fail-closed registration:** reject unknown module/resource/action and
   ownership mappings; make the access matrix a CI/startup coverage gate rather than only
   a regression helper.
5. **TASK-174-B — authorization versioning:** invalidate cached/session capability state
   on role, assignment, scope, organization, module, policy and support-grant changes;
   add stale-version/direct-URL revocation tests.
6. **TASK-175 — Company Owner cutover:** replace the tenant `is_superadmin` bypass with
   explicit registered permissions, retaining last-owner recovery and platform isolation.
7. **RELEASE-I18N-001 — localization gate closure: Done in the current worktree.**
   Missing local-pack keys and hardcoded/dynamic system-authored UI text were resolved;
   `node scripts/audit-i18n.mjs` passes 1,531 canonical keys / 69 local packs and the
   full 128-route × 5-language × 2-viewport `npm run audit:i18n` matrix passes with
   zero blocking findings. This remains an execution slice, not a new machine-readable
   task record, and is independent of TASK-173–175.
8. **RELEASE-SMOKE-001 — navigation badge contract: Pending.** The 2026-08-10
   `npm run smoke` run renders the dashboard at desktop/mobile but fails on 18
   unexplained numeric `0` badges in each viewport. Either hide non-semantic zero
   badges or define their accessible/business meaning and update the smoke contract.

## Blocker

- **RELEASE-SMOKE-001:** current desktop/mobile smoke gate fails on unexplained numeric
  `0` navigation badges; the dashboard and transaction proof do not reach a clean
  release result until this contract is resolved.
- **TASK-017:** physical-phone PWA verification. Automated desktop and emulated 375 px
  checks do not satisfy the real-device acceptance criterion.

See [ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md) for the current
implementation boundary and migration dependencies, and [EPICS.md](EPICS.md) for epic
acceptance criteria.
