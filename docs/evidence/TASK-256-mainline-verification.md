# TASK-256 clean mainline verification

Branch codex/hr-scopes-mainline is based on current remote 1b0a4c3. It excludes
removed Company Profile commit 4f9234d and unrelated dirty changes.
Explicit inherited HR dependencies are documented in TASK-256-history-boundary.md.

Local verification of this source:
- Root/web typechecks and lint pass.
- Generated Demo schema: 119 migrations, schema version118.
- RLS source coverage: 238 policy tables, 10 exemptions, 268 schema tables.
- Five locale bootstrap current: 1852 English keys.
- Focused HR domain files passed 24 tests; API rerun after preserving the
  employment-end 404 contract passed 2 files/8 tests (43.33s).
- Disposable PostgreSQL16: blank-before-fixture; migration replay;
  committed-main schema populated with fictional staff, dump/restore, additive
  HR upgrade and replay retain identity/department/job-title and zero new
  assignments/grants; runtime non-superuser/non-bypass RLS, cross-tenant
  denial42501, optimistic update concurrency, backup/restore and restart pass.
- Docs link check passes; no original files or production state changed.

The earlier full 6-file local run had 31 passing and one failing assertion:
Company-scoped employment-end returned403 instead of its existing404 contract.
The helper and route error mapper were corrected, and both API files rerun.
That original failed run is not represented as passing.

Final built browser passed organization create/assign, 15 locale/layout combinations
(en/zh/ms/ja/vi x1280/768/375), focus/Escape checks, staff/end and Leave
overlap/single-balance-use; zero console errors. CI results are recorded separately
at their exact source revision.
No claim of production readiness, migration against populated /erp, merge or
grant activation is made. Current-main migration0118 differs from removed
Company Profile migration0118; existing live lineage requires separate review.

Follow-up scoped review: employment ending can reassign reports. Shared API/Demo
checks now cover the subject, every affected report and handoff employee. API
regression8/8 and enhanced scoped matrix4/4 pass, proving out-of-scope denial with
no changes and permitted within-BU handoff. Built editor/staff/Leave browser rerun
passes with zero console errors. See [separate production gate](../HR_PRODUCTION_RELEASE_GATE.md).


Independent review repairs (unreleased):
- Generic staff/Leave list and get always apply a finite employee projection,
  even when another role has Company scope. Projection authorization uses the
  entry route's canonical permission and its explicit legacy action candidate.
- Linked account offboarding requires permission-qualified Company scope in
  API and Demo; restricted HR cannot change reports or CRM ownership.
- Company-global routes ignore extra employeeId fields for authorization.
  Appointment writes authorize the persisted subject and reassignment subject,
  with a transaction-time check before mutation.
- BU/Position employment-end replay evaluates current permissions, membership,
  active actor organization and retained target organization, including ended
  targets only for this operation. Fresh domain mutations still reject inactive
  employees; revoked permission blocks cached replay.
- Permission-based Leave decisions retain the snapshot department deny and
  current employee/BU/Position denies. Denied My approvals leave records,
  balances and approval events unchanged.
- CI d89bda5 failed employeeAccount credential reveal fixture at line109:
  its new HR role omitted a data scope. The synthetic fixture now explicitly
  assigns its intended Company scope; no production user receives rights.
- New source still requires exact-head CI and independent final-tree review.

Repair validation: affected test run 5 files/37 tests passed; final enhanced API
matrix 9/9 passed, including BU and Position end replay, permission revocation,
canonical-only reads/actions, mixed roles, spoofed Company mutations, appointment
old/new subject denial, linked offboard ownership preservation and three subject
approval denies with unchanged balance entries/events. Root/web typechecks, lint,
Demo build and docs links passed. Final built browser passed 15 locale/layout
combinations, staff ending and Leave overlap/single balance use, zero console errors.
Disposable PostgreSQL16 rehearsal repeated after repairs: 119 migrations,
restricted runtime RLS, tenant write denial42501, concurrent versions, populated
main restore/upgrade, migration replay, backup/restore and restart all passed;
no assignment/grant backfill and no deployment change.
