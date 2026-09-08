# TASK-234 — Deliver the server AI runtime and contextual ERP workspace

Goal: **G07** · Initial status: **Todo** · Priority: **P1**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-230**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G07 criteria plus common DoD remain required for task completion.

## Outcome and scope

Deliver one contextual receipt assistant using the approved pilot tools. No unrestricted SQL/chat-to-admin gateway, hidden provider fallback or replacement of the existing Vision pipeline.

## Read these existing files first

- [docs/AI_PROVIDERS.md](../../docs/AI_PROVIDERS.md)
- [src/modules/documents/processingPolicy.ts](../../src/modules/documents/processingPolicy.ts)
- [src/auth/tokenEnvelope.ts](../../src/auth/tokenEnvelope.ts)
- [src/modules/integration/connector.ts](../../src/modules/integration/connector.ts)
- [web/public/assets/app.js](../../web/public/assets/app.js)
- [web/public/assets/screens-company-receipts.js](../../web/public/assets/screens-company-receipts.js)
- [src/api/app.ts](../../src/api/app.ts)
- [web/public/assets/i18n/en.json](../../web/public/assets/i18n/en.json)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Use a server provider interface and the G01/G03 permission-bound invocation service; an in-process call may avoid self-HTTP only if it preserves the identical resolver/approval checks. Do not obtain permissions from the model's selected tool name. Wizard AI preview remains preview until the new configuration is truly wired.

## Execute in this order

- [ ] **S1 — Define runtime states and limits.**

  Action: Specify provider request/response/tool-call types and conversation/run states. Add explicit maximum calls, duration, output size and cost reservation policy; count retries. Start with one approved provider/model and a deterministic zero-spend test double.

  Checkpoint exit: Unavailable provider and exhausted-budget cases return actionable errors without a simulated success.

  Evidence: Not run.

- [ ] **S2 — Implement secret-safe server configuration.**

  Action: Add Company-authorized provider/model/data-policy configuration using encrypted credentials. Validate endpoints and egress. Avoid exposing credentials in browser APIs, prompt traces and audits; changing provider must be explicit.

  Checkpoint exit: Configuration, credential rotation and disallowed model/endpoint tests pass; real-account readiness is separate.

  Evidence: Not run.

- [ ] **S3 — Implement receipt conversation loop.**

  Action: Resolve current Company/actor; retrieve only allowed facts, propose exact Pack contents and wait for G06 confirmation. Resume through the governed executor and read actual result/artifact evidence before announcing completion.

  Checkpoint exit: P01-P12 pass through assistant tool calls; denied or ambiguous requests create no Pack.

  Evidence: Not run.

- [ ] **S4 — Build the contextual workspace.**

  Action: Show sources, selected Company, preview, confirmation, progress, cancel and recovery in the current vanilla-JS UI. Preserve drafts and prevent cross-Company conversation contamination. Add five locale resources, both themes and keyboard/focus behavior.

  Checkpoint exit: Desktop/375px user can complete and cancel the pilot without hidden execution or browser errors.

  Evidence: Not run.

- [ ] **S5 — Validate fixture and real-model journeys.**

  Action: Run provider/workspace tests, receipt E2E and common gates; add a real approved model run with redacted latency/call/cost evidence. Do not treat the mocked provider or wizard preview as live AI proof.

  Checkpoint exit: G07 has functional workspace, governed execution, provider-failure handling and real-provider evidence or an explicit remaining gate.

  Evidence: Not run.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G07.1:** Implement a server-owned provider interface and Company configuration with encrypted secrets, allowed models, data policy, bounded timeout and per-run cost/call budgets.
  - Required evidence: Server provider/configuration and budget cases.
  - Current result: Not run.
- **G07.2:** Provide contextual chat, cited receipt results, Pack preview and confirmation, with distinct draft, waiting, running, succeeded, failed and cancelled states.
  - Required evidence: Visible states, sources and confirmation UI.
  - Current result: Not run.
- **G07.3:** Complete the real receipt-to-Pack journey using governed tools and verified database/artifact postconditions; the assistant cannot announce success from model prose alone.
  - Required evidence: Persisted Pack/artifact evidence from assistant execution.
  - Current result: Not run.
- **G07.4:** Prove provider failure/cancellation and zero credential leakage; test en/ms/zh/ja/vi, light/dark, desktop/mobile and accessible focus/keyboard behavior.
  - Required evidence: Failure/cancellation/secret checks and locale/theme/mobile matrix.
  - Current result: Not run.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/modules/integration/connector.test.ts src/modules/documents/processingDrivers.test.ts
npm run test:e2e:company-receipts-api
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

No provider account or approved spend means continue with clearly labelled fixtures and leave real-provider evidence open. Never silently use another account/model.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
