# TASK-237 — Local rollout and emergency-disable probe — 2026-09-13

## Scope

This record proves the local release-probe behavior wired to the Receipt Pilot
deterministic evaluator. It is a source-level and local-runtime increment for S5;
it does not claim a remote CI run, a production rollout, or a live provider/model
evaluation.

## Evidence record

- **Verification revision:** `d936a348e50d0b9edf7718ac1eadba1f5a17a4b6` (probe changes were verified in the shared dirty worktree before packaging)
- **Environment:** local Node.js/tsx deterministic evaluator; no database, browser, provider, or deployment state changed
- **Actor:** Codex
- **Expected:** the same evaluator rejects a broken candidate; a valid candidate advances the active prompt version; emergency disable blocks later rollout and preserves the disabled state
- **Actual:** `npm run check:receipt-pilot-rollout` passed. Baseline generation 1 was enabled; the broken candidate returned `receipt_pilot_evaluation_gate_failed` and left generation/version unchanged; the valid candidate returned `accepted` at generation 2 with the candidate prompt version; emergency disable returned generation 3 with `enabled=false`; a subsequent rollout returned `receipt_pilot_release_disabled` with no gate execution.
- **Focused tests:** `npm test -- --run src/pilot/evaluationReleaseProbe.test.ts src/pilot/evaluationCases.test.ts` — 2 files, 10 tests passed.
- **Safety boundary:** output contains only version identifiers, states and gate codes. No receipt payloads, credentials, provider tokens, or sensitive identifiers were persisted.

## Limits and next measurable action

S5 and G10.4 remain open until the updated workflow executes in remote CI and a
real rollout/retention/disable observation is recorded. The next measurable action
is to run the unchanged workflow at a revision containing this probe, then capture
the CI run URL and an approved environment's rollout/disable evidence.
