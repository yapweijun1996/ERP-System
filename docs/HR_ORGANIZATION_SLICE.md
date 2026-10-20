# HR organization and scoped access — local candidate

## Goal and state

Company-owned Business Unit and Position masters, explicit staff assignments, and
usable scoped employee/Leave access. Repository identity is
yapweijun1996/ERP-System; contained branch codex/hr-organization-scopes starts at
4f9234d with pre-existing dirty source preserved. Original checkout and live
configured PostgreSQL are unchanged. TASK-256 remains in progress pending committed
source CI and release gates. No production grant is activated, reset or seed run.

## Implemented design and API

MasterFN -> CompanyFN -> staff/users remains the ownership hierarchy. New masters
carry Company composite foreign keys, normalized unique codes, active eligibility,
versioned updates, row locks and audit. Nullable staff assignments retain existing
department/job-title labels. Assignment creates no permission.

Authenticated routes under /api/hr:
- GET /organization/:kind
- POST /organization/:kind
- PUT /organization/:kind/:id
- PUT /employees/:employeeId/organization

Kinds: business_unit and position. Master administration and staff organization
assignment require Company-scoped hr.read/hr.write; a scoped actor cannot move
themselves to widen authority. Mutation bodies reject client tenant/actor/unknown
keys. CSRF, Idempotency-Key, optimistic versions and transactional audit are
required. Concurrent identical master creation replays one result; changed
payload reuse conflicts. The Demo editor invokes shared domain commands; API mode
uses authenticated endpoints.

The central HR projection evaluates live permissions, resource grants and active
staff assignments on every request. Generic list/get/action/update and dedicated
employee/Leave routes use it. Governed permission-based Leave approval uses the
same projection with approval policy context; direct/delegated approval authority
and self-approval prohibition remain governed by the existing workflow.
Cancellation resolves the source employee and rechecks scope in its transaction.
Restricted company-global HR configuration/onboarding operations fail closed.

Self/team/department retain their existing user-account projection semantics.
BU/Position project staff IDs directly, including accountless staff. Explicit
targets must be active masters in the current Company. Even an explicit grant
requires the actor's current active assignment in that dimension. Unassigned,
former, inactive master, revoked-role and foreign Company targets fail closed.
BU/Position dimensions cannot cover one another. Company can contain either.
No existing users receive new grants; scope choices are explicit administration.

## UI and policy

Native organization dialog supports master create/edit/deactivate and reasoned
staff assignment, with optimistic versions and error feedback. Actual catalogs:
en, zh, ms, ja, vi. Tested widths 1280, 768 and 375; native focus containment,
Escape/focus restoration, localized labels and overflow checks. This focused
keyboard/layout validation is not a comprehensive accessibility certification.

Existing ERP KB erp-system-project-logic item erp.logic.leave is authoritative:
effective policy/calendar snapshot; paid reservation on submission; final
approval/rejection settlement; approved cancellation decision restores balance;
Pending/Approved overlap rejected except opposite same-day AM/PM; versioned
append-only events. Odoo KB was consulted but yielded no applicable Leave policy.
No new policy, external notification delivery, payroll operation or payment is
introduced by this slice.

## Migration and rollback

0119 adds initially empty hr_business_unit/hr_position, nullable employee IDs,
organization_version default 0, tenant foreign keys and indexes.
0120 widens authorization scope/target CHECK constraints. Neither migration updates
existing grants, staff assignments or company rows. Generated Demo artifacts match
121 ordered migrations, schema version 120. Production RLS overlay includes both
masters.

Disposable PostgreSQL 16 rehearsal proved blank companies before synthetic seed,
migration replay, runtime NOSUPERUSER/NOBYPASSRLS, cross-tenant read isolation and
write denial 42501, concurrent version conflict, pg_dump/restore. Its container
was removed. This is focused schema/RLS evidence, not production UAT.

Release must first identify and commit the intended source separately from
unrelated inherited dirty work, pass exact-commit CI and produce a source-only
release manifest. Rehearse on an isolated restore of the intended target, capture
backup and migration journal, assess employee table DDL locks, and verify restart.
Rollback compatible application source while retaining additive schema and scope
constraints; do not remove columns with data or reset the DB. Revoke only reviewed
new grants if rollback requires it.

## Remaining release gate

Current /erp was observed healthy at revision
61240fec43c2aa58f9750ff8c666f5ec07fc9c4c and its DB is already configured.
A separately empty production target is necessary for the owner's blank-company
goal. Demo data must remain isolated. No route/DNS/Tunnel/Access change is proposed
or executed here. Production BU/Position grant activation needs narrow review.
Exact-commit CI, production restore/migration/restart rehearsal and live
employee/Leave QA remain required; this local candidate is not production-ready.

See [QA evidence](evidence/TASK-256-organization-foundation.md).
