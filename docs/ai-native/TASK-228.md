# TASK-228 — Publish governed ERP action contracts

Goal: **G01** · Initial status: **Todo** · Priority: **P0**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-227**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G01 criteria plus common DoD remain required for task completion.

## Outcome and scope

Deliver a small, typed action boundary for the receipt pilot. Do not build MCP transport, an LLM, durable runs or a replacement approval engine in this task.

## Read these existing files first

- [src/api/resources.ts](../../src/api/resources.ts)
- [src/api/routes/companyReceipts.ts](../../src/api/routes/companyReceipts.ts)
- [src/modules/expenses/companyReceipt.ts](../../src/modules/expenses/companyReceipt.ts)
- [src/modules/expenses/companyReceiptPack.ts](../../src/modules/expenses/companyReceiptPack.ts)
- [src/auth/permissionRegistry.ts](../../src/auth/permissionRegistry.ts)
- [src/api/companyReceipts.integration.test.ts](../../src/api/companyReceipts.integration.test.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Keep serializable contracts separate from server code. Suggested new locations (not existing files): src/modules/agent/actionContracts.ts and src/api/agentActions.ts. Receipt selection/snapshot facts remain owned by the expenses module. Preserve current route behavior for existing consumers. Existing Pack creation takes packKey/search/dateFrom/dateTo/locale; it does not accept arbitrary receiptIds or an approval token.

## Execute in this order

- [x] **S1 — Inventory six pilot operations.**

  Action: Map receipt.search, receipt.get, receipt_pack.prepare, receipt_pack.create, receipt_pack.get and receipt_pack.export to the routes/symbols in PILOT_TEST_MATRIX.md. Record current inputs, read-own/read-company scope, mutations and errors. Mark prepare as new; do not call POST /packs to simulate a read-only preview.

  Checkpoint exit: A six-row action map names existing versus planned behavior and excluded operations.

  Evidence: [TASK-228-2026-09-08 evidence](evidence/TASK-228-2026-09-08.md#s1-action-inventory).

- [x] **S2 — Define strict contracts.**

  Action: Specify stable action names/version, JSON input/output schemas, permission requirements, effect class, pagination, error codes and idempotency. Reject unknown tenant/actor authority fields, including nested ones. Preserve decimal strings, currency-separated totals and date-only values. Define preparation as non-authorizing; TASK-233 owns approval and execution binding.

  Checkpoint exit: Schema tests reject invalid dates/limits/tenant fields and accept representative existing receipt/Pack responses.

  Evidence: [TASK-228-2026-09-08 evidence](evidence/TASK-228-2026-09-08.md#s2-strict-contracts).

- [x] **S3 — Implement shared dispatch and preparation.**

  Action: Route authenticated execution through existing transaction/audit/permission boundaries without manufacturing a SessionData from JSON. Extract only genuinely shared Pack selection logic to produce a bounded read-only selection/version digest. Do not widen selection, remove scan checks or duplicate SQL in each adapter.

  Checkpoint exit: Existing API regression remains green; preparation creates no Pack and returns only authorized, versioned evidence.

  Evidence: [TASK-228-2026-09-08 evidence](evidence/TASK-228-2026-09-08.md#s3-authenticated-shared-dispatch-and-preparation).

- [x] **S4 — Prove replay and adapter compatibility.**

  Action: Test valid new Pack creation through the existing path, same-key replay and changed-filter conflict. Use thin test clients against the shared dispatcher to check future adapter input/output compatibility. MCP/WebMCP production transport is deliberately not required here; TASK-229/230 own real interoperability.

  Checkpoint exit: P01-P09 as applicable pass; P10 is specified but approval enforcement remains TASK-233. No real-protocol claim is made from test adapters.

  Evidence: [TASK-228-2026-09-08 evidence](evidence/TASK-228-2026-09-08.md#s4-replay-and-adapter-compatibility).

- [x] **S5 — Verify and publish the boundary.**

  Action: Run the focused command below plus common code gates. Document exact allowed operations, structured failures and preparation limitations. Add source/test links to all G01 evidence; keep any unfinished criterion open.

  Checkpoint exit: Contracts and handlers are implemented and tested; no public Agent mutation is exposed without the later identity/approval gates.

  Evidence: [TASK-228-2026-09-08 evidence](evidence/TASK-228-2026-09-08.md#s5-boundary-publication-and-final-verification).

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G01.1:** Publish versioned machine-readable action input/output schemas, permissions, prerequisites, side effects, bounded pagination and recoverable error codes from one maintained contract.
  - Required evidence: Contract schema cases and six-action inventory.
  - Current result: Pass. [S1 inventory](evidence/TASK-228-2026-09-08.md#s1-action-inventory) and [S2 strict contract tests](evidence/TASK-228-2026-09-08.md#s2-strict-contracts).
- **G01.2:** Map pilot receipt reads and Pack preparation/execution to existing authenticated APIs and shared commands; do not expose raw SQL or client-selected tenant authority.
  - Required evidence: Authenticated dispatch plus no-write preparation evidence.
  - Current result: Pass. [Authenticated dispatch and no-write preparation](evidence/TASK-228-2026-09-08.md#s3-authenticated-shared-dispatch-and-preparation).
- **G01.3:** Return authoritative resource IDs, versions and postconditions; prove idempotent replay and changed-payload conflict for applicable writes.
  - Required evidence: Stored Pack ID/row count and replay/conflict assertions.
  - Current result: Pass. [Persisted Pack replay/conflict evidence](evidence/TASK-228-2026-09-08.md#s4-replay-and-adapter-compatibility).
- **G01.4:** Shared dispatcher tests and thin adapter contract fixtures prove one business-rule boundary; document supported and unsupported pilot actions. Real WebMCP and MCP interoperability is verified under TASK-229 and TASK-230.
  - Required evidence: Shared test-adapter contract parity; real MCP/WebMCP explicitly deferred to their tasks.
  - Current result: Pass. [Shared dispatcher and thin adapter evidence](evidence/TASK-228-2026-09-08.md#s5-boundary-publication-and-final-verification). Real MCP/WebMCP interoperability remains assigned to TASK-229/230.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/api/companyReceipts.integration.test.ts src/modules/expenses/companyReceipt.test.ts src/modules/expenses/companyReceiptPack.test.ts src/api/resources.test.ts
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

Stop only the dependent design if preparation cannot preserve existing selection/visibility/scan semantics. Record the exact missing invariant; never create a second receipt selection authority.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
