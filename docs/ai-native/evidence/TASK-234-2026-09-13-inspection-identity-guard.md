# TASK-234 — Pilot inspection identity guard

Date: 2026-09-13, Asia/Singapore. This is local source and fixture evidence for
the Receipt inspection completeness procedure. It does not promote G07.3, an
execution checkpoint, a real-provider call, production readiness or human
acceptance.

## Identity and scope

- Task / gap: TASK-234 receipt inspection completeness; one-to-one preview/detail identity matching.
- Revision: `9cea460` (`Harden receipt pilot inspection identity checks`).
- Source: `src/pilot/receiptPilot.ts` SHA-256 `fa934527955d03afe392e457110309c2af09a310789546a0526db681b831106d`.
- Test: `src/pilot/receiptPilot.test.ts` SHA-256 `dff71ca08e6052cefd02e3a98d893d616bcf3fed8d99d6622cb389de2aef523f`.
- Actor/environment: Codex, local Node/Vitest and fresh disk-backed PGlite fixture; synthetic `M1/C-SG` and `M1/C-MY` only.
- Dirty-worktree state: unrelated tracked and untracked changes were preserved; only the two source/test files were committed.
- Exclusions: no provider credential, external network model call, production database, deployment, remote write or human viewing was used.

## Gap and repair

`verifyPilotInspection` already compared each preview row with a successful
`receipt.get`, but repeated preview IDs or repeated detail IDs could be reused
to satisfy a universal row check. The guard now requires a non-empty preview
with positive unique receipt IDs, exactly the same number of successful detail
records, positive unique detail IDs, and an exact preview-to-detail identity
set before checking receipt version, document identity/version and SHA-256.
Failed retry attempts remain ignorable when a later successful detail exists;
extra or duplicate successful identities fail closed before confirmation.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npx vitest run src/pilot/receiptPilot.test.ts` | Existing fixture/cancellation/detail cases plus new identity negatives pass | **Pass**, 1 file / 16 tests |
| New negative cases | Duplicate preview, duplicate detail and extra detail reject with `pilot_inspection_missing` | **Pass**, all 3 cases |
| `npx tsx scripts/receipt-assistant-pilot.ts --fixture` | SG fixture inspects every selected row, hashes sources, confirms exact selection and reopens the persisted Pack/PDF | **Pass**, 5 calls, 0 retries, Pack 1, receipts 1/2, `persistedAfterReopen=true`, `sourceFilesHashVerified=true`, `savedPdfVerified=true` |
| `npx tsx scripts/receipt-assistant-pilot.ts --fixture --my` | MY fixture preserves the same governed flow under `C-MY` | **Pass**, 5 calls, 0 retries, Pack 1, receipts 1/2, `persistedAfterReopen=true`, `sourceFilesHashVerified=true`, `savedPdfVerified=true` |
| `npm run lint` | Zero-warning lint | **Pass**, exit 0 |
| `npm run typecheck` / `npm run typecheck:web` | Root and Web TypeScript checks | **Pass**, both exit 0 |
| `env -u POSTGRES_URL npm run demo` | Isolated PGlite Demo parity and rollback checks | **Pass**, all checks passed; no PostgreSQL URL configured |
| `npm run build:demo` | Demo bundle builds from the current source | **Pass**, exit 0; existing classic-script, missing-static-asset, PGlite externalization/eval and large-chunk warnings remain |
| `npm run test:e2e:receipt-assistant` | Receipt Assistant desktop/mobile state, cancellation/recovery, scope, five locales, themes, focus and overflow | **Pass**, desktop and mobile cases completed without browser errors |
| `npm run docs:check` | Markdown link validation | **Pass**, 96 Markdown files / 822 local links |
| Root Markdown review (`GOAL.md`, `PROGRESS.md`, `GOAL_PROMPT.md`) | Root links and fragments resolve | **Pass**, 3 files / 188 local links / 0 missing |
| `git diff --check` and conflict scan | No whitespace errors, unmerged paths or conflict markers | **Pass**, 0 unmerged paths and 0 markers |

The SG and MY CLI runs used the deterministic local provider fixture, reported
synthetic cost estimates only and wrote private temporary evidence directories.
Both runs recorded `humanViewedSources=false` and `humanViewedPdf=false`.

## Acceptance delta and remaining gap

The local inspection predicate now rejects empty, duplicate and mismatched
identity sets before approval while preserving the existing tenant, document
permission, source-byte hash and Pack command boundaries. This closes a local
pilot-orchestration robustness gap; it does not change task, criterion or
checkpoint counts. The same-run real server/provider run, production OCR and
human visual/business acceptance remain open under the existing TASK-234 gate.

## Reproducibility and handoff

- Targeted test command: `npx vitest run src/pilot/receiptPilot.test.ts`.
- Fixture commands: `npx tsx scripts/receipt-assistant-pilot.ts --fixture` and
  `npx tsx scripts/receipt-assistant-pilot.ts --fixture --my`.
- Required follow-up gates for this code change: root/Web typecheck, lint,
  isolated Demo, Demo build, affected Receipt Assistant browser regression,
  documentation/link review and `git diff --check`.
- No task/goal/checkpoint checkbox was changed. The next measurable exit remains
  an authorized same-run provider execution with separately recorded usage and
  operator/business review.
