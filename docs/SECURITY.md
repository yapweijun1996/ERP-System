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
days. Setup-stage employees cannot log in. Production exposes no impersonation and
Demo seed is guarded by explicit Demo-only environment flags plus an empty-database
check. Import preflight and commit remain server-side, bounded, replay-resistant,
audited and transactionally atomic.
