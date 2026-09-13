# TASK-237 S4 — Provider scope and operational budget handoff

## Identity and boundary

- **Task / goal:** TASK-237 / G10.
- **Checkpoint:** S4 remains unchecked; this record prepares the required owner decision.
- **Date:** 2026-09-13 (Asia/Singapore).
- **Source revision:** `b695a833ace3983149dd3728bbb1124fd010b250` on
  `codex/receipt-pilot-release-20260913`.
- **Working-tree boundary:** The root worktree contains unrelated tracked and
  untracked changes. They were preserved and are not part of this handoff.
- **Actor:** Codex engineering run.
- **Evidence classes:** local PGlite fixture and hosted Demo query-only results.
  No production provider, account, secret, or raw receipt payload is included.

## Expected result

An accountable platform/finance owner and the evaluation owner must provide a
reviewable provider/model/data-policy scope and numerical p95 latency, full retry
cost, provider-call and concurrency budgets. The approved values must be stored
by the existing server-owned configuration/decision process as a redacted
reference. A subsequent run can then call the existing
`assertReceiptPilotObservabilityGate()` and retain a live redacted report.

## Measured facts available for the decision

| Evidence class | Run | Observed facts | What it does not prove |
| --- | --- | --- | --- |
| Local fixture | C-SG and C-MY | 5 provider calls, 0 retries, `fullRetryCostMicros=280`, p95 latency 234 ms and 255 ms; Receipt, Pack and artifact postconditions verified | A real provider, production latency/cost or approved budget |
| Hosted Demo | Three query-only runs | 30/30, 30/30 and 29/30 verified proposals; 30, 30 and 31 calls; p95 latency 7,639–8,626 ms; retries 0/0/1 | Receipt-action execution, provider billing, production retention or human acceptance |

These observations are inputs for review only. They are not proposed budgets and
must not be copied into an `approved` budget object without owner authorization.

## Required owner decision

Record all fields below in the approved configuration or decision record. Keep
provider credentials outside the repository and browser bundle.

| Required field | Current state | Owner output needed |
| --- | --- | --- |
| Provider and model allowlist | Pending | Provider/model identifiers and approved configuration location |
| Data region and allowed-use policy | Pending | Region, retention/use policy and receipt-data handling boundary |
| p95 latency budget (ms) | Pending | Positive integer threshold and accountable owner |
| Full retry cost budget (micros) | Pending | Positive integer threshold and currency/accounting interpretation |
| Maximum provider calls per run | Pending | Positive integer threshold including retries |
| Maximum observed concurrency | Pending | Positive integer threshold and capacity owner |
| Approval reference | Pending | Redacted decision reference bound to the values above |

## Current gate and unblock action

The report validator intentionally returns `budgetReady=false` for the pending
state, and `assertReceiptPilotObservabilityGate()` fails with
`receipt_pilot_observability_gate_failed:approved_budget_required`. This is the
expected fail-closed result.

Unblock action: the platform/finance owner supplies the approved scope, policy,
thresholds and redacted reference; the evaluation owner then runs the configured
provider in an authorized environment, captures live redacted cost/retry traces,
and verifies the report against all four thresholds. Production rollout,
retention and emergency-disable observation remain a separate S5 gate.

## Verification

| Command | Expected | Actual |
| --- | --- | --- |
| `npx vitest run src/pilot/evaluationObservability.test.ts --reporter=dot` | Redaction, retry-cost and pending-budget behavior pass | 1 file / 4 tests passed |
| `npm run check:receipt-pilot-evaluation` | Deterministic safety gate remains green | 30/30 valid, 9/9 negative, zero safety failures and zero false-success results |
| `npm run check:receipt-pilot-rollout` | Candidate rejection and post-disable blocking remain enforced | Baseline preserved, valid candidate accepted, post-disable rollout returned `receipt_pilot_release_disabled` |
| `npm run docs:check` | Local Markdown links remain valid | 130 Markdown files / 879 local links passed |
| `git diff --check` | No whitespace errors | Passed |

## Acceptance impact

This handoff makes the missing owner input explicit and reviewable. It does not
check S4, open the operational budget gate, change TASK-237 status, or change any
GOAL count. No secret, raw identifier or receipt content was recorded.
