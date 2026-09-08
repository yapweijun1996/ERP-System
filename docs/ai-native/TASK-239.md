# TASK-239 — Release and operate the AI Native ERP safely

Goal: **G12** · Initial status: **Todo** · Priority: **P0**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-017, TASK-193, TASK-199, TASK-201, TASK-202, TASK-204, TASK-205, TASK-209, TASK-229, TASK-230, TASK-231, TASK-232, TASK-233, TASK-234, TASK-235, TASK-236, TASK-237, TASK-238**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G12 criteria plus common DoD remain required for task completion.

## Outcome and scope

Release the completed scoped AI Native ERP with real operations evidence. Reuse the eight inherited tasks rather than copying their work into another Done checkbox.

## Read these existing files first

- [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)
- [docs/RELEASE_CHECKLIST.md](../../docs/RELEASE_CHECKLIST.md)
- [docs/SCALABILITY.md](../../docs/SCALABILITY.md)
- [docs/PWA.md](../../docs/PWA.md)
- [scripts/verify-release.mjs](../../scripts/verify-release.mjs)
- [deploy/release.sh](../../deploy/release.sh)
- [src/worker/telemetry.ts](../../src/worker/telemetry.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

A source-complete task is not a deployed release. Record exact revision, compatible schema/tool/API/model versions, enabled Company scope and rollback target. Production mutations require existing explicit authorization.

## Execute in this order

- [ ] **S1 — Verify prerequisite evidence.**

  Action: Check each dependency in tasks/tasks.jsonl and review the linked evidence, not only status labels. Confirm all G01-G11 criteria, the eight inherited tasks and release authorization. Prepare a concrete release/backup/rollback plan.

  Checkpoint exit: No missing security, tax, provider, physical-device or recovery prerequisite is concealed.

  Evidence: Not run.

- [ ] **S2 — Prepare and rehearse release.**

  Action: Build the selected revision with compatible protocol/tool/API schemas. Exercise staged Company enablement and rollback in an isolated environment, including active run and two-tab unsaved draft behavior.

  Checkpoint exit: Rehearsal preserves data and either resumes compatible work or stops it with actionable recovery.

  Evidence: Not run.

- [ ] **S3 — Execute authorized production release.**

  Action: Use the approved application/migration/RLS procedure and exact target; never reset/reseed. Run read-only revision/health/asset verification and independently check declared rollback/monitoring conditions.

  Checkpoint exit: Actual deployed identity and asset bytes match the selected revision; origin failures remain open.

  Evidence: Not run.

- [ ] **S4 — Exercise operations and pilot acceptance.**

  Action: Run the approved production pilot, credential revoke/disable and alert/recovery exercises. Measure declared load/latency/cost budgets and timed restore with accountable operators.

  Checkpoint exit: Real environment results meet approved thresholds; fixtures are not substituted for production evidence.

  Evidence: Not run.

- [ ] **S5 — Handover and close the goal.**

  Action: Ship labelled deterministic Demo/replay, operators' runbooks, limitations and customer acceptance. Recompute all goal/registry/checkpoint counts and update docs/KB. Close G12 only when all four criteria and common DoD pass.

  Checkpoint exit: The chosen release is operable, traceable, reversible and accepted; known deferred scope remains explicit.

  Evidence: Not run.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G12.1:** Close the eight inherited open tasks with their own evidence and pass G01-G11; verify exact production web/API revision, asset hashes and current release CI without reset/reseed.
  - Required evidence: All inherited/current release dependencies with exact revision.
  - Current result: Not run.
- **G12.2:** Exercise Company-level enablement, protocol/tool/API compatibility, staged rollout, rollback and emergency disable while preserving in-flight work and browser drafts across updates.
  - Required evidence: Staged upgrade/draft/in-flight compatibility and rollback.
  - Current result: Not run.
- **G12.3:** Measure declared latency/cost/concurrency budgets, alerts and recovery objectives on representative production data; verify retention, backup restore and incident ownership for Agent runs and connectors.
  - Required evidence: Measured production budgets, alerts, restore and ownership.
  - Current result: Not run.
- **G12.4:** Ship a labelled deterministic offline Demo/replay with no production secrets and a real authorized production pilot; record owner acceptance, limitations and operational handover.
  - Required evidence: Labelled Demo, real pilot, accepted limitations and handover.
  - Current result: Not run.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm run docs:check
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

Missing production authorization, target access, qualified approval or recovery evidence blocks release. Continue non-mutating preparation; never substitute a Demo or old deployment for current proof.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
