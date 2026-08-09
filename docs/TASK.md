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
both desktop and mobile runs. The purchase-requisition Web adapter has since been
aligned with the actor-input command shape; serial `build:demo` and
`audit:access-matrix` pass. The first parallel build attempt was a shared-output race,
not a source failure.

## Current authorization programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-169 | Done | Align architecture and documentation with current authorization code |
| TASK-170 | Done | Separate platform principals and time-bounded support access |
| TASK-171 | Done | Canonical permission registry and compatibility-key migration |
| TASK-172 | Done | Assignment-scoped grants, targets and expiry |
| TASK-173 | Done | Central authorization decision, explicit deny and safe explanation |
| TASK-174 | In progress | Fail-closed module/resource registry and authorization versioning |
| TASK-175 | Todo | Replace tenant Superadmin bypass with explicit Company Owner permissions |

## Latest completed task

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
  The latest full Vitest run completed with 622 passed, 8 failed and 1 skipped across
  155 files. The account-service module-gate omission is fixed and targeted
  notification/access-matrix/module coverage passes 15/15; two Team Calendar tests
  still use a Manager actor against the current seed's HR-permission leave policy and
  need fixture alignment. Instance/step/resource/policy-bound delegation remains a
  follow-up hardening item.
- **TASK-172 — Done:** migration `0086_youthful_mac_gargan.sql` adds the stable
  `user_company_role.assignment_id` primary key, `[valid_from, valid_until)` validity,
  assignment/revocation provenance and `user_company_role_scope`. The role-assignment
  service/API supports multiple independently scoped assignments and validated
  `none/company/department/team/employee` targets; permission, approval, setup and
  impersonation checks share the active-assignment predicate. Existing
  `role_resource_scope` rows remain a dual-read fallback for assignments whose
  `scope_backfilled_at` is null. Expired and revoked assignments are denied immediately;
  TASK-173 is complete in migration 0087. Migration 0088 now provides the company
  authorization-version source and first atomic bump paths; centralized cache
  invalidation and Company Owner cutover remain TASK-174–175.

## Current in-progress task

- **TASK-174 — In progress:** TASK-174-A treats unknown business-module keys as
  disabled at the backend gate, registers payroll and explicitly keeps authenticated
  `account/*` service routes outside business-module switching while retaining their
  route permissions. TASK-174-B now has migration 0088's company-scoped
  `authorization_version`; core role, assignment, scope, module, override and
  invitation mutations bump it atomically, and session/effective-capability
  projections expose it. The remaining slice is centralized cache invalidation,
  organization/policy/master-wide support coverage and stale-session/direct-URL
  regression tests. TASK-175 remains blocked on this boundary and will replace the
  tenant Superadmin compatibility bypass with an explicit Company Owner permission
  bundle.

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
  explicit-override boundary, while authorization-versioning is partially delivered by
  migration 0088 and Company Owner cutover remain pending.
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
3. **TASK-174-A — In progress:** unknown business-module keys now fail closed, payroll
   is part of the registered module set, and authenticated `account/*` services are
   explicitly non-module-gated while retaining permission checks. Resource/action
   coverage and startup/CI assertions are still required for every new module prefix.
4. **TASK-174-B — Authorization versioning:** migration 0088 and the first core bump
   paths are implemented; finish cached/session capability invalidation on organization,
   policy and master-wide support-grant changes, then add stale-version/direct-URL
   revocation tests.
5. **TASK-175 — Company Owner cutover:** replace the tenant `is_superadmin` bypass with
   explicit registered permissions, retaining last-owner recovery and platform isolation.
6. **RELEASE-I18N-001 — localization gate closure: Done in the current worktree.**
   Missing local-pack keys and hardcoded/dynamic system-authored UI text were resolved;
   `node scripts/audit-i18n.mjs` passes 1,531 canonical keys / 69 local packs and the
   full 128-route × 5-language × 2-viewport `npm run audit:i18n` matrix passes with
   zero blocking findings. This remains an execution slice, not a new machine-readable
   task record, and is independent of TASK-173–175.
7. **RELEASE-SMOKE-001 — navigation badge contract: Pending.** The 2026-08-10
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
