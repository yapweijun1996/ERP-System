# TASK-234 — STATUS current/history boundary reconciliation

- Date: 2026-09-13 (Asia/Singapore)
- Revision: `d936a348e50d0b9edf7718ac1eadba1f5a17a4b6`
- Environment: local documentation worktree, 47 pre-existing dirty paths preserved
- Actor: Codex engineering run
- Evidence class: documentation consistency; no runtime, provider, database or deployment claim

## Expected result

`docs/STATUS.md` must distinguish the current hosted Pages result from the
pre-publication bundle snapshot. A historical candidate handoff must not read as
if publication or hosted upload verification is still pending after the
authorized d936a348 release.

## Actual result

The STATUS top section now labels the `976a863e...` Pages entry as a historical
pre-publication recheck and links its current replacement to the hosted
no-override verification above. The capability-envelope handoff now states that
it records the local candidate before publication; the later hosted publication
and upload result supersede those two release gaps. Real provider/OCR and human
business acceptance remain explicitly separate.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npm run docs:check` | All local Markdown links resolve | Passed: 122 Markdown files / 854 local links |
| GOAL count validator | Registry and checklist invariants remain valid | Passed: 227/240 Done, 31/48 criteria, 43/60 checkpoints; no dependency-ready Todo |
| Root Markdown/link review | Root goal/progress/prompt links remain valid | Passed in the current documentation baseline |
| `git diff --check` | No whitespace errors | Passed |
| conflict scan and `git ls-files -u` | No merge conflict markers or unmerged paths | Passed |

No source code, generated schema, tenant state, provider request, approval,
secret, deployment or registry status changed.
