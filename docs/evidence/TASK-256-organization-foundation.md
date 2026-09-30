> Historical mixed-candidate checkpoint. Superseded for release decisions by
> [clean mainline verification](TASK-256-mainline-verification.md) and
> [history boundary](TASK-256-history-boundary.md).

# TASK-256 local scoped candidate evidence

Status: In Progress. Contained branch codex/hr-organization-scopes based on 4f9234d,
with inherited dirty source preserved. No commit, CI, merge or deployment is claimed.
Original checkout status compared byte-for-byte with inventory and is unchanged.

## Verified implementation

Company-owned BU/Position masters, same-tenant staff assignments, transactional
audit and optimistic versions; Company-only organization administration.
Shared live staff projection covers generic HR list/get/update/actions, dedicated
employee and Leave routes, and governed permission-based Leave approval.
Approved-cancellation routes resolve source staff and recheck in transaction.
Explicit scoped grants never create rights automatically.

The API matrix covers unassigned actor denial, BU accountless staff access,
foreign BU/Company denial, profile update, Position assignment removal, role
revocation, repeated identical requests, changed-payload idempotency conflict,
concurrent master creation, and governed approval/cancellation/replay. Final
self/team/Company plus BU/Position matrix: 4 tests passed (8.28s), including
positive/negative generic and specific HR routes, governed approval/cancellation,
and Company cross-tenant denial.

## Passing verification

- Final scoped governed API run: 3 tests passed after shared approval authority fix.
- Final employee and Leave regression: 4 files, 25 tests passed (86.34s).
- Broader earlier run: 7 files passed/45 tests; newly added scoped approval test
  failed there, exposing the approval projection mismatch. That failure was fixed
  and rerun. The entire earlier 8-file run is NOT claimed passing.
- Organization domain 3 tests, authorization/role/balance tests previously passed.
- Final rebuilt browser: persisted BU/Position creation and assignment; 15 layouts
  (en/zh/ms/ja/vi x 1280/768/375); no overflow/fallback keys, focus inside dialog,
  Escape/focus return, zero console errors.
- Final rebuilt Staff browser: 59 fixture staff, persisted end, 375px no overflow,
  zero console errors.
- Final rebuilt Leave browser: overlapping request remains Draft, first request
  Approved, single balance-use entry, 375px no overflow, zero console errors.
- Root/web typechecks and lint pass; Demo build passes with existing bundle-size
  warning. PGlite Demo proof passes; no POSTGRES_URL supplied to that proof.
- Generated schema matches 121 migrations (version 120); RLS source coverage
  239 policy tables / 10 infrastructure exemptions / 269 generated tables;
  locale bootstrap current at 1854 English keys.
- Disposable PostgreSQL16: blank Company count 0 before fixture, migration replay,
  non-superuser/non-bypass RLS role, tenant read separation, cross-tenant write
  denied 42501, one concurrent version success/one conflict, dump/restore passed.
  Temporary container removed, no live target or grants changed.
- Docs link check: 157 Markdown files / 963 local links; diff check passed.

Sandbox Chromium and tsx IPC launches required normal tool escalation; isolated
QA succeeded. This is not a safety-review rejection. No failed launch is counted
as passing browser evidence. Wider tests interrupted by relocating the candidate
earlier are likewise excluded.

## Release bounds

The focused browser checks are not a full accessibility audit. PostgreSQL evidence
is schema/RLS/concurrency/backup rehearsal, not all API workflows on production
runtime credentials. Exact committed-source CI, target restore/migration locks and
restart rehearsal, source-only manifest and live QA remain gates. Existing
configured /erp baseline revision was 61240fec43c2aa58f9750ff8c666f5ec07fc9c4c;
production has existing setup and is not a blank Company target. No live data
seed/reset, external notification, network route or other Air service changed.

See [design, API and rollback](../HR_ORGANIZATION_SLICE.md).
