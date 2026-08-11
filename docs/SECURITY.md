# Security boundaries and accepted risks

This document records security controls that are implemented, controls that are
deliberately optional, and the residual risk accepted by the current product scope.
It is not a substitute for deployment-specific threat modelling or operating policy.

## Employee identity boundary (TASK-110)

### Implemented controls

- Authentication resolves a normalized organisation code before the
  organisation-scoped username. The same username may exist in different
  organisations; duplicate usernames within one organisation are rejected.
- A signed-in employee is derived from the company-scoped `Employee.app_user`
  binding. `/api/my/*` does not accept a client-selected `employeeId`.
- Permissions are the union of all roles granted in the active company. Tenant,
  employee and reporting-tree filters are applied separately and are never widened
  by that union.
- A linked employee with active direct reports receives a system-managed Manager
  role. The grant is removed when no longer required. A manually assigned Manager
  role is never removed by reporting-line reconciliation.
- Temporary activation and reset credentials use an expiring AES-GCM envelope.
  Every HR reveal is audited. First activation changes the password, records an
  email address and permanently clears the recoverable envelope.
- HR password reset revokes live sessions and issues a new one-time credential.
  Offboarding immediately disables the employee and user, revokes sessions, clears
  active credential envelopes, transfers current work and retains historical facts.
- Authentication failures use a generic response and rate limiting. State-changing
  operations require an authenticated session, CSRF protection, permission checks,
  request idempotency where applicable and an audit record.
- Production login offers an explicit “Remember this device” option. It extends the
  database-backed session to a 30-day absolute / 7-day idle lifetime using only
  `HttpOnly`, `Secure`, `SameSite=Strict` cookies; passwords, bearer tokens and device
  fingerprints are never stored in localStorage or IndexedDB.

### Explicitly accepted optional controls

The product owner has accepted the following current boundary:

- **Email verification is optional.** First activation requires an email address,
  but ownership of that address is not verified. Employee forgotten-password
  recovery remains an HR-controlled reset rather than email self-service.
- **MFA is optional.** There is no mandatory second-factor enrollment, challenge,
  recovery-code or trusted-device workflow.
- **Sensitive-operation step-up is optional.** HR activation-secret reveal, reset
  and offboarding rely on the active session, CSRF, RBAC, tenant scope and audit;
  they do not require a fresh password or second factor.

These are accepted risks, not security guarantees. A stolen authenticated session or
compromised HR account therefore has greater impact than it would under mandatory MFA
and step-up authentication, while an incorrectly entered activation email can remain
unverified. Production deployments with stronger assurance requirements should make
MFA, verified contact channels and step-up authentication mandatory before enabling
employee self-service broadly.

### Automated proof

The test suite covers organisation-local identifier uniqueness, cross-organisation
login reuse, activation-secret destruction, HR reset, immediate session revocation,
offboarding transfer, role-permission union, reporting-line Manager reconciliation,
cross-tenant denial, actor-id tampering and direct/tree hierarchy boundaries. Schema
migration and PGlite replay checks prove the same data contract used by Demo and API
mode.

## Company access and onboarding boundary (EPIC-059)

Authorization now evaluates only roles assigned to the active company. Allows are
unioned and scopes use the widest of self/team/department/company; a restricted row
without enforceable ownership fails closed. UI hiding is defence in depth: the API
rechecks action permission, module state, tenant, scope and resource visibility.
Initial Staff passwords are hash-only, force change and expire at first use or seven
 days. Setup-stage employees cannot log in. Production provides a Company-Owner-only
employee-workspace entry point limited to active, company-linked employee accounts;
passwords and activation secrets are never exposed. Entry and return are audited,
while Demo seed remains guarded by explicit Demo-only environment flags plus an
empty-database check. Import preflight and commit remain server-side, bounded,
replay-resistant, audited and transactionally atomic.

## Dependency supply-chain boundary (TASK-143)

Production dependencies are checked independently in the root and `web/` lockfiles
with `npm audit --omit=dev`. ExcelJS 4.4.0 remains the stable workbook API, while root
overrides move its archive, workbook-read and UUID dependencies to fixed compatible
releases; `brace-expansion` is pinned to 5.0.8. The Web workspace pins PostCSS to
8.5.23. As of 2026-07-27 both production audits report zero vulnerabilities, so no
security exception or expiry is being accepted. Focused XLSX read/write tests, both
build modes and clean `npm ci` Docker builds are required whenever these pins change.

## Authorization architecture boundary (EPIC-062)

[ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md) is the normative
current/target record. The following are implemented compatibility facts:

- user permissions are the Allow union of active-company roles;
- assignment-owned scope rows are preferred and union to the widest matching
  `self/team/department/company` value; assignments with a null
  `scope_backfilled_at` dual-read legacy `role_resource_scope` rows;
- role assignments are active only inside `[valid_from, valid_until)` and while
  `revoked_at` is null; creation/revocation provenance is audited;
- migration `0089_company_owner_cutover` makes tenant-local `is_superadmin` a legacy
  migration/audit flag. The immutable, company-scoped Company Owner role uses 112
  explicit tenant permissions and does not bypass role-permission checks;
- permission storage still contains broad compatibility keys, but TASK-171 now adds an
  application-owned registry with explicit canonical mappings; route/resource/action
  projections are registered and unknown or platform-domain keys cannot be used as
  tenant role or approval permissions;
- an `allowed=false` role-permission row is not an explicit deny override. TASK-173's
  migration 0087 adds reasoned user-level `user_permission_override` rows; matching
  deny rows are evaluated before explicit allows and role grants, with
  validity/revocation enforced; the legacy Superadmin flag is not an authorization
  source;
- `src/auth/authorization.ts` is the central evaluator used by permission wrappers,
  action/resource gates and approval permission checks. Public callers receive safe
  reason codes; audit-read administrators can request full explanation details through
  an append-audited endpoint;
- direct Sales Order and Purchase Order approve/reject actions now require dedicated
  registered `sales.approve`/`purchasing.approve` grants both in the dispatcher and in
  the domain command; the pending order plus approval rows remain a second, locked
  workflow-authority check before mutation;
- Purchase Requisition approve/reject actions now require `purchasing.approve` in the
  dispatcher and domain command. The command checks active tenant membership before
  locking the legacy requisition row and only mutates a `submitted` request; no generic
  approval instance/step is claimed for this path;
- Sales Commission run approval now requires `sales.commission.approve` in the domain
  command as well as the dispatcher. The command checks the active tenant actor before
  locking and mutating a `draft` run; its versioned header snapshot is the current
  legacy authority and no generic approval instance/step is claimed;
- unknown business-module keys now fail the module gate and therefore cannot bypass
  module activation while resource registration is incomplete. Authenticated
  `account/*` service routes are an explicit non-module prefix: they remain protected
  by tenant/session and route permissions, but are not disabled with business-module
  switches. Resource registration remains a runtime application allowlist; no database
  FK is claimed. Migration 0088 supplies the company-scoped freshness marker and core
  role/assignment/scope/module/override/invitation writers bump it atomically;
  Master-wide support grant changes bump every Company under that Master. Browser API
  requests carry their capability version, stale snapshots fail closed with 409 and
  recover only through `/api/auth/session` before a non-replaying reload. The marker is
  not an access grant; server permission, organization and workflow-policy decisions
  remain current-row evaluations rather than cached authority.

TASK-170 now separates platform/support authority. `platform_principal`, platform roles,
hash-backed bearer/CSRF sessions and `support_access_grant` are outside tenant role
administration. A grant requires a target master, optional matching company, reason,
ticket, validity window and mode; read-only, restricted-write and break-glass checks
default-deny sensitive fields and write operations unless explicitly allowed. Platform
API routes reject tenant cookies, require platform CSRF for mutations and audit grant
creation, decisions and revocation. Principal/session issuance is out-of-band, and the
evaluator is a decision/audit boundary rather than an automatic customer-data proxy.

TASK-172 has delivered assignment scopes, validity, revocation and provenance. TASK-173
is now implemented across the direct Sales/Purchasing order slice, Purchase Requisition,
Sales Commission, allowance, budget and versioned leave/expense approval paths. Approval
decisions are bound to the locked current step; a management `hr.write` permission no
longer bypasses a manager-owned step. Permission authorities receive server-resolved
resource/module/scope context plus policy-version, approval-instance and approval-step
identifiers; the active step must belong to the instance's policy snapshot, and a named
direct authority must still be an active employee. Existing in-flight approvals keep
their snapshotted current authority; there is no implicit time-based migration or
takeover. Delegation remains tenant/domain/authority/delegate/time/revocation bounded;
instance/step/resource/policy-bound delegation is still a later hardening slice.
TASK-174-A now fails closed for unknown business-module keys, registers payroll as a
gateable module and keeps authenticated `account/*` service routes explicitly outside
  business-module switching while retaining route permissions. Migration 0088 now
  provides the company authorization-version source and first atomic bump paths; migration
0089 delivers the explicit Company Owner cutover. Complete cache invalidation, broader
  organization/policy/support coverage remain pending; target migration, production RLS
  re-application and application release verification are complete. Disposable PostgreSQL
  16 parity, true concurrency and non-superuser RLS/security proof are green. TASK-170's implemented platform boundary grants
no platform operator permanent implicit customer-data authority.

The shared access matrix (`src/auth/accessMatrix.ts`) and its API/browser checks are
defence-in-depth regression contracts for route visibility, module/permission metadata
and record drill-in. They do not replace backend authorization and do not close the
remaining TASK-174 authorization-version gap. Session and effective-capability
responses expose the current version so future caches can reject stale projections;
backend authorization still re-evaluates current database state on every protected
request.

The current employee-workspace impersonation endpoint is restricted to an active-company
Company Owner and active linked non-Owner employee, records entry/return and blocks
sensitive activation operations. It is not time-bounded platform support access and
must not be represented as such.

## Calendar worker boundary (TASK-167)

The resident calendar worker receives narrowly scoped transaction flags only for the
employee, appointment, reminder, appointment-outbound and notification rows required
for delivery. It does not receive general tenant bypass. Jobs revalidate current
appointment revision, recipient and connection state; stale work is superseded, and an
external calendar remains a one-way projection rather than a source of ERP truth.

## Company Receipt security invariants

Expenses & Tax v1 reuses existing document validation and custody: declared MIME,
extension and magic bytes agree; 20 MB/20-page limits apply; unknown/infected scan
states fail closed; originals, hashes and versions remain preserved; and sensitive
view/download/print/export operations are audited with no-store delivery.

TASK-177 Company Receipt operations derive tenant/uploader scope from Session, reject
nested client `masterFn`/`companyFn`, require current uploader-owned clean evidence,
enforce optimistic versions and audit create/update/void with request correlation.
Cross-tenant reads/writes fail closed at both command predicates and production RLS.
Evidence identity is immutable and void is retained instead of hard deletion.

TASK-178 exposes only uploader-scoped extraction candidates and omits raw OCR text.
Candidate value/source/model/confidence/review facts remain immutable suggestions;
confirmation writes separate business metadata. Migration 0091 uniquely constrains
`master_fn + company_fn + evidence_sha256`, so concurrent upload keys cannot confirm
the same exact file twice. Only exact hashes block; similarity never auto-merges.

TASK-179 list/detail reads fail closed unless the tenant identity holds the explicit
own or company receipt-read capability. The resulting visibility is enforced again in
the tenant-scoped query; Company Owner receives a stored company-read grant and
platform support receives no tenant business grant. Mutations and confirmation remain
uploader-only under `employee.receipts.write` until TASK-182's canonical cutover.
TASK-181 Pack creation and rendering reapply the same read capability and resolved
own/company visibility; snapshots are creator-only, stable-key idempotent, bounded to
5,000 rows and render only after scan, version/hash/content and 250 MB source checks.
Preview/download/Print return one no-store artifact and append correlated audit without
mutating Company Receipt state. Sellable module entitlement remains TASK-182/186.
Exact hash duplicates may warn/prevent accidental storage, but
merchant/date/amount similarity must never auto-delete or merge evidence.

## Platform-owned Module Access Control security boundary

TASK-186 closes the former tenant mutation gap. Company Owner and Company Admin no
longer receive `admin.modules.manage`; the compatibility key is deprecated and
non-assignable, migration 0095 removes stored tenant grants/revokes active overrides,
and `/api/admin/modules` returns 403 `platform_authority_required` without disclosing
state. The tenant Module Activation UI and onboarding selector are absent.

Only a separately authenticated `platform_superadmin` may receive
`platform.modules.read/manage`. Platform credentials/sessions remain outside
`app_user`/`erp_session`; platform CSRF, expected-version checks, request correlation
and append-only before/after audit protect every immediate entitlement mutation.
Support roles do not inherit commercial authority. TASK-185 implements this platform
API boundary; TASK-186 owns the tenant cutover and authorization-version invalidation.

Module authorization fails closed in this order: authenticated target identity,
trusted Master/Company context, Master entitlement, Company allocation, permission,
scope, then workflow authority. A stale role permission or simulated user cannot bypass
either entitlement layer. Direct routes, bespoke/generic APIs, notifications, workers
and writes must return a bounded 403 `module_not_enabled` without revealing another
tenant's entitlement facts. TASK-186 applies that check to generic resources, mapped
bespoke APIs, route projection and notifications. TASK-188 still owns exhaustive
worker/browser/adversarial and release proof.

Platform end-user simulation may target any active assigned user in the selected
Master/Company and may perform that user's legitimate writes. TASK-187 implements a
visible banner, default 15-minute expiry bounded by the one-hour platform session, no
Remember Me, immediate durable revoke/return, login rate limiting, platform CSRF and dual
`actorUserId`/`platformPrincipalId` audit. Platform permissions are never unioned into
the target session and MAC writes reject until the operator returns to the platform
workspace.

Approved v1 uses password-only platform login and no MFA. Because that principal can
alter commercial access and fully simulate active users, this is a high-severity
residual risk that must remain in TASK-187/188 acceptance and release reporting.
