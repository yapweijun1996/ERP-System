# TASK-233 — Bind agent execution to approval and business evidence

Goal: **G06** · Initial status: **Todo** · Priority: **P0**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-228, TASK-232**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G06 criteria plus common DoD remain required for task completion.

## Outcome and scope

Implement server-owned confirmation/approval binding for Agent actions. Pack generation confirmation is not tax approval or a new business approver role. Existing human workflows retain their contracts.

## Read these existing files first

- [src/modules/expenses/companyReceiptPack.ts](../../src/modules/expenses/companyReceiptPack.ts)
- [src/modules/expenses/companyReceiptPackGovernance.ts](../../src/modules/expenses/companyReceiptPackGovernance.ts)
- [src/api/routes/companyReceipts.ts](../../src/api/routes/companyReceipts.ts)
- [src/api/audit.ts](../../src/api/audit.ts)
- [src/data/tenantTransaction.ts](../../src/data/tenantTransaction.ts)
- [src/data/schema/approval.ts](../../src/data/schema/approval.ts)
- [src/modules/expenses/companyReceiptPack.test.ts](../../src/modules/expenses/companyReceiptPack.test.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

G01 preparation must be non-authorizing. Bind execution to the complete reviewed set of receipt IDs/versions/document hashes, filters, currency totals, locale, actor, Company and action, not only filters. A newly eligible row also invalidates the reviewed selection. Existing createCompanyReceiptPackWithin replays an immutable Pack for the same packKey; preserve that behavior.

## Execute in this order

- [x] **S1 — Define effect and approval policy.**

  Action: Classify each pilot action: read, preparation, confirmed creation, export. Exclude purge/legal-hold/financial posting from pilot tools. Identify existing approval authority for future actions without granting the Agent self-approval.

  Checkpoint exit: A policy table specifies who may confirm what and the exact no-mutation boundary before confirmation.

  Evidence: [TASK-233 S1 evidence](evidence/TASK-233-2026-09-09.md#s1--effect-and-approval-policy).

- [x] **S2 — Bind preparation to exact intent.**

  Action: Persist or securely reference the normalized reviewed facts/digest and expiration under actor/Company scope. Implement approve/reject/cancel and a separately supplied execution intent key. Do not use an unverified UI boolean or model prose as approval.

  Checkpoint exit: Tampered payload, changed filters, changed record/version, added matching row or expired preparation is rejected.

  Evidence: [TASK-233 S2 evidence](evidence/TASK-233-2026-09-09.md#s2--exact-intent-persistence-and-expiry-binding).

- [x] **S3 — Execute once with consistent facts.**

  Action: Recheck live authorization and approval inside the execution boundary. Ensure the persisted Pack matches the reviewed selection even under concurrent insert/edit; a check followed by an unconstrained selection is insufficient. Use locking/isolation or a guarded expected-digest contract owned by the domain.

  Checkpoint exit: Race tests prove either the exact approved Pack commits or nothing commits; duplicate retries create no second Pack.

  Evidence: [TASK-233 S3 evidence](evidence/TASK-233-2026-09-09.md#s3--execute-once-with-consistent-facts).

- [x] **S4 — Handle replay and human corrections.**

  Action: After a committed result, a same-intent retry returns the original result after current authorization checks; do not require a fresh approval to discover an already committed effect. Changed-payload reuse conflicts. Corrections use existing governed commands, never delete evidence.

  Checkpoint exit: Dropped-response replay, cancel/reject, expired grant, changed approval and correction cases have deterministic outcomes.

  Evidence: [TASK-233 S4 evidence](evidence/TASK-233-2026-09-09.md#s4--handle-replay-and-human-corrections).

- [x] **S5 — Verify all negative paths.**

  Action: Run existing Pack/API regression plus approval/concurrency tests and common gates. Show exact reviewed versus persisted identities and resulting artifact; record evidence links for each G06 criterion.

  Checkpoint exit: P06-P12 pass with zero unauthorized business writes and preserved audit history.

  Evidence: [TASK-233 S5 evidence](evidence/TASK-233-2026-09-09.md#s5--verify-all-negative-paths).

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G06.1:** Define server-enforced action classes for read, draft, confirmed execution and approval-required execution; reuse existing business approval authority.
  - Required evidence: Effect/approver policy and unchanged human behavior.
  - Current result: S1 policy is defined in the server action catalogue; S2 adds the server-owned exact-intent record/decision boundary; S3 connects only an approved intent to the authenticated Agent Pack command while the human Company Receipt route remains unchanged; S4 preserves that boundary across replay, approval change and current-grant rechecks; S5 completes the negative-path and browser/API regression evidence.
- **G06.2:** Bind confirmation/approval to actor, Company, exact payload digest, resource version and expiry; changed facts invalidate approval.
  - Required evidence: Exact payload/selection/version/expiry binding.
  - Current result: S2 binds the active Company, accountable actor, Agent principal, normalized Pack payload, selected receipt/document versions, selection/resource digests and server TTL. S3 rechecks the principal/grant/approval boundary, locks source rows and inserts the exact reviewed selection without unconstrained reselection; S4 rejects changed payload digests before replay; S5 confirms the boundary through the complete negative-path matrix and persisted artifact checks.
- **G06.3:** Prove cancel, reject, stale version, concurrent execution and timeout replay cause no unauthorized or duplicate side effect; preserve segregation of duties.
  - Required evidence: Concurrent-change, cancel/reject and no-duplicate commit assertions.
  - Current result: S2 covers human-only approve/reject/cancel, stale version, changed-facts and expiry rejection. S3 covers duplicate execution serialization plus concurrent edit/insert outcomes with exact Pack-or-no-Pack assertions. S4 covers pre-commit cancel/reject, changed approval replay, expired grant denial, changed-payload conflict and governed correction; S5 confirms P06-P12 with zero unauthorized or duplicate business writes.
- **G06.4:** Show the resulting document/version and before/after business impact; route corrections of governed records through existing reversal or append-only mechanisms.
  - Required evidence: Replay result and governed correction evidence.
  - Current result: S3 persists the exact reviewed receipt/document identities and replays the immutable Pack after a source correction; S4 records the governed correction before/after and append-only audit outcome; S5 verifies the authenticated Preview/PDF/Print artifact path and the complete persisted result.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/modules/expenses/companyReceiptPack.test.ts src/api/companyReceipts.integration.test.ts
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

If exact-selection confirmation cannot be made atomic with Pack creation, leave execution unavailable and record the race; do not compensate with a client-side comparison.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
