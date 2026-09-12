# TASK-234 — My Receipts authorized capture controls browser regression

Date: 2026-09-13, Asia/Singapore. This record covers the local built-Demo
browser surface for the employee receipt-capture screen. It does not claim
Pages publication, production provider execution or human acceptance.

## Selected gap and expected result

The source-level `{data, meta}` capability regression already guarded the
projection boundary, but the existing immediate-account E2E only checked that
the newly created employee could navigate to My Receipts. The expected browser
result was that the same session renders the authorized capture actions and
their canonical file inputs at desktop and 375px widths, with no console errors
or horizontal overflow.

## Observed result

`tests/e2e/staff-account-immediate.spec.mjs` now waits for exact `Take photo` and
`Choose file` actions after direct employee login, and asserts one camera input
and one file input are present. The existing test also continues to verify
immediate account state, direct identity, credential-handoff denial, activation
removal, clipboard-failure handling, and viewport bounds.

## Verification and provenance

- Actor: Codex on local macOS, root `main`, Asia/Singapore.
- Source baseline: `536783a16c5e90ecb722841d9f15639ce623233f` with the existing
  unrelated dirty worktree preserved.
- Browser command: `node tests/e2e/staff-account-immediate.spec.mjs` — **1280px
  and 375px passed**.
- The run used the built local Demo bundle and synthetic test data. No provider
  credential, production database, deployment, remote write or secret was used.
- The browser assertions exercise the existing `SCREENS['my-receipts']`
  projection; canonical upload and tenant authorization remain unchanged.

## Acceptance boundary

This closes the local browser-visibility regression for the authorized employee
capture surface. TASK-234 remains `in_progress`: hosted no-override release
verification, real server/provider execution and human business acceptance are
separate gates. Task, goal-criterion and execution-checkpoint counts are
unchanged.
