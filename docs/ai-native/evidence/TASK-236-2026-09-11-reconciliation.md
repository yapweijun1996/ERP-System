# TASK-236 candidate reconciliation — 2026-09-11

## Evidence identity

- Actor: local engineering reviewer; no business-user or production actor was impersonated.
- Root: `main`, HEAD `a4b7982bcf10ac71d709740af80dc2e79991e1c5`, pre-existing dirty tracked and untracked files. HEAD alone does not identify the working source.
- Candidate: `task-236-durable-workflow`, clean worktree at `3c508beb34c4865ae9baf44ddd2cd21ca0459da2`, tree `f23aa3ac26126ee0da7623d559e282a7468fcbb5`.
- Candidate location inspected: `/private/tmp/erp-freeze-task234-20260911-b`; rediscover with `git worktree list` before use.
- Candidate implementation base: `ad13545b375ab04e3bfe1f4df996687fe979d981`. Shared Git merge-base with root HEAD is `a4b7982bcf10ac71d709740af80dc2e79991e1c5`.
- Environment: local macOS source/document inspection only. No runtime tests, database mutation, migration, provider request, CI dispatch, merge, push or deployment in this increment.
- Expected result: identify reusable candidate changes, integration conflicts and the precise evidence still needed without rebuilding or promoting unaccepted work.
- Actual result: source and migration compatibility established at the inspected bytes; acceptance blockers below remain. This is reconciliation evidence, not capability acceptance.

## Current candidate pointer audit — 2026-09-11

The candidate worktree advanced after the initial reconciliation: its current
branch is `task-236-docs-final` at documentation tip `103e4ef` (scope follow-up
`77829ce` at source tip `bc726cc`),
parent implementation `fc64f342c95a74702967cf339d86e1c63e4caf6c`. The implementation is the
`fc64f34` commit; the candidate branch records repository-scope acceptance and
marks TASK-236 `done` in that branch's registry. The local remote-tracking
`origin/main` ref also points to `fc64f34`, while the root remains at
`a4b7982bcf10ac71d709740af80dc2e79991e1c5` with unrelated dirty work. No pull,
merge, migration or task-status change was performed in the root.

Read-only GitHub metadata confirms CI run
`34530777179` is `success` for head `3c508beb34c4865ae9baf44ddd2cd21ca0459da2`.
The candidate follow-up commit `7953efa` adds authenticated workflow-route tests
and changes the bounded-attempt case to observe a retryable failure followed by
persisted exhaustion. Commit `702ccc6` adds a disposable PostgreSQL child-process
kill after the canonical lease claim and recovery by a separate worker process. The
route/retry suite reported 2 files / 29 tests; the process-boundary suite reported
1 file / 2 tests; the full `test:postgres` gate reports 4 files / 5 tests. Commit `77829ce` adds foreign actor/Company-boundary coverage, bringing the combined focused suite to 3 files / 33 tests. The branch's repository-CI claim remains historical branch
evidence and does not close the dependency or root integration boundary.

## Reusable delta and integration boundary

`git log --reverse ad13545..3c508be` identifies six candidate commits:
`fe98abd` (implementation), `abdfa48` (recovery accounting), `b27218f`
(PostgreSQL proof), `ff88cf9` (evidence), `2b499a9` (RLS worker proof),
and `3c508be` (evidence follow-up). The earlier twelve commits from root HEAD
are the accumulated foundation/release history, not six additional workflow changes.

A byte comparison of every path from `git diff --name-only ad13545 3c508be`
against the actual root worktree found 29 changed paths. For 24 paths, the root
matches the candidate base (including absence of new files). Five paths diverge:
`GOAL.md`, `docs/GOAL_EXECUTION_PLAN.md`, `docs/PROJECT_LOGIC.md`,
`docs/STATUS.md` and `tasks/tasks.jsonl`. Preserve and reconcile their current
root content manually. In particular, do not overwrite the reopened G07.3 criterion
with the candidate's historical 28/48 count, or copy candidate task/checkpoint status.

The candidate delta includes the API router, shared stored-intent executor,
worker entry point, worker tenant-transaction helpers, workflow/schema/outbox
changes, production RLS, Demo adapter compatibility, package test selection and
generated Demo SQL. These are one related integration set, not an isolated new module.

All existing root `drizzle/*.sql` files match candidate bytes. The root journal's
112 entries are an exact prefix of the candidate's 115 entries; 0112–0114 are
candidate additions. This proves no current migration-name/prefix collision;
it does not prove upgrade execution or permission behavior. Preserve the generated
migration chain and regenerate/check Demo artifacts with repository commands.
Do not hand-edit generated SQL or copy only the final workflow file.

## Acceptance evidence audit

Source paths in this section refer to the pinned candidate, where they exist;
they are not claimed to exist in the current root.

| Gate | Source-backed observation | Remaining observable exit |
| --- | --- | --- |
| Dependency | Root TASK-230 is Done; TASK-234 is In Progress, G07.3 open. TASK-236 still depends on both. | Complete TASK-234 or obtain and record a deliberate dependency refinement before executing/integrating TASK-236. This review grants no dependency exception. |
| Restart / S5 / G09.1 / G09.4 | `src/modules/agent/durableWorkflow.postgres.integration.test.ts` now starts a child worker, waits for the canonical lease claim, sends `SIGKILL`, then runs a recovery worker after logical lease expiry and checks the original run, three steps and one Pack. | Candidate claim-boundary restart evidence passes. Root dependency/integration remains open; provider-response and production crash-window evidence are separate. |
| Attempt budget / G09.4 | Commit `7953efa` updates `src/modules/agent/durableWorkflow.test.ts` to run two batches after deleting the execute step: first retryable failure, then terminal exhaustion. | Candidate now proves persisted backoff/attempt count and terminal exhaustion across re-entry with no extra effect. A real process crash window remains separate. |
| HTTP integration | `src/api/routes/assistant.ts` adds queue/read/pause/resume/cancel routes. Commit `7953efa` adds authenticated queue/read/pause/resume coverage; commit `77829ce` adds an unconfigured-actor route denial and shared-command foreign actor/Company checks. | Candidate route wiring, session authentication, approval waiting, optimistic versions and fail-closed scope checks pass. Root acceptance remains separate evidence. |
| PostgreSQL | Candidate `durableWorkflow.postgres.integration.test.ts:170` runs two concurrent batches; the current candidate also runs the child-process kill/restart case under a disposable PostgreSQL 16 FORCE-RLS role. | Current candidate `test:postgres` passes 4 files / 5 tests, including two durable-workflow tests. Root integration and production evidence remain open. |
| Common DoD | Candidate follow-up commits `7953efa`, `cbbe913`, `2dd3381`, `702ccc6`, `c391090`, `1954c0c`, `77829ce`, `bc726cc` and documentation tip `103e4ef` were checked with lint, root/web typechecks, PGlite Demo, Demo build, schema/drift/permission/RLS/i18n/pack checks, full PostgreSQL tests, docs and diff checks. | Candidate repository gates are current for `103e4ef` (source `bc726cc`); exact root integration, dependency and production evidence remain open. |

The implementation's transaction boundary and its crash windows must guide the
restart tests. A fabricated database state is useful recovery-unit evidence, but
cannot establish that a real stopped process releases locks, survives reconnect,
or resumes from the actual commit boundary.

## Measurable integration sequence

1. Retain the six commits and pinned candidate evidence; do not rebuild the workflow.
2. Resolve TASK-234/dependency authority. Freeze a reviewed integration base that
   preserves the root's current changes and corrected acceptance accounting.
3. Apply the complete candidate delta in isolation. Reconcile the five divergent
   documents/registry semantically; recheck current migration prefix and input bytes.
4. Close HTTP, process restart and retry-budget gaps above through canonical commands.
   Verify PGlite and disposable PostgreSQL/RLS; regenerate/check Demo schema and
   run packet/common gates, including `npm run demo` and applicable browser checks.
5. Record immutable revision, environment/actor, expected/actual persisted outcomes
   and CI evidence; then assess four criteria, five steps and common DoD separately.

## External resources and ownership

- TASK-234: this process has no `TASK234_LIVE_APPROVED`,
  `TASK234_APPROVAL_REFERENCE`, `TASK234_OPENAI_API_KEY` or
  `TASK234_MAX_COST_MICROS` values. Only presence booleans were inspected.
  This does not prove that a deployed encrypted Company connector is absent.
  Account/data owner and AI engineer must identify the approved existing
  configuration, model/data policy and spend cap, plus a readable receipt and
  business reviewer. Do not silently substitute an account or interpret a saved
  credential as authorization. The user subsequently authorized the existing Demo endpoint and delegated OCR/review
  to Codex. That run is recorded in [Demo evidence](TASK-234-2026-09-11-codex-demo.md);
  a separate server-provider account is not required for that approved Demo scope.
- Project KB: the connector recovered in the continuation. `kb_list(search="erp-system-project-logic")`
  resolved `erp-system-project-logic` to UUID `ef47bf4b-83e1-42b2-a412-66912d04ea24`,
  and the source-backed continuation item
  `24435a44-ca84-4794-a242-3d10bae8a7ab` was synchronized and read back successfully.
  The KB remains continuity context; current source, tests and STATUS/SPEC docs remain
  authoritative.
- Product/runtime behavior is unchanged. Root TASK-236 stays Todo; no S checkbox
  or G criterion is promoted. Delta: 0 completed tasks, 0 criteria, 0 checkpoints.

## Verification

GOAL's embedded count validator passed before changes: 240 tasks; 226 Done,
6 In Progress, 5 Todo, 3 Blocked; 14 open; AI 6/12, criteria 27/48, steps 36/60;
no dependency-ready Todo. Final documentation checks are recorded below after execution.

Final reconciliation documentation gates: count/dependency/fingerprint validator,
`npm run docs:check` (75 files / 780 links), root Markdown render/link/fragment
validation (3 files / 78 links / 8 tables), and `git diff --check` passed.
Unrelated pre-existing files matched the pre-edit SHA-256 inventory. Candidate
runtime tests and source files changed only in isolated follow-up commits `7953efa`,
`cbbe913`, `2dd3381`, `702ccc6` and `77829ce`; candidate evidence documentation is at
`103e4ef` (source scope boundary `bc726cc`);
the root worktree remains unmerged. The later TASK-234
code repair and real Demo gateway run are separately recorded in
[Demo evidence](TASK-234-2026-09-11-codex-demo.md).
