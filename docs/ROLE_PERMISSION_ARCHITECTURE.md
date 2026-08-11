# ERP Role & Permission Architecture

Status: **Current implementation plus remaining target architecture; TASK-170–175 are
delivered and target production migration/release verification is complete**
Reviewed: **2026-08-11**
Scope: platform authorization, tenant/company roles, permissions, data scope,
approval authority, support access and audit
Target scale: one-person company to 10,000+ employees

This document separates the architecture the product is moving toward from the
authorization behavior that exists in the current code. Code remains the source of
truth until the migration tasks in EPIC-062 are complete.

## 1. Security hierarchy and terminology

The product must not use “tenant” and “company” as synonyms:

```text
ERP Platform
├── Platform Principal
└── Tenant / Master                         security and customer boundary
    ├── Legal Entity / Company              country, currency and tax boundary
    ├── Human User
    │   └── Employee link per company       optional employment identity
    └── Service Principal                   future non-human integration identity
```

- `master_fn` identifies the customer tenant or group.
- `company_fn` identifies one legal entity inside that tenant.
- A user belongs to one master and may be a member of multiple companies.
- Platform principals are not tenant employees and must not be stored as ordinary
  company roles.
- Job position and reporting relationships are organization facts, not permissions.

## 2. Target authorization question

Every protected operation must answer:

> Can this principal perform `ACTION` on this `RESOURCE`, in this `TENANT` and legal
> entity, through an active `ROLE ASSIGNMENT`, inside its `SCOPE`, under all applicable
> `POLICIES`?

The target API is one centralized decision service:

```ts
authorize({
  principal,
  tenant,
  company,
  permission: 'purchase.order.approve',
  resource,
  context: { amount: '18000.00', currency: 'SGD' },
})
```

Its internal result is structured and explainable:

```json
{
  "allowed": false,
  "reason": "APPROVAL_LIMIT_EXCEEDED",
  "permission": "purchase.order.approve",
  "assignmentId": 42,
  "scope": "department:purchase",
  "policyVersionId": 8
}
```

Ordinary API clients receive only a safe reason code. Full explanations are available
only through a separately permissioned and audited administrator diagnostic endpoint.

## 3. Current implementation — source-of-truth boundary

The current code already implements:

- `master -> company -> user` tenant membership and active-company sessions;
- multiple roles per user/company through `user_company_role`;
- allow-union role permissions;
- `self`, `team`, `department` and `company` resource scopes;
- company-level module activation;
- backend permission, scope and tenant checks on current Canonical APIs;
- production tenant transactions and forced-RLS coverage for registered business tables;
- append-only API audit events;
- versioned approval policies, snapshotted workflow instances, ambiguity rejection,
  self-approval prevention and bounded delegation.
- a separate platform principal/role/session domain and a bounded support-grant control
  plane (TASK-170), with platform-only bearer/CSRF credentials and no tenant-role path;
- master/optional-company support targets, 24-hour maximum grants, read-only or explicit
  restricted-write/break-glass modes, default sensitive-field denial, and audited grant
  lifecycle/decision events.
- an application-owned permission registry (TASK-171) with 299 static definitions:
  157 tenant compatibility entries and 142 canonical entries, including a distinct
  platform permission domain;
- exact canonical route projections registered for 116 resources, 62 actions and 5
  update contracts. Ordinary role evaluation and approval authority resolution use
  explicit compatibility candidates and reject unknown requests; platform-domain
  tenant requests are rejected before tenant-role evaluation;
- role editing/template cloning, leave approval configuration and expense extra-approval
  configuration reject unregistered tenant permission codes, and
  `npm run check:permissions` audits source literals, templates, routes and actions.
- stable assignment identity and assignment lifecycle (TASK-172):
  `user_company_role.assignment_id` is the primary key; validity is the half-open
  `[valid_from, valid_until)` window, `revoked_at` stops access immediately, and
  assignment/revocation provenance is stored and exposed to admin reads;
- assignment-owned scope rows in `user_company_role_scope`, with validated current
  target types (`none`, `company`, `department`, `team`, `employee`). A reusable role
  can therefore be attached to multiple independent assignments and target rows.
- the centralized tenant decision service in `src/auth/authorization.ts`:
  `authorize`, `authorizeWithin` and `hasAnyAuthorization` validate active membership,
  registered tenant permissions, active assignments, explicit overrides and explicit
  role-permission rows before returning ALLOW/DENY;
- migration 0087 adds reasoned, time-bounded `user_permission_override` rows. Explicit
  `deny` wins over every matching allow, explicit `allow` is evaluated before role
  grants, revoked/expired rows are ignored, and resource/department targets do not
  widen unrelated requests;
- public callers receive only `{ allowed, reasonCode }`. A privileged administrator
  may call `/api/admin/authorization/explain` with audit-read permission (including a
  tenant member subject) to receive full assignment/role/override details; every such
  explanation is appended to the audit log. Override creation and revocation are also
  reasoned and audited;
- `hasPermission`, action dispatch, resource permission gates and approval permission
  checks now use the centralized evaluator. Effective-capability snapshots include
  active override effects conservatively for UX, while the backend decision remains
  authoritative.
- On 2026-08-10 the target Compose database was backed up before migration 0089;
  migrations 0084–0089 were applied, production RLS was re-applied and
  `deploy/release.sh` completed through the existing Cloudflare tunnel. Verification
  found 90 migration entries, 219 forced-RLS tenant tables/policies, one company-scoped
  Company Owner role, zero active legacy Superadmin flags/assignments, healthy services,
  public `/health` 200 and unauthenticated session 401.

The following current behaviors are compatibility facts, not new authorization grants:

- Migration `0089_company_owner_cutover.sql` converts legacy `is_superadmin` assignments
  to company-scoped `Company Owner` assignments, seeds 112 registered tenant
  permissions plus `* -> company` scope, and makes the old role flag inert. A database
  that has not applied 0089 must not receive the cutover application release.
- `role_resource_scope` remains a compatibility fallback only for assignments whose
  `scope_backfilled_at` is null; assignment-owned scope rows are preferred once the
  assignment is marked backfilled.
- Existing role data still stores broad compatibility keys alongside canonical projections;
  the registry maps them explicitly but the expand-phase data migration and runtime
  compatibility telemetry are not complete.
- `role_permission.allowed=false` is a disabled grant, not an explicit deny that wins
  over another role's allow. Explicit deny semantics live in
  `user_permission_override` until a later role/assignment-level data migration.
- Explicit overrides are currently user-level, tenant/company-bounded exceptions. The
  service supports `self/team/department/company` and `none/company/department/team/
  employee` targets; branch, region, business-unit and other enterprise targets remain
  schema-reserved but are not yet assignable through the API.
- Approval permission checks now call the centralized evaluator, and the shared
  versioned workflow still locks the active instance/step, prevents self-approval and
  checks delegation. Direct Sales Order and Purchase Order approve/reject decisions
  now require the registered `sales.approve` or `purchasing.approve` permission through
  `authorizeWithin`, while the locked pending order/approval rows remain the active
  legacy workflow authority. Purchase Requisition approve/reject decisions now also
  require `purchasing.approve` through `authorizeWithin`; that legacy path has no
  `approval_instance`/`approval_step`, so the locked `submitted` row is its current
  workflow authority. HR leave and expense approval decisions now require the locked
  current step authority and pass resolved resource/module/scope context plus policy-
  version, approval-instance and approval-step identifiers into the central evaluator.
  The active step must belong to the instance policy snapshot, and named direct
  authorities must still be active employees. A broad HR permission cannot take over a
  manager-owned step; older in-flight instances keep their snapshotted authority with
  no implicit migration. Delegation is still bounded by tenant/domain/authority/
  delegate/time/revocation rather than instance/step/resource/policy.
  Sales Commission run approval now also requires `sales.commission.approve` through
  `authorizeWithin`; that legacy path has no `approval_instance`/`approval_step`, so
  the locked `draft` run/version snapshot is its current workflow authority. The
  allowance calculation approval now re-checks `expenses.allowance.manage` before its
  locked `calculated` transition, and budget approval now re-checks
  `finance.budget.approve` before its draft/active/version/line transition. Neither
  path has a generic `approval_instance`/`approval_step`; the existing legacy state is
  authoritative. The remaining approval-architecture gaps are deeper delegation
  binding and any future approval domain that has not yet been registered with context.
- Unknown module keys now fail the module gate; payroll is included in the registered
  module set. Registered resources still require their permission checks. Migration
  0088 provides the company authorization-version marker, and current core writers
  bump it atomically; no centralized authorization-version cache is claimed yet.
- Employee-workspace impersonation is company-bounded and audited, but it is not a
  platform support-access grant.
- Platform principal and session issuance is intentionally out-of-band; there is no
  tenant-login route that creates platform sessions. Support evaluation returns a safe
  allow/deny decision and does not itself authorize arbitrary business-data queries.

No document may describe the target items below as implemented before its task and
tests are complete.

## 4. Target role and assignment model

A role is a reusable permission bundle. Organizational scope and validity belong to
the assignment:

```text
role
----
id
tenant_id nullable only for immutable platform templates
company_id nullable according to role ownership rules
code
name
is_system_template
status

role_permission
---------------
role_id
permission_id

role_assignment
---------------
id
tenant_id
company_id
principal_id
role_id
valid_from
valid_until
assigned_by
reason
status

role_assignment_scope
---------------------
assignment_id
resource_pattern
scope_type
scope_target_id
effect
```

One assignment may carry one or more bounded scope targets. For example, the reusable
`SALES_MANAGER` role can be assigned to Singapore Branch for one employee and Johor
Branch for another without duplicating the role.

Direct user overrides are exceptional, reasoned and time-bounded. They must not become
the ordinary administration model.

## 5. Permission registry

The canonical naming convention is:

```text
module.resource.action
```

Examples:

```text
sales.order.view
sales.order.create
sales.order.approve
inventory.stock.adjust
finance.payment.release
hr.salary.view
system.role.assign
```

Permission codes are immutable implementation identifiers owned by the application.
Tenants may create roles, but may not invent permission codes. Every protected route,
command and resource action must map to a registered permission, and CI must reject an
unknown or unmapped permission. Broad compatibility keys such as `sales.write` require
an explicit migration and removal date; they must not permanently override finer keys.

### TASK-171 implementation boundary

The current application registry is split into two layers:

- `src/auth/permissionKeys.ts` owns the dependency-free tenant compatibility constants;
- `src/auth/permissionRegistry.ts` owns canonical definitions, compatibility mappings,
  telemetry keys, removal-gate metadata and the separate platform domain;
- `src/api/resources.ts` registers canonical route projections only from the application
  resource allowlist, and `src/api/actions.ts` exposes action metadata for the CI audit;
- `src/auth/permissions.ts` resolves canonical requests to explicit stored-key candidates,
  so existing broad grants continue to work during expand without accepting arbitrary
  strings. Unknown candidates return no grant.

`npm run check:permissions` currently verifies 299 static registry definitions, 116
resource contracts, 62 action contracts and 5 update contracts. TASK-172 added the
assignment migration, dual-read scope path, active-assignment predicate and assignment
API. TASK-173 now adds the central decision service, user-level explicit overrides,
safe/audited explanations and strict current-step approval context for the generic leave
and expense domains. The access matrix and authenticated/browser checks are a partial
cross-layer regression contract. Unknown business-module keys now fail closed;
 authenticated `account/*` service routes are explicitly non-module-gated but remain
 tenant/session and permission guarded. Authorization-version invalidation and deeper
delegation binding remain TASK-174 work; the Company Owner cutover is delivered by
migration 0089. Disposable PostgreSQL 16 parity, true concurrency and non-superuser
RLS/security proof are green; target-database migration, production RLS re-application
and application release verification are complete.

## 6. Scope and resource ownership

Supported target scope types are introduced in phases:

```text
Implemented assignment target validation: none, company, department, team, employee
Phase 2: branch, business_unit
Phase 3: region, legal_entity, cost_center, all
```

Each scoped resource must declare its authoritative ownership attributes. The server,
not the client, resolves them. A resource must state whether access follows:

- immutable document owner/department snapshots;
- current organization hierarchy;
- an effective-dated hierarchy at the business event date; or
- explicit project, cost-center, branch or legal-entity ownership.

If ownership cannot be resolved for a restricted permission, access is denied.

## 7. Deterministic evaluation order

The target authorization order is deny-by-default and follows this order:

1. Authenticate and resolve the principal.
2. Resolve tenant and active legal entity from server-side session state.
3. Validate active tenant/company membership.
4. Validate that the module is enabled and the permission/resource/action is registered.
5. Load active role assignments (`valid_from <= now`, `valid_until > now` or null,
   `revoked_at is null`) and role permissions.
6. Keep assignment-owned scope rows whose target contains the resource; for an
   unbackfilled assignment, dual-read the legacy role-level scope.
7. Apply scoped explicit denies, temporary restrictions and sensitive-data controls.
8. Evaluate ABAC conditions and separation-of-duties rules.
9. For approval actions, also validate the active workflow step and snapshotted authority.
10. Reject missing or equally ranked policies rather than guessing.
11. Audit the decision where the permission or resource is sensitive.
12. Return ALLOW or DENY with a safe reason code.

The current centralized evaluator implements this subset in this order:

1. Validate principal shape and active master/company membership.
2. Reject platform-domain keys and unregistered permission keys.
3. Load active user overrides; matching explicit `deny` wins over matching `allow`.
4. Resolve active role assignments and registered role-permission candidates.
5. Treat the legacy `is_superadmin` flag as inert; no implicit Superadmin grant is
   evaluated. Company Owner access is resolved through its explicit role rows.
6. When requested, match assignment-owned scope rows and the legacy dual-read scope.
7. Direct Sales/Purchasing order decisions additionally require their dedicated
   registered approval permission; the domain command then locks and validates the
   pending order and approval rows before mutation.
8. Purchase Requisition decisions additionally require `purchasing.approve`; the
   domain command then locks and validates the tenant-scoped requisition remains
   `submitted` before mutation. This is the current legacy workflow authority, not a
   claim that a generic approval instance/step exists for requisitions.
9. Sales Commission run decisions additionally require `sales.commission.approve`; the
   domain command then locks and validates the tenant-scoped run remains `draft` before
   mutation. Its versioned header snapshot is the current legacy workflow authority,
   not a generic approval instance/step.
10. Return a safe reason code; full diagnostic fields are available only through the
   audited administrator explanation path.

Module/resource/action validation, ABAC policy evaluation, complete authorization-
version invalidation and complete approval-policy enforcement remain later work. A
`role_permission.allowed=false` row still cannot be represented as an explicit deny.

## 8. Platform administration and support access

Platform authorization is separate from tenant authorization:

```text
platform.tenant.view
platform.tenant.manage
platform.health.view
platform.feature.manage
platform.support.grant
```

A platform operator receives no permanent customer-business-data access. Support
access, if enabled, requires a dedicated grant with:

- tenant and optionally company target;
- engineer/platform principal;
- mandatory reason and ticket/reference;
- `read_only`, `restricted_write` or break-glass mode;
- `valid_from` and `valid_until`;
- sensitive-field restrictions;
- customer approval when policy requires it;
- explicit revocation and complete audit.

The existing Company Owner employee-workspace entry does not satisfy this contract and
must not be advertised as platform support access.

## 9. Company Owner and separation of duties

`COMPANY_OWNER` is a tenant/company role with an explicit permission bundle. It is not
a platform principal and must not become a hidden `bypassAuthorization` path.

The current cutover is implemented by `source_template_key = 'company_owner'` and
`is_superadmin = false`. Migration `0089_company_owner_cutover.sql` creates one
company-scoped Owner role per existing company, backfills its 112 registered tenant
permissions and `* -> company` scope, moves legacy assignments while preserving their
validity/provenance, and leaves historical Superadmin rows inert for audit/rollback
inspection. `src/auth/authorization.ts` has no Superadmin bypass branch; an Owner
decision is explainable as an ordinary role-permission match. The Owner template is
immutable through role administration and cannot receive platform permission codes.

The default Owner bundle intentionally excludes approval/pay/payment, payroll, payout
and sensitive tax-evidence permissions. A one-person company can add a separate,
audited business role or temporary exception when it genuinely needs that authority;
Company Owner status alone is not an approval policy.

System/security administration does not automatically grant payment approval, payroll
view, self-expense approval or audit deletion. Business authority does not automatically
grant role administration or platform configuration. Maker/checker and creator/
approver separation remain explicit policy rules. If a one-person company needs a
solo exception, the exception must be configured, limited and audited rather than
silently weakening every tenant.

## 10. Approval authorization

The existing versioned approval subsystem is the baseline and must not be replaced by
a mutable two-table approximation. Approval requires all of:

```text
domain approval permission
AND resource scope
AND active snapshotted workflow step authority
AND policy conditions
AND separation-of-duties rules
```

Confirmed policy versions are immutable. Workflow instances snapshot resolved steps.
Delegation is time-bounded. Original authority and decisions remain audit facts.
Missing or ambiguous matching policies fail closed.

## 11. Modules, frontend and backend enforcement

Module subscription/activation answers whether a company owns or has enabled a module.
Permission answers who may use it. Scope and policy answer which records and under what
conditions. All layers are enforced by the backend. Frontend navigation, search,
buttons and sensitive-field hiding are UX projections only.

Unknown module, resource, action, permission, ownership mapping or policy state must
fail closed in the target architecture. Direct URL/API requests remain authoritative
tests even when the UI correctly hides an action.

## 12. Audit, cache and lifecycle requirements

Sensitive events include role/permission/scope changes, assignment expiry, support
access, impersonation, approval-policy changes, sensitive reads/exports and break-glass
use. Audit retention, read/export permission and database write restrictions must be
documented per deployment.

Authorization snapshots use the tenant/company `authorization_version` introduced by
migration 0088. Core role, assignment, scope, module, override and invitation mutations
advance it, and Master-wide support grant changes advance every Company under the
Master. Session/capability projections expose the current value. The API adapter sends
its last value on every authenticated request; mismatch returns fail-closed 409, permits
recovery only through `/api/auth/session` and reloads without replaying a rejected write.
Server permission, organization-scope and workflow-policy decisions are deliberately
uncached and query current rows, so they do not depend on a version bump for revocation.

Role deletion, template upgrade, last-owner recovery, assignment expiry and user
offboarding must have deterministic lifecycle behavior and tests.

## 13. Delivery phases

### Current implemented foundation

- Tenant/company isolation and active-company sessions
- Multiple roles and allow-union permissions
- Assignment-owned self/team/department/company scopes, with legacy role-level fallback
  only for unbackfilled assignments
- Company module activation
- Backend checks, audit and production RLS
- Versioned approval governance
- Company authorization-version source, atomic authorization-graph bump paths,
  Master-wide support invalidation and stale browser snapshot recovery

### EPIC-062 — required authorization migration

- TASK-169: current/target architecture and documentation alignment — done
- TASK-170: platform principal and time-bounded support-access domain — done; migration
  0084/0085 and domain/API adversarial tests are green
- TASK-171: canonical permission registry and compatibility-key migration — done;
  application registry/route CI and compatibility aliases are in place
- TASK-172: assignment-scoped grants, scope targets and expiry — done; migration 0086,
  assignment service/API, active predicate and role-scope dual-read are implemented
- TASK-173: centralized decision service, explicit deny semantics and safe explanation
  — done; migration 0087, central evaluator, override lifecycle, safe reason contract,
  audited diagnostic endpoint and strict current-step/resource/module/policy context are
  implemented for the generic leave/expense approval domains
- TASK-174: fail-closed module/resource registration and authorization-version invalidation
  — done; unknown module/resource/action/ownership state denies, the access-matrix gate
  covers registered routes, Master-wide support changes bump every Company marker and
  stale browser snapshots fail closed before refreshed direct-URL authorization.
- TASK-175: migrate tenant Superadmin bypass to explicit Company Owner permissions —
  done in `0089_company_owner_cutover.sql`; disposable PostgreSQL 16
  parity/concurrency and non-superuser RLS proof are green. The production backup,
  target migration, RLS re-application, application release and public health/session
  verification are complete.

Branch/business-unit/region target validation, enterprise access reviews, SSO/
provisioning and advanced SoD follow only after TASK-173–175.

## 14. Definition of done

The target architecture is implemented only when:

- one-person onboarding works without manual permission configuration;
- platform and tenant principals cannot cross authority domains;
- Company Owner has explicit, testable permissions rather than a bypass; the local
  cutover suite covers explanation, scope, platform/approval denial, legacy-role
  inertness, immutable role configuration and migration idempotence;
- multiple roles and assignment-specific scopes/expiry work together;
- every backend operation maps to a registered canonical permission;
- unknown, missing, cross-tenant and stale authorization state fails closed;
- approval permission cannot bypass active workflow authority or SoD;
- support access is reasoned, time-bounded, restricted, revocable and audited;
- effective decisions can be safely explained;
- backend immediate revocation is proven through current-state evaluation, and stale
  browser capability snapshots fail closed and recover without replay;
- adversarial tests cover cross-tenant IDs, disabled modules, conflicting grants,
  expiry boundaries, stale sessions, self-approval and support access.

## 15. Cross-layer permission regression matrix

`src/auth/accessMatrix.ts` is the shared contract for canonical ERP routes. Each
entry connects the expected module/permission boundary to its API list probe and,
when a record is available, its detail/drill-in probe. This keeps navigation
visibility, direct API access and record drill-in behavior aligned instead of
maintaining separate route lists in the UI and tests.

Run the checks with:

```bash
npx vitest run src/api/permissionMatrix.integration.test.ts
npm run audit:access-matrix
```

The integration suite checks authenticated role fixtures, 401/403 behavior, list
responses and detail responses. The browser audit loads the built demo shell,
checks all canonical screen metadata, evaluates every route against the role
templates, and fails closed on unmapped or accidentally public routes. The browser
audit does not write application data; records without demo seed data are checked
for drill-in consistency when a row exists.

## 14. Planned Expenses & Tax authorization contract

EPIC-063 requires capabilities equivalent to create, read own, read company, update
own draft, update company, export/print and void/manage Company Receipts. Exact
canonical identifiers must follow the application registry and be added atomically
with the module key, backend resource/actions, route metadata and `ACCESS_MATRIX`;
hardcoded checks such as `role === 'Company Owner'` are forbidden.

Contributor access defaults to create/read-own/update-own-draft. Finance or an
explicit Receipt Manager may receive company read/update/export/print. Company Owner
has only its registered assigned capabilities, and platform Superadmin/support remains
outside tenant business authority. TASK-177 cannot start until TASK-174 closes the
remaining stale-authorization boundary; none of these receipt capabilities exists yet.

## 16. Planned platform-owned Module Access Control (EPIC-064)

Current Company Owner authority is explicit rather than a hidden bypass, but its
`admin.modules.manage` grant still lets the tenant change `company_module`. That is
current source truth and will remain until TASK-185/186; it is not the approved product
ownership model.

Target evaluation order:

1. authenticate either a tenant target user or an independent platform principal;
2. derive/validate Master and Company from server-owned context;
3. require Master commercial entitlement;
4. require Company allocation;
5. require registered tenant permission;
6. enforce assignment scope/ownership;
7. enforce locked workflow/business authority.

The commercial Module Catalog is application-owned. Tenant roles cannot create,
assign or evaluate `platform.modules.*`. `admin.modules.manage` is removed from Company
Owner, Company Admin, custom role grants and the assignable registry. Only the
application-owned `platform_superadmin` receives `platform.modules.read/manage`; current
support roles remain separate.

Platform user simulation is not a role assignment or permission union. It binds an
independent platform session to one active tenant user and exact Master/Company for at
most one hour. Every tenant decision uses the target user's roles, overrides, scopes,
module availability and workflow authority. Both identities are audited, and the
platform-only MAC API remains unreachable from the simulated tenant context.

TASK-174 has closed cache/direct-URL coverage, so TASK-185 is eligible. TASK-186 removes tenant
surfaces and becomes TASK-182's entitlement dependency; TASK-187 adds platform login,
workspace and simulation; TASK-188 owns final adversarial proof. Until then EPIC-018's
tenant API/UI remains current, while EPIC-064 remains approved target only.
