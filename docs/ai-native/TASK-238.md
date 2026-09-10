# TASK-238 — Close the selected ERP business journeys and market acceptance gaps

Goal: **G11** · Initial status: **Todo** · Priority: **P1**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-227**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G11 criteria plus common DoD remain required for task completion.

## Outcome and scope

Define and implement the explicitly approved release business scope. This is a scope-sensitive expansion task, not permission to claim every ERP module or SG/MY statutory integration complete.

## Read these existing files first

- [docs/ERP_QUALITY_BASELINE.md](../../docs/ERP_QUALITY_BASELINE.md)
- [docs/LOCALIZATION.md](../../docs/LOCALIZATION.md)
- [docs/TAX_OWNER_REVIEW_2026-09-07.md](../../docs/TAX_OWNER_REVIEW_2026-09-07.md)
- [src/modules/finance/bankReceipt.ts](../../src/modules/finance/bankReceipt.ts)
- [src/modules/finance/paymentVoucher.ts](../../src/modules/finance/paymentVoucher.ts)
- [src/modules/finance/bankReceipt.test.ts](../../src/modules/finance/bankReceipt.test.ts)
- [src/modules/finance/paymentVoucher.test.ts](../../src/modules/finance/paymentVoucher.test.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Existing bankReceipt and paymentVoucher support bounded settlement paths. Ordinary sales allocation, partial payments, installments and statutory outputs require explicit business contracts. Start with source-backed capability mapping; do not use model judgment to choose accounting treatment.

## Execute in this order

- [x] **S1 — Inventory included and missing journeys.**

  Action: Map order-to-cash, procure-to-pay, record-to-report, inventory, HR/leave/payroll and receipt evidence to source, tests and unverified stages. Label implemented/local-only/production-proven/excluded explicitly.

  Checkpoint exit: Every claimed release journey has an owner and source/test evidence rather than a screen count.

  Evidence: [TASK-238/S1 source-backed capability matrix](evidence/TASK-238-2026-09-09.md#cross-module-capability-matrix).

- [ ] **S2 — Obtain the minimum product decisions.**

  Action: Present a concrete proposed v1 allocation/partial-payment policy with examples, currency/rounding/overpayment/reversal rules and excluded installments. Ask only for unresolved business choices. Separately identify per-client SG/MY statutory applicability with the qualified owner.

  Checkpoint exit: Owner-approved scope and accounting examples exist before monetary implementation; no fabricated sign-off.

  Evidence: [TASK-238/S2 proposed settlement/applicability decisions](evidence/TASK-238-2026-09-09.md#s2--proposed-settlement-and-market-applicability-decisions-not-approved). Owner approval and qualified tax-owner applicability are still required.

- [ ] **S3 — Implement approved settlement slice.**

  Action: Extend the owning domain commands/schema/API/UI with version/idempotency checks, transaction and audit boundaries. Preserve Project Progress Claim behavior and existing supplier settlement semantics.

  Checkpoint exit: Tests reconcile invoice balance, bank amount, AR/AP and balanced GL for partial, final and reversed payments.

  Evidence: Not run.

- [ ] **S4 — Verify applicable market outputs.**

  Action: For each actually included statutory/e-invoice integration, use the official current sandbox contract and authorized account. Prove submit, reject, correct/cancel and reconcile with idempotent retry. If excluded, record scope explicitly without claiming compliance.

  Checkpoint exit: Included outputs have sandbox and qualified-owner evidence; TASK-204 remains a distinct production configuration gate.

  Evidence: Not run.

- [ ] **S5 — Demonstrate complete selected journeys.**

  Action: Run domain/API/UI positive and negative paths with approved fixtures. Record remaining exclusions as linked tasks without weakening existing DoD or marking partially delivered scope complete.

  Checkpoint exit: G11 contains actual approved implementation and full included-journey evidence, not only a capability matrix.

  Evidence: Not run.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G11.1:** Publish an owner-reviewed capability matrix for order-to-cash, procure-to-pay, record-to-report, inventory, HR/leave/payroll and receipt/evidence flows with explicit exclusions.
  - Required evidence: Owner-reviewed cross-module capability matrix.
  - Current result: Source-backed matrix published in S1; engineering owner roles and exclusions are recorded, but product-owner/qualified-tax-owner review is not yet recorded.
  - Evidence: [TASK-238/S1 matrix](evidence/TASK-238-2026-09-09.md#cross-module-capability-matrix).
- **G11.2:** Define and implement the approved v1 settlement scope, including ordinary sales receipt allocation and partial-payment behavior, with stock/AR/AP/GL reconciliation and reversal tests.
  - Required evidence: Implemented approved settlement with reconciled accounting.
  - Current result: Not run.
- **G11.3:** Record per-client SG/MY applicability and required statutory/e-invoice outputs; any claimed integration must pass sandbox submission, rejection/correction/cancellation and status reconciliation plus owner approval.
  - Required evidence: Per-client applicability and evidence for every claimed integration.
  - Current result: Not run.
- **G11.4:** Demonstrate each included release journey through real UI and authenticated APIs with permission, duplicate, stale-version and failure rollback coverage; register excluded later scope explicitly.
  - Required evidence: Real UI/API included-journey and rollback/regression evidence.
  - Current result: Not run.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/modules/finance/bankReceipt.test.ts src/modules/finance/paymentVoucher.test.ts
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

Stop affected accounting or statutory implementation until missing product/qualified-owner decisions arrive. Continue source mapping or unrelated eligible tasks; do not silently label the entire task Done after documentation.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
