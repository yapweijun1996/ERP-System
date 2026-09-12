# TASK-237 S4 — Redacted observability report contract

Date: 2026-09-13 (Asia/Singapore)

Code revision: working tree after `fa3a3977d4375f00bea0123e995d46f9206d2dd6`.

Evidence class: local source and focused unit-test evidence. This record does not
claim a live provider run, approved production budget, PostgreSQL execution, or
release acceptance.

## Expected result

The Receipt Pilot report contract must carry versioned fixture/model/prompt/tool
metadata, redacted run/request/grant/approval/tool/database/artifact correlations,
approval state, resource postconditions, elapsed/provider/p95 latency, provider
calls, retries, known spend, retained reservations, conservative full retry cost,
observed concurrency, and owner/budget state. Raw tenant identifiers, credentials,
payloads and other sensitive fields must be rejected before persistence.

## Implementation

`src/pilot/evaluationObservability.ts` provides, and `src/pilot/receiptPilot.ts`
now embeds the resulting report in each successful `evidence.json`:

- `redactReceiptPilotIdentifier()` for SHA-256 correlation/resource identifiers;
- `createReceiptPilotObservabilityReport()` for constructing a report without
  storing raw identifiers;
- `validateReceiptPilotObservabilityReport()` for strict shape, redaction,
  postcondition, metric and budget validation;
- `assertReceiptPilotObservabilityGate()` which remains closed until an accountable
  owner supplies numerical approved latency, cost, provider-call and concurrency
  thresholds.

`fullRetryCostMicros` is derived as the maximum of known spend and retained
reservations. This preserves the AI runtime rule that a dispatched call with an
unknown final charge cannot be released merely to permit a retry.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npm test -- --run src/pilot/evaluationObservability.test.ts` | Redaction, cost reconciliation, budget blocking and overrun tests pass | 4 tests passed |
| `npm test -- --run src/pilot/evaluationObservability.test.ts src/pilot/evaluationCases.test.ts src/pilot/receiptPilot.test.ts src/modules/agent/aiRuntime.test.ts` | Focused pilot/runtime regression remains green | 4 files / 39 tests passed before report embedding; the post-embedding pilot/observability regression is 2 files / 20 tests passed |
| `npm run typecheck` | Root TypeScript contract compiles | Passed |
| `npm run lint` | Zero ESLint errors and warnings | Passed |
| Pending budget report | Operational gate stays closed | `receipt_pilot_observability_gate_failed:approved_budget_required` |
| Approved budget within thresholds | Gate opens only with redacted approval reference | Passed in focused test |
| Under-reported retry cost | Report is rejected | `metric_full_retry_cost` |

The test input uses symbolic local identifiers only. No provider key, tenant
identifier, receipt payload, or production trace was written. S4 remains open for
the missing owner-approved numerical budgets and measured runs; this contract is
the local implementation increment that makes the missing evidence explicit.
