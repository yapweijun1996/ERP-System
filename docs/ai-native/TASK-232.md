# TASK-232 — Establish least-privilege agent identity and delegation

Goal: **G05** · Initial status: **Todo** · Priority: **P0**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-227**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G05 criteria plus common DoD remain required for task completion.

## Outcome and scope

Add explicit Agent identities and limited delegation. Preserve existing human and Platform contracts; do not create a tenant superadmin shortcut.

## Read these existing files first

- [src/auth/authorization.ts](../../src/auth/authorization.ts)
- [src/auth/session.ts](../../src/auth/session.ts)
- [src/auth/authorizationVersion.ts](../../src/auth/authorizationVersion.ts)
- [src/auth/permissionRegistry.ts](../../src/auth/permissionRegistry.ts)
- [src/auth/platformTenantAccess.ts](../../src/auth/platformTenantAccess.ts)
- [src/data/schema/authorization.ts](../../src/data/schema/authorization.ts)
- [src/data/schema/tenancy.ts](../../src/data/schema/tenancy.ts)
- [src/api/postgresSecurity.integration.test.ts](../../src/api/postgresSecurity.integration.test.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Decide explicit principal-to-existing-user/audit compatibility before schema changes: existing AuthorizationPrincipal and receipt commands require a numeric userId. A service actor must have its own bounded identity, not silently borrow an administrator. Platform hidden actors are reference evidence, not reusable authority.

## Execute in this order

- [x] **S1 — Map principal and audit contracts.**

  Action: Trace authorizeWithin, session resolution, receipt actor userId and audit foreign keys. Specify human, delegated-Agent and service-automation ownership; write the migration/backward-compatibility decision and example allow/deny matrix.

  Checkpoint exit: Every new actor can be attributed without forging a human session or changing old role meaning.

  Evidence: [TASK-232-2026-09-08 evidence](evidence/TASK-232-2026-09-08.md#s1-principal-and-audit-contract-map).

- [x] **S2 — Implement grants and validation.**

  Action: Persist agent identity/owner, grant scope, permitted actions, expiry/revocation/version and applicable amount limits. Deny unknown actors/actions. Resolve current permissions by intersecting the grant with tenant/module/resource/field authority.

  Checkpoint exit: Tests cover owner deactivation, expired grant, amount boundary and read-own versus read-company.

  Evidence: [TASK-232-2026-09-09 evidence](evidence/TASK-232-2026-09-09.md#s2-grants-and-validation).

- [x] **S3 — Integrate authorization and audit.**

  Action: Add an authenticated Agent principal resolver at the API boundary. Keep issuer authentication separate from ERP business authorization. Record true agent and delegating human/service owner while committing required business/audit evidence atomically.

  Checkpoint exit: Forged request-body identities cannot select actor or tenant; existing human/Platform tests still pass.

  Evidence: [TASK-232-2026-09-09 evidence](evidence/TASK-232-2026-09-09.md#s3-authenticated-authorization-and-audit).

- [x] **S4 — Add lifecycle controls.**

  Action: Provide authorized review, grant/revoke, rotation and emergency disable APIs/UI. Prove a paused task cannot resume with revoked authority using a controlled two-call test; G09 later owns actual durable worker integration.

  Checkpoint exit: One actor/company can be disabled without widening others; active and resumed calls fail after revocation.

  Evidence: [TASK-232-2026-09-09 evidence](evidence/TASK-232-2026-09-09.md#s4-lifecycle-controls).

- [x] **S5 — Prove database isolation and close.**

  Action: Generate/check schema/RLS artifacts if changed. Run focused auth/API regressions and new non-superuser PostgreSQL tests. Verify migration replay, Company isolation, actor visibility and audit attribution.

  Checkpoint exit: G05 has both source tests and PostgreSQL/RLS proof; unavailable PostgreSQL leaves the relevant criterion open.

Evidence: [TASK-232-2026-09-09 evidence](evidence/TASK-232-2026-09-09.md#s5-database-isolation-and-close).

Post-S5 local follow-up (2026-09-09): the Agent Governance module-local locale
packs, Admin route label resolution and purchase-wizard `Review`/`Currency` labels
were repaired. The static and full 130-route × five-language × desktop/mobile i18n
audits now pass with zero blocking findings. [Follow-up evidence](evidence/TASK-232-2026-09-09.md#post-s5-agent-governance-locale-remediation).

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G05.1:** Model distinct human, delegated Agent and service automation principals with an accountable owner and attributable audit identity.
  - Required evidence: Principal model, migration and accountable ownership.
  - Current result: Pass. Principal kinds, non-login bridges, accountable owners and audit actor/delegator columns are covered by the schema, migration and local API/PostgreSQL evidence.
- **G05.2:** Intersect delegation grants with current tenant/module/resource/field permissions and explicit time, action and amount limits; never inherit shared administrator authority.
  - Required evidence: Grant/permission/action/time/amount intersection cases.
  - Current result: Pass. Grant resolution intersects current owner authority with action/resource/field/scope/time/amount limits and fails closed on later permission changes.
- **G05.3:** Prove expiry, revocation, Company isolation and permission downgrade during a running task under non-superuser PostgreSQL/FORCE RLS.
  - Required evidence: Non-superuser PostgreSQL denial and two-call revocation test.
  - Current result: Pass. Disposable non-superuser PostgreSQL 16 with FORCE RLS proves expiry, revocation, Company isolation and permission downgrade during authenticated calls.
- **G05.4:** Provide administrator review, credential rotation and emergency disable controls; preserve existing Platform/Master/Company ownership boundaries.
  - Required evidence: Review/rotation/emergency-disable controls and preserved Platform boundaries.
  - Current result: Pass. Human-session/CSRF admin review, one-time hash-only credential rotation and pause/resume/disable/revoke controls are covered; Platform/Master/Company boundaries remain separate.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/auth/authorization.test.ts src/auth/session.test.ts src/auth/authorizationVersion.test.ts src/api/permissionMatrix.integration.test.ts
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

If the new principal cannot satisfy existing actor/audit constraints safely, stop before schema or permission shortcuts and document the exact design decision needed.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
