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

- [x] **S1 — Verify prerequisites and browser support.**

  Action: Confirm TASK-228/232/233 are Done. Pin the browser version and WebMCP API documentation used. Run ordinary receipt UI first. Detect native support and record whether origin isolation/permissions-policy requirements are met.

  Checkpoint exit: A supported test environment or a precise unavailable-browser blocker is recorded; polyfills are labelled.

  Evidence: [TASK-229 S1 evidence](evidence/TASK-229-2026-09-09.md#s1--verify-prerequisites-and-browser-support).

- [x] **S2 — Register and retire tools.**

  Action: Register only pilot actions when the route, actor and Company permit them. Remove registrations and invalidate captured context on navigation, logout, Company change and capability updates. Dispatch using current context, not a closure containing old grants.

  Checkpoint exit: Tool discovery follows current page state; P04/P05/P09 reject stale or unauthorized calls.

  Evidence: [TASK-229 S2 evidence](evidence/TASK-229-2026-09-09.md#s2--register-and-retire-tools).

- [x] **S3 — Integrate visible preparation and confirmation.**

  Action: Use G06 review/confirm UI; expose selected evidence, totals and pending action. Preserve drafts/scroll/focus and require an explicit user choice before discarding work. Distinguish cancelling a form from cancelling an already committed mutation.

  Checkpoint exit: A human can observe and cancel preparation; no hidden Pack is created before confirmation.

  Evidence: [TASK-229 S3 evidence](evidence/TASK-229-2026-09-09.md#s3--integrate-visible-preparation-and-confirmation).

- [x] **S4 — Exercise supported and fallback paths.**

  Action: Use in-app browser for the live journey where it supports WebMCP. Run real tool invocation in another supported browser if needed and label it. Test unsupported browser with ordinary UI, invalid input, Company switch, revocation and cancelled confirmation.

  Checkpoint exit: P01-P13 applicable browser cases have native versus fallback evidence, including desktop/375px.

  Evidence: [TASK-229 S4 evidence](evidence/TASK-229-2026-09-09.md#s4--exercise-supported-and-fallback-paths).

- [x] **S5 — Run browser regressions and close.**

  Action: Run receipt API E2E, relevant locale/theme/accessibility checks and common code gates. Record screenshots, console/network findings and final Pack/artifact identity. Do not mark native support Done solely from a JavaScript stub.

  Checkpoint exit: G02 evidence includes real supported-browser execution and unchanged ordinary UI behavior.

  Evidence: [TASK-229 S5 evidence](evidence/TASK-229-2026-09-09.md#s5--run-browser-regressions-and-close-the-local-checkpoint).

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G02.1:** Register structured receipt search, authorized detail and Pack preparation/execution tools with feature detection and the ordinary UI retained when unsupported.
  - Required evidence: Native tool registration plus fallback tests.
  - Current result: The feature-detected page adapter registers the six G01 names only on the authorized Company Receipts route; session-scoped detail and read-only Pack preparation reuse the API/Demo adapters and shared selection query. Chrome 152 with the official local `WebMCPTesting` flag registers and invokes all six tools through `document.modelContext`; the ordinary UI remains the fallback when the API is absent. The same isolated E2E verifies that the canonical `DB` session object crosses the browser script boundary without adding a second tenant state store.
- **G02.2:** Bind tools to live actor, Company and page state; revoke stale registrations/context on navigation, Company switch, logout and permission change.
  - Required evidence: Scope-change/logout/revocation tests.
  - Current result: `src/webmcpAdapter.test.ts` passes seven focused lifecycle cases covering discovery, navigation retirement, permission revocation, Company fingerprint change, cancellation, JSON-safe binary export and unsupported-browser no-op. The native Chrome E2E additionally retires a real registration on permission revocation, Company fingerprint change and Dashboard navigation, then re-registers only after the restored current context.
- **G02.3:** Keep draft edits, confirmation and execution state visible; prevent a tool from silently discarding unsaved work or bypassing server authorization.
  - Required evidence: Visible confirmation and unsaved-form evidence.
  - Current result: The Company Receipts screen prepares the exact tenant-scoped selection read-only, shows evidence rows, exact currency totals, filters and pending action in a review modal, and requires explicit confirmation before the existing session-authorized Pack writer. The native E2E aborts while the modal is visible and leaves zero Pack rows, then confirms the same reviewed selection, reads the persisted Pack back and verifies a JSON-safe PDF artifact hash. The WebMCP create bridge never silently bypasses the visible path.
- **G02.4:** Browser tests exercise the real receipt journey, invalid input, cancellation and stale scope in supported WebMCP browsers plus the unsupported-browser fallback.
  - Required evidence: Real supported WebMCP journey and desktop/mobile regression.
  - Current result: `npm run test:e2e:webmcp-native` covers the real Chrome 152 native journey, six-tool discovery, receipt search/detail/prepare, visible cancellation and confirmation, Pack persistence/read-back/PDF export, permission and Company-scope retirement, navigation retirement and 375px bounds. The authenticated API/PGlite E2E remains the ordinary-browser fallback and covers invalid input, changed selection, server revocation/recovery, Preview/PDF/Print and desktop/mobile bounds. Bundled Chromium 149 and the unlocked Codex in-app browser remain explicitly unsupported fallback environments.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm run test:e2e:company-receipts-api
npm run test:e2e:webmcp-native
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

If no available browser supports native WebMCP, complete safe implementation/fallback tests, document the native acceptance gap and leave G02.4 open. The local Chrome 152 `WebMCPTesting` environment now satisfies this condition for repository acceptance; ordinary browsers without the API must continue to use the fallback.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
