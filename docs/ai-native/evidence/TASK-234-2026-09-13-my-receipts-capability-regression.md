# TASK-234 — My Receipts capability-envelope regression

Date: 2026-09-13, Asia/Singapore. This record covers a local source regression
for the Demo employee receipt-capture surface. It does not claim Pages
publication, production provider execution or business acceptance.

## Selected gap and expected result

The existing source repair in `screens-hr.js` now unwraps the server-derived
`{data, meta}` work-context response before evaluating
`capabilities.receipts.writable`. The remaining candidate work was an untracked
regression test for that boundary. The expected result was:

- an authorized employee context exposes camera capture, file upload and draft
  sync actions;
- a context without `data.capabilities.receipts.writable` exposes none of those
  write controls, even if a legacy top-level `capabilities` object claims write
  access; and
- the test remains isolated to the screen projection and does not bypass the
  canonical upload command or tenant authorization.

## Observed result

`src/myReceiptsScreen.test.ts` evaluates the actual vanilla-JavaScript
`SCREENS['my-receipts']` source with a bounded adapter/draft-store fixture. The
authorized envelope produced a primary capture action, two toolbar actions and
the hidden file input; its callback invoked the camera input. Both false and
missing `writable` cases produced no primary action, toolbar actions or upload
markup. The legacy top-level capability was intentionally ignored.

## Verification and provenance

- Actor: Codex on local macOS, root `main`, Asia/Singapore.
- Focused regression: `npx vitest run src/myReceiptsScreen.test.ts --reporter=dot`
  — **1 file / 3 tests passed**.
- This is source-level Demo UI evidence. No provider credential, production
  database, deployment, remote write or secret was used.
- The test file was an existing untracked candidate; unrelated tracked and
  untracked work was preserved.

## Acceptance boundary

This closes the local regression risk around the capability response envelope.
TASK-234 remains `in_progress`: hosted release/no-override verification, real
server-provider execution and human business acceptance are separate gates.
The task, goal criteria and execution-checkpoint counts are unchanged.
