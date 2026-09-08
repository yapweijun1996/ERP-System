# TASK-229 — Expose the receipt pilot through WebMCP

Goal: **G02** · Initial status: **Todo** · Priority: **P1**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-228, TASK-232, TASK-233**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G02 criteria plus common DoD remain required for task completion.

## Outcome and scope

Expose only the six approved pilot actions in an actual supported WebMCP browser, with a normal-UI fallback. No framework conversion, standalone remote MCP server or browser-held provider keys.

## Read these existing files first

- [web/public/assets/app.js](../../web/public/assets/app.js)
- [web/public/assets/screens-company-receipts.js](../../web/public/assets/screens-company-receipts.js)
- [web/public/assets/erp-system-data-adapter.js](../../web/public/assets/erp-system-data-adapter.js)
- [web/public/assets/erp-system-api-adapter.js](../../web/public/assets/erp-system-api-adapter.js)
- [web/src/erp-demo-runtime.ts](../../web/src/erp-demo-runtime.ts)
- [web/index.html](../../web/index.html)
- [tests/e2e/company-receipts-api.spec.ts](../../tests/e2e/company-receipts-api.spec.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Register a thin page adapter against G01. Check the current browser API in official docs; do not guess navigator/document property names. Tool visibility is convenience, not authorization. Demo does not prove production identity.

## Execute in this order

- [ ] **S1 — Verify prerequisites and browser support.**

  Action: Confirm TASK-228/232/233 are Done. Pin the browser version and WebMCP API documentation used. Run ordinary receipt UI first. Detect native support and record whether origin isolation/permissions-policy requirements are met.

  Checkpoint exit: A supported test environment or a precise unavailable-browser blocker is recorded; polyfills are labelled.

  Evidence: Not run.

- [ ] **S2 — Register and retire tools.**

  Action: Register only pilot actions when the route, actor and Company permit them. Remove registrations and invalidate captured context on navigation, logout, Company change and capability updates. Dispatch using current context, not a closure containing old grants.

  Checkpoint exit: Tool discovery follows current page state; P04/P05/P09 reject stale or unauthorized calls.

  Evidence: Not run.

- [ ] **S3 — Integrate visible preparation and confirmation.**

  Action: Use G06 review/confirm UI; expose selected evidence, totals and pending action. Preserve drafts/scroll/focus and require an explicit user choice before discarding work. Distinguish cancelling a form from cancelling an already committed mutation.

  Checkpoint exit: A human can observe and cancel preparation; no hidden Pack is created before confirmation.

  Evidence: Not run.

- [ ] **S4 — Exercise supported and fallback paths.**

  Action: Use in-app browser for the live journey where it supports WebMCP. Run real tool invocation in another supported browser if needed and label it. Test unsupported browser with ordinary UI, invalid input, Company switch, revocation and cancelled confirmation.

  Checkpoint exit: P01-P13 applicable browser cases have native versus fallback evidence, including desktop/375px.

  Evidence: Not run.

- [ ] **S5 — Run browser regressions and close.**

  Action: Run receipt API E2E, relevant locale/theme/accessibility checks and common code gates. Record screenshots, console/network findings and final Pack/artifact identity. Do not mark native support Done solely from a JavaScript stub.

  Checkpoint exit: G02 evidence includes real supported-browser execution and unchanged ordinary UI behavior.

  Evidence: Not run.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G02.1:** Register structured receipt search, authorized detail and Pack preparation/execution tools with feature detection and the ordinary UI retained when unsupported.
  - Required evidence: Native tool registration plus fallback tests.
  - Current result: Not run.
- **G02.2:** Bind tools to live actor, Company and page state; revoke stale registrations/context on navigation, Company switch, logout and permission change.
  - Required evidence: Scope-change/logout/revocation tests.
  - Current result: Not run.
- **G02.3:** Keep draft edits, confirmation and execution state visible; prevent a tool from silently discarding unsaved work or bypassing server authorization.
  - Required evidence: Visible confirmation and unsaved-form evidence.
  - Current result: Not run.
- **G02.4:** Browser tests exercise the real receipt journey, invalid input, cancellation and stale scope in supported WebMCP browsers plus the unsupported-browser fallback.
  - Required evidence: Real supported WebMCP journey and desktop/mobile regression.
  - Current result: Not run.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm run test:e2e:company-receipts-api
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

If no available browser supports native WebMCP, complete safe implementation/fallback tests, document the native acceptance gap and leave G02.4 open.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
