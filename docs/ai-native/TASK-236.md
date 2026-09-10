# TASK-236 — Run durable and recoverable agent workflows

Goal: **G09** · Current status: **Done** · Priority: **P1**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-230, TASK-234**.

Progress update — 2026-09-11: S1-S5 and the repository common DoD are evidenced by the durable Receipt Pack
workflow implementation, focused PGlite tests, a PostgreSQL two-worker proof and
green current-branch CI run `34530777179`. Production/provider/business-owner gates
remain separate. See
[dated evidence](evidence/TASK-236-2026-09-11.md).

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G09 criteria plus common DoD remain required for task completion.

## Outcome and scope

Persist and recover the approved receipt Agent workflow. Do not build a general orchestration platform or launch autonomous financial workflows.

## Read these existing files first

- [src/worker.ts](../../src/worker.ts)
- [src/worker/outbox.ts](../../src/worker/outbox.ts)
- [src/worker/telemetry.ts](../../src/worker/telemetry.ts)
- [src/modules/reporting/reportJobs.ts](../../src/modules/reporting/reportJobs.ts)
- [src/data/schema/reporting.ts](../../src/data/schema/reporting.ts)
- [src/data/schema/integration.ts](../../src/data/schema/integration.ts)
- [src/data/tenantTransaction.ts](../../src/data/tenantTransaction.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Model run and step states explicitly: queued/running/waiting_approval/succeeded/failed/cancelled, with lease ownership, intended action, identity/grant reference, attempts and result references. Reuse outbox/worker patterns without copying their domain rules.

## Execute in this order

- [x] **S1 — Specify state and failure transitions.**

  Action: Write legal transitions, ownership, retryable versus terminal errors, cancellation semantics and approved-intent references. Define what survives a browser close and what requires a fresh confirmation.

  Checkpoint exit: A transition table covers every terminal state and restart from each nonterminal state.

  Evidence: [TASK-236 evidence — state and failure transitions](evidence/TASK-236-2026-09-11.md#state-and-failure-transitions).

- [x] **S2 — Persist runs and leases.**

  Action: Add schema/migrations, unique intent/step reservation and bounded lease/heartbeat claims. Commit required state/audit/outbox together. Use encrypted/protected references instead of raw secrets/prompt copies.

  Checkpoint exit: Two workers cannot own the same effect; expired leases recover without losing outcome identity.

  Evidence: [TASK-236 evidence — S2](evidence/TASK-236-2026-09-11.md#s2--persist-runs-and-leases).

- [x] **S3 — Implement resume and cancellation.**

  Action: Before each resumed side effect, reload current grant, Company/module permission and exact approval. Interrupt bounded provider work; cancellation after a commit reports the actual committed result instead of pretending rollback.

  Checkpoint exit: Revocation while waiting, restart while running and late cancellation produce truthful states.

  Evidence: [TASK-236 evidence — S3](evidence/TASK-236-2026-09-11.md#s3--implement-resume-and-cancellation).

- [x] **S4 — Connect one event trigger.**

  Action: Use one explicit enabled receipt event to prepare work for review. Deduplicate event delivery; cap attempts and dead-letter terminal failures. No event may manufacture user approval.

  Checkpoint exit: Repeated trigger produces one intended workflow; failure/manual recovery preserves the same provenance.

  Evidence: [TASK-236 evidence — S4](evidence/TASK-236-2026-09-11.md#s4--connect-one-event-trigger).

- [x] **S5 — Run recovery and concurrency proof.**

  Action: Inject worker termination before/after provider response and before/after business commit. Run two workers on disposable PostgreSQL plus existing outbox/telemetry tests and common gates.

  Checkpoint exit: P16 and relevant P06-P12 cases prove no duplicate Pack, no lost approval boundary and no false success.

  Evidence: [TASK-236 evidence — S5](evidence/TASK-236-2026-09-11.md#s5--run-recovery-and-concurrency-proof) — local/disposable proof passes and current-branch CI run `34530777179` is green.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G09.1:** Persist run/step state, actor scope, approved intent, leases, checkpoints and bounded retry metadata so authorized work survives browser closure and worker restart.
  - Required evidence: Persisted state/lease/checkpoint and restart tests.
  - Current result: Local and disposable PostgreSQL persisted-state and lease-recovery evidence passes; current-branch CI run `34530777179` is green.
- **G09.2:** Support pause, resume, cancellation and approval waiting; recheck permissions and approval validity before every resumed side effect.
  - Required evidence: Pause/resume/cancel with current authorization.
  - Current result: Local pause/resume/cancel and authorization-recheck evidence passes.
- **G09.3:** Use transactional events/outbox and idempotent consumers for selected event triggers; document compensation and manual recovery for cross-system failures.
  - Required evidence: Transactional trigger/dedup and manual recovery.
  - Current result: Local transactional outbox and duplicate-trigger evidence passes; manual recovery is documented in the dated evidence and the current-branch CI run `34530777179` is green.
- **G09.4:** Failure-injection tests cover duplicate delivery, expired leases, partial execution, restart and budget exhaustion without duplicate posting or false completion.
  - Required evidence: Two-worker crash-window and budget exhaustion evidence.
  - Current result: Local and disposable PostgreSQL failure-injection cases pass; current-branch CI run `34530777179` is green.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/worker/outbox.test.ts src/worker/telemetry.test.ts
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

If a cross-system step has no safe retry/reconciliation path, keep it waiting for manual recovery. Do not replay an uncertain side effect with a new intent key.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
