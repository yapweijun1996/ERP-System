# TASK-199 — Availability verification and rollback handoff

Date: 2026-09-13, Asia/Singapore. This record covers a local source and
fixture increment for TASK-199. It does not promote production alerting,
incident ownership or rollback acceptance.

## Selected gap and expected result

The existing candidate work covered the source-side operational boundary but was
uncommitted. The expected result was a focused commit that:

- releases or cancels verifier response bodies on early URL/size/stream failures;
- emits fixed-message, secret-free healthy/degraded availability events with
  stable SHA-256 dedupe keys;
- keeps alert delivery default-deny, HTTPS host-allowlisted, bounded and
  response-cleaning; and
- validates immutable application image digests, requires explicit rollback
  confirmation, recreates only api/web/calendar-worker and preserves database and
  document volumes.

## Observed result

Commit `07172fa5c92e9ccd4dbd853514f2c96adaa08b99`
(`Harden availability verification and rollback handoff`) contains exactly
eight TASK-199 source/test files. The focused regression passed 4 files / 37
tests. Invalid CLI values, verifier transport details, sink response details
and fixture authorization are not echoed. The rollback execution fixture
confirmed that the Compose command contains only `api`, `web` and
`calendar-worker` with `--no-build --force-recreate --no-deps`, and removes
the temporary override.

## Verification and provenance

- Actor: Codex on local macOS, root `main`, Asia/Singapore.
- Before commit: HEAD `736197c97c2537e41336e0cb76ac6c5762664670`; 58 existing
  dirty paths were preserved (40 tracked, 18 untracked). The eight staged paths
  were isolated from unrelated edits.
- After commit: HEAD `07172fa5c92e9ccd4dbd853514f2c96adaa08b99`; 50 existing dirty
  paths remain (38 tracked, 12 untracked), with no unmerged paths.
- Focused regression:
  `npm test -- --run scripts/verify-release.test.ts scripts/check-availability.test.ts scripts/check-availability-alert.test.ts scripts/rollback-release.test.ts --reporter=dot`
  — **4 files / 37 tests passed**.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:web`,
  `npm run demo` and `npm run build:demo` — pass. Demo ran without a
  `POSTGRES_URL`; no PostgreSQL claim is made. Build output contains only the
  existing Vite classic-script, browser-external/eval, missing-static-asset and
  chunk-size warnings.
- No public endpoint, alert sink, provider credential, production database,
  container, rollback command or secret was used.

## Acceptance boundary

This is local source/fixture/Demo evidence. TASK-199 still requires an approved
alert sink, named incident responder, delivered production alert, exercised
production rollback and owner acceptance. The source commit does not change
registry, GOAL criterion, execution checkpoint or capability counts.

## Documentation reconciliation

After the source commit, `npm run docs:check` passed 87 Markdown files and
805 local links. The root `GOAL.md`, `PROGRESS.md` and `GOAL_PROMPT.md`
link/fragment review passed 3 files / 175 local links / 0 missing. The exact GOAL
count validator remained 227 done, 6 in progress, 4 todo and 3 blocked across
240 tasks, with 31/48 criteria, 41/60 checkpoints and no dependency-ready Todo.
`git diff --check` and the conflict-marker scan passed.
