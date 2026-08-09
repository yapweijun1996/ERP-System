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
days. Setup-stage employees cannot log in. Production provides a Superadmin-only
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
- tenant-local `is_superadmin` bypasses role-permission checks inside the active company;
- permission storage still contains broad compatibility keys, but TASK-171 now adds an
  application-owned registry with explicit canonical mappings; route/resource/action
  projections are registered and unknown or platform-domain keys cannot be used as
  tenant role or approval permissions;
- an `allowed=false` role-permission row is not an explicit deny override. TASK-173's
  migration 0087 adds reasoned user-level `user_permission_override` rows; matching
  deny rows are evaluated before explicit allows, role grants and the tenant-local
  Superadmin compatibility grant, with validity/revocation enforced;
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
- unknown module keys currently pass the module gate and therefore remain a migration
  risk even though registered resources retain their own authorization checks. Resource
  registration is currently a runtime application allowlist; no database FK or
  authorization-version cache is claimed yet.

TASK-170 now separates platform/support authority. `platform_principal`, platform roles,
hash-backed bearer/CSRF sessions and `support_access_grant` are outside tenant role
administration. A grant requires a target master, optional matching company, reason,
ticket, validity window and mode; read-only, restricted-write and break-glass checks
default-deny sensitive fields and write operations unless explicitly allowed. Platform
API routes reject tenant cookies, require platform CSRF for mutations and audit grant
creation, decisions and revocation. Principal/session issuance is out-of-band, and the
evaluator is a decision/audit boundary rather than an automatic customer-data proxy.

TASK-172 has delivered assignment scopes, validity, revocation and provenance. TASK-173
has completed the direct Sales/Purchasing order slice, the Purchase Requisition
legacy-state slice, the Sales Commission legacy-state slice, the allowance calculation
slice and the budget slice, but remains in progress for strict permission-plus-current-
workflow-authority coverage across the HR compatibility path, plus broader
resource/module/policy context. TASK-174–175 must
invalidate stale authorization state and remove the tenant Superadmin bypass. TASK-170's
implemented platform boundary grants no platform operator permanent implicit
customer-data authority.

The shared access matrix (`src/auth/accessMatrix.ts`) and its API/browser checks are
defence-in-depth regression contracts for route visibility, module/permission metadata
and record drill-in. They do not replace backend authorization and do not close the
remaining TASK-174 unknown-module or authorization-version gaps.

The current employee-workspace impersonation endpoint is restricted to an active-company
Superadmin and active linked non-Superadmin employee, records entry/return and blocks
sensitive activation operations. It is not time-bounded platform support access and
must not be represented as such.

## Calendar worker boundary (TASK-167)

The resident calendar worker receives narrowly scoped transaction flags only for the
employee, appointment, reminder, appointment-outbound and notification rows required
for delivery. It does not receive general tenant bypass. Jobs revalidate current
appointment revision, recipient and connection state; stale work is superseded, and an
external calendar remains a one-way projection rather than a source of ERP truth.
