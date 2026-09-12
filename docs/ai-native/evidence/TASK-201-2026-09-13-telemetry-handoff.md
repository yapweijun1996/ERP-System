# TASK-201 — Bounded worker telemetry handoff

Date: 2026-09-13, Asia/Singapore. This record covers a local source and
fixture increment for TASK-201. It does not claim an approved production SLO,
representative scale, operational alert delivery, backup/restore or failover.

## Selected gap and expected result

The existing TASK-201 candidate added aggregate duration and an optional query
budget but was still uncommitted. The expected result was a focused source
handoff that:

- records `queryDurationMs` on aggregate-only primary and calendar snapshots;
- applies an optional `WORKER_TELEMETRY_QUERY_TIMEOUT_MS` only inside the
  worker's transaction and clamps it to 1–120,000 ms;
- keeps document `ready` counts aligned with actual claimable statuses and
  calendar connection joins tenant-scoped; and
- provides a read-only NDJSON validator with explicit budget classification,
  bounded input and record sizes, aggregate-only field allowlists and no
  payload/secret echoing.

## Observed result

Commit `6f0d7d2` (`Add bounded worker telemetry handoff`) contains nine focused
source/configuration/test files. It also wires the already committed availability
checks into npm scripts. The worker keeps single-flight, non-blocking emission;
the timeout is transaction-local and unset by default. The validator accepts a
literal `-` stdin marker, rejects malformed or sensitive records, and returns
only bounded status/count/duration fields.

During verification, the documented stdin form initially failed because `-`
was treated as an unknown option. The parser now tracks whether a single input
was supplied and accepts the explicit stdin marker; the regression covers this
pipeline path.

## Verification and provenance

- Actor: Codex on local macOS, root `main`, Asia/Singapore.
- Before commit: HEAD `da5b2cc6e6b7b826b3c3f69de1d69c62c0bf5c29`; 50 existing
  dirty paths were preserved. The nine staged paths were isolated from those
  unrelated edits.
- After commit: HEAD `6f0d7d2`; 41 existing dirty paths remain (no unmerged
  paths). `main` is 12 commits ahead of `origin/main`.
- Focused regression:
  `npm test -- --run src/worker/telemetry.test.ts scripts/validate-worker-telemetry.test.ts --reporter=dot`
  — **2 files / 14 tests passed**.
- CLI smoke:
  `npm run check:worker-telemetry -- --max-query-ms 10 -` with a synthetic
  eight-queue record — **valid**, one record, maximum duration 8 ms, budget
  within 10 ms. The output did not include the worker identifier or queue data.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:web`, `npm run demo`,
  `npm run build:demo` and `git diff --check` — pass. Demo ran without a
  `POSTGRES_URL`; no PostgreSQL claim is made. Build output contains the
  repository's existing Vite classic-script, browser-external/eval, missing
  static-asset and chunk-size warnings.
- No provider credential, production database, alert sink, deployment,
  rollback command or secret was used.

## Acceptance boundary

This is local source/fixture/Demo evidence. TASK-201 remains `todo` because
TASK-199 is still in progress and the remaining acceptance requires an owner
approved query/SLO budget, representative 100–800 GB plans and load, alert and
incident ownership, encrypted restore timing, capacity/failover and production
acceptance. No criterion, checkpoint or registry count is promoted.

## Documentation reconciliation

After the source commit, the exact GOAL count validator remained 227 done,
6 in progress, 4 todo and 3 blocked across 240 tasks, with 31/48 criteria,
41/60 checkpoints and no dependency-ready Todo. The task-registry fingerprint
remained `aaa7dabbab59f42ec1c4ae1c705aaa259ad7e2f85b6f57824a42c04ab23e86de`.
Documentation gates after the record was added were also persisted: `npm run
docs:check` passed 88 Markdown files / 807 local links; the root
`GOAL.md`/`PROGRESS.md`/`GOAL_PROMPT.md` link-and-fragment review passed 3 files /
176 local links / 0 missing; `git diff --check` and conflict-marker scan passed.
