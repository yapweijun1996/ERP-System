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
