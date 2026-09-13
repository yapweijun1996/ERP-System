# TASK-202 — Disposable PostgreSQL parity and authenticated Company Receipts E2E

Date: 2026-09-13, Asia/Singapore. This record adds disposable PostgreSQL
evidence for the current Receipt Pack/API candidate. It does not claim a
production database, production release, real provider call or Finance/QA
visual Print acceptance.

## Identity and selected gap

- **Task:** TASK-202, Receipt Pack lifecycle, export and production acceptance.
- **Selected gap:** the preceding concurrent Pack-key API record was verified
  against fresh PGlite only because `POSTGRES_URL` was absent. A clean,
  disposable PostgreSQL target is now available locally, so the same
  cross-engine and authenticated browser journeys can be exercised without
  using production data.
- **Expected:** PGlite and PostgreSQL produce identical transaction-proof
  results; PostgreSQL's two concurrent stock issues have exactly one winner;
  and the authenticated Company Receipts browser flow completes confirmation,
  refresh/search/range validation, Preview/PDF/Print and responsive checks.
- **Actor / environment:** Codex on local macOS, root `main` revision
  `1246675e86c370cd11de020987cb821743cc28b9`, disposable container
  `codex-erp-postgres-s5` (`postgres:16-alpine`, PostgreSQL 16.15), and unique
  temporary databases `erp_goal_20260913` and `erp_receipts_goal_20260913`.
  The worktree had 36 pre-existing dirty paths and no unmerged paths; those
  paths were preserved. No credentials or provider keys were stored.

## Observed result

- `POSTGRES_URL=postgres://postgres@127.0.0.1:55432/erp_goal_20260913 npm run demo`
  passed all PGlite and PostgreSQL assertions. Repository, transaction, sales,
  purchasing, CRM and payroll outputs were identical across engines.
- The PostgreSQL concurrency assertion passed with `fulfilled=1`,
  `rejected=1`, `finalStock=2` and `movementsDelta=1`.
- `TASK183_POSTGRES_URL=postgres://postgres@127.0.0.1:55432/erp_receipts_goal_20260913 npm run test:e2e:company-receipts-postgres`
  passed the authenticated Company Receipts API/browser journey: confirmation,
  refresh/search/range, Preview/PDF/Print and responsive bounds.
- `POSTGRES_URL=postgres://postgres@127.0.0.1:55432/postgres npm run test:postgres -- --reporter=dot`
  passed 4 files / 4 tests against the existing disposable PostgreSQL cluster.
- Both temporary databases were dropped by an exit trap; a post-run catalog
  check confirmed neither database remained.

## Acceptance boundary and handoff

This closes the local/disposable PostgreSQL parity gap for the current Demo and
authenticated Company Receipts API/browser candidate. It strengthens TASK-202
evidence but does not change task, GOAL criterion, execution-checkpoint or
capability counts. Production readable SG/MY source, production release
identity and named Finance/QA human Print acceptance remain open. The same
scope and approval contracts were exercised; no tenant rule or domain behavior
changed.

The next measurable production exit is an approved production target with
readable SG/MY receipts, followed by a named Finance/QA reviewer opening the
rendered/downloaded Pack and recording the visual Print verdict.
