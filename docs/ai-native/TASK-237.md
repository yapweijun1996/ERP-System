# TASK-237 — Establish agent safety evaluations and audit observability

Goal: **G10** · Initial status: **Todo** · Priority: **P0**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-229, TASK-230, TASK-231, TASK-234, TASK-235, TASK-236**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G10 criteria plus common DoD remain required for task completion.

## Outcome and scope

Build repeatable Agent evaluation and release evidence. Deterministic security/transaction checks must not be averaged away by a high model success score.

## Read these existing files first

- [vitest.config.ts](../../vitest.config.ts)
- [package.json](../../package.json)
- [tests/e2e/company-receipts-api.spec.ts](../../tests/e2e/company-receipts-api.spec.ts)
- [src/modules/expenses/companyReceiptPack.test.ts](../../src/modules/expenses/companyReceiptPack.test.ts)
- [src/api/audit.ts](../../src/api/audit.ts)
- [src/worker/telemetry.ts](../../src/worker/telemetry.ts)
- [docs/TEST_COVERAGE.md](../../docs/TEST_COVERAGE.md)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Each scored case has a versioned input fixture, expected permitted actions and independently queried postconditions. Evaluate the recorded result, not the model's self-assessment. A valid test-case denominator excludes negative cases only from the positive success metric, never from safety pass requirements.

## Execute in this order

- [ ] **S1 — Freeze case set and evaluator.**

  Action: Create at least 30 distinct valid pilot cases plus the negative matrix. Version fixture/model/prompt/tool configuration and define success before running. Include Company, locale, empty/boundary/mixed-currency and access variations.

  Checkpoint exit: The evaluator independently detects wrong IDs, unauthorized data, duplicate Pack and false-success claims.

  Evidence: Not run.

- [ ] **S2 — Automate deterministic and adversarial gates.**

  Action: Run P01-P16 where applicable, prompt-injection and malicious-tool cases. Require 100 percent pass for each security/transaction invariant and zero false success. No allowlist may suppress an unexplained failure.

  Checkpoint exit: Deliberately broken fixture variants fail the gate and return nonzero exit status.

  Evidence: Not run.

- [ ] **S3 — Run three recorded model evaluations.**

  Action: Use the same frozen set in three separate runs, each with at least 30 valid cases and at least 95 percent verified success (at least 29/30 when using 30). Record failures and all retries/cost; do not report only the best run.

  Checkpoint exit: Each run independently meets the threshold; negative tests pass separately; fixtures are distinguished from live model results.

  Evidence: Not run.

- [ ] **S4 — Measure observability and budgets.**

  Action: Correlate run, grant, approval, tool, database and artifact evidence using redacted identifiers. Fix numerical p95/cost/call/concurrency thresholds with accountable owners before the release gate and measure them.

  Checkpoint exit: Per-run reports contain latency and full retry cost; missing approved budgets keep the operational gate open.

  Evidence: Not run.

- [ ] **S5 — Exercise release regression and disable.**

  Action: Integrate the verified evaluator into the actual CI path. Change a test prompt/tool/model version to demonstrate a failed candidate is rejected and the previous version can remain active. Exercise emergency disable.

  Checkpoint exit: G10 includes real CI execution, evaluator failure detection and rollout/disable evidence.

  Evidence: Not run.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G10.1:** Version a receipt-pilot evaluation set with happy paths, invalid input, prompt injection, unauthorized data access, stale approval, revocation and retry scenarios.
  - Required evidence: Frozen valid/negative cases and independent oracle.
  - Current result: Not run.
- **G10.2:** Require every deterministic authorization/transaction invariant to pass and zero false-success results; achieve at least 95 percent verified success in each of three recorded runs, each containing at least 30 valid pilot cases.
  - Required evidence: Three per-run success denominators and all invariants.
  - Current result: Not run.
- **G10.3:** Record redacted run/model/tool versions, correlation IDs, approvals, resource postconditions, latency and full retry cost; never log secrets or unnecessary sensitive payloads.
  - Required evidence: Redacted traces, latency and total retry cost.
  - Current result: Not run.
- **G10.4:** Gate model/prompt/tool changes on the same evaluations, record environment and evidence artifacts, and exercise a failed rollout plus emergency disable.
  - Required evidence: CI regression failure, rollback/disable evidence.
  - Current result: Not run.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/modules/expenses/companyReceiptPack.test.ts src/worker/telemetry.test.ts
npm run test:e2e:company-receipts-api
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

Missing provider/budget/CI access leaves that evidence open. Do not replace live model or CI results with hand-written passing JSON.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
