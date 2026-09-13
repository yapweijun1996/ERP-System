# TASK-234 project-logic reconciliation — 2026-09-13

## Scope

Documentation-only reconciliation of the human-readable project-logic mirror.
The change removes a stale present-tense publication blocker from a dated
pre-publication record and adds the verified terminal remote-CI boundary beside
the current hosted publication entry.

## Identity and environment

- Revision: `d936a348e50d0b9edf7718ac1eadba1f5a17a4b6`
- Environment: local dirty root worktree; source and production worktrees were not changed
- Actor: Codex
- Evidence date: `2026-09-13` (`Asia/Singapore`)

## Expected result

`docs/PROJECT_LOGIC.md` should distinguish historical pre-publication findings
from the later hosted publication and terminal CI facts, without changing domain
behavior, task status or acceptance counts.

## Actual result

- The old 1440px no-upload finding is explicitly labelled as a
  pre-publication checkpoint and linked to the superseding hosted no-override
  evidence.
- The terminal CI success for run `34730030719` and revision `d936a348` is
  recorded with its separate production/provider/human acceptance boundary.
- GOAL, PROGRESS, STATUS and TASK-234 packet counts and statuses are unchanged.

## Verification

`npm run docs:check`, the GOAL count validator, root Markdown link review,
`git diff --check`, staged diff check and conflict-marker/unmerged-path checks
pass. No source, database, provider, deployment or permission state changed.
