# TASK-201 — Queue claim predicate regression

Date: 2026-09-13, Asia/Singapore. This record covers a local PGlite fixture
regression for the TASK-201 telemetry handoff. It does not claim production
SLO, representative scale, alert delivery, backup/restore, failover or owner
acceptance.

## Identity and scope

- Task / goal: TASK-201 / G11 (worker backlog, retry, dead-letter and failure observability).
- Checkpoint: S2 claim/terminal-state reconciliation.
- Environment: isolated local PGlite created by `freshDb()`, seeded with Demo data.
- Actor and tenant: Codex test actor `admin@acme.co`; `M1` / `C-SG` only.
- Intended outcome: prove report, tax-evidence, appointment and reminder
  telemetry aggregates use the same readiness, lease, attempt, due-time and
  terminal predicates as their queue claim paths.
- Exclusions: no provider credential, external calendar, production database,
  deployment or real-person data.

## Observed result

`src/worker/telemetry.test.ts` now inserts controlled queued, running, failed,
active-lease, expired-lease, due and not-yet-due rows for the four previously
uncovered queues. The aggregate snapshot reported the expected values:

| Queue | pending | ready | in-flight | retrying | failed | dead-lettered |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| report | 2 | 1 | 1 | 1 | 1 | 0 |
| tax-evidence | 1 | 1 | 0 | 1 | 1 | 0 |
| calendar-appointment | 2 | 1 | 1 | 1 | 1 | 0 |
| calendar-reminder | 3 | 2 | 0 | 1 | 1 | 0 |

The result confirms that stale running work is claimable, active leases are
in-flight but not ready, failed rows remain retry-visible, and future reminders
remain pending without being ready. The serialized snapshot contains no queue
payload or event key.

## Verification and provenance

- Focused command: `npx vitest run src/worker/telemetry.test.ts --reporter=dot`
  — **1 file / 10 tests passed**.
- Existing telemetry tests still cover timeout bounds, transaction-local
  settings, outbox failure/lease handling, document lease handling, calendar
  connection gating, structured logging and non-overlapping emission.
- Source revision under test: `a65ef62b267bf7b3163bc0951035d4311443940a`
  plus the isolated test diff recorded in this file.
- Existing unrelated dirty paths were preserved and were not staged.

## Acceptance boundary

This is local source/fixture evidence for the claim-alignment portion of
TASK-201. Registry status and all GOAL counters remain unchanged. Production
query budgets, SLO/alert ownership, representative scale, encrypted restore,
capacity/failover and reconciliation runbooks remain open under TASK-201 and
its TASK-199 dependency.

## Checkpoint record

| Checkpoint | Actual output | Result |
| --- | --- | --- |
| S1 | Existing telemetry source and queue specs inspected | Pass (prior evidence) |
| S2 | Four queue families exercised against claim predicates | Pass |
| S3 | Production alert/SLO ownership | Not run — external prerequisite |
| S4 | Production scale/restore/failover | Not run — external prerequisite |
| S5 | Owner review and production acceptance | Not run — external prerequisite |
