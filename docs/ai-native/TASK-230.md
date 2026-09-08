# TASK-230 — Provide an authenticated ERP MCP server

Goal: **G03** · Initial status: **Todo** · Priority: **P1**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-228, TASK-232, TASK-233**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G03 criteria plus common DoD remain required for task completion.

## Outcome and scope

Implement the protected inbound ERP MCP server for the pilot. Do not turn browser cookies into bearer tokens or expose arbitrary database/API access.

## Read these existing files first

- [src/api/app.ts](../../src/api/app.ts)
- [src/api/http.ts](../../src/api/http.ts)
- [src/auth/session.ts](../../src/auth/session.ts)
- [src/auth/authorization.ts](../../src/auth/authorization.ts)
- [src/auth/rateLimit.ts](../../src/auth/rateLimit.ts)
- [src/api/audit.ts](../../src/api/audit.ts)
- [src/api/companyReceipts.integration.test.ts](../../src/api/companyReceipts.integration.test.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Reuse G01 handlers and G05 principal/grant resolution. Choose and pin a maintained MCP SDK and a standards-compatible authorization service after checking existing infrastructure. Do not hand-roll an OAuth authorization server or copy Platform impersonation as Agent login.

## Execute in this order

- [ ] **S1 — Choose a supported protocol/auth topology.**

  Action: Read current official MCP authorization/transport docs. Record protocol and SDK versions, protected resource URI, authorization issuer/discovery, allowed client registration and two concrete test clients. Explain how validated grants map to ERP principals.

  Checkpoint exit: A short decision record and executable local authorization fixture exist; no invented production issuer is claimed.

  Evidence: Not run.

- [ ] **S2 — Implement endpoint and discovery.**

  Action: Add the MCP transport in the API boundary with versioned tools and structured responses from G01. Register only pilot tools; apply content/result/time limits. Use the SDK lifecycle rather than a bespoke JSON-RPC subset.

  Checkpoint exit: Client initialization, tools/list and tool calls work against the selected protocol version.

  Evidence: Not run.

- [ ] **S3 — Enforce authorization on every call.**

  Action: Validate issuer/audience/signature/expiry and delegated scopes; handle revocation and current tenant/module/field permissions. Apply G06 approval before effects. Preserve browser session/CSRF behavior separately; never pass one service's token to another service.

  Checkpoint exit: Wrong audience, expired/revoked credentials, guessed Company and changed approvals fail without business mutations.

  Evidence: Not run.

- [ ] **S4 — Prove two-client interoperability.**

  Action: Use two identified client implementations/versions, not two instances of the same test helper. Exercise read, prepare, confirmed create, Pack read/export and dropped-response retry. Use isolated data and the same expected IDs/permissions across clients.

  Checkpoint exit: P01-P12 applicable cases pass on real protocol calls; creation/replay and denial postconditions are inspected.

  Evidence: Not run.

- [ ] **S5 — Verify and document operations.**

  Action: Run existing API/security regressions plus new protocol tests and common gates. Document endpoint discovery, authorized installation, expiry/revocation, rate/error limits and incompatible versions.

  Checkpoint exit: G03 has current protocol/auth/client evidence; production deployment remains G12/TASK-199.

  Evidence: Not run.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G03.1:** Provide a versioned remote MCP endpoint with capability discovery and pilot tools backed by the governed action catalogue.
  - Required evidence: Initialization/tools/list and real action responses.
  - Current result: Not run.
- **G03.2:** Implement the selected MCP HTTP authorization profile, protected-resource discovery, audience validation, least-privilege scopes, expiry and revocation.
  - Required evidence: OAuth discovery and token validation negative cases.
  - Current result: Not run.
- **G03.3:** Enforce tenant derivation and resource/field permissions on every call; bound result size, rate and execution time and preserve structured errors.
  - Required evidence: Per-call authorization, limits and structured errors.
  - Current result: Not run.
- **G03.4:** Interoperability tests with two selected MCP clients prove receipt read/Pack execution, rejected cross-Company access, revoked tokens and safe timeout replay.
  - Required evidence: Two distinct client versions, retry and persisted postconditions.
  - Current result: Not run.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/api/companyReceipts.integration.test.ts src/auth/authorization.test.ts src/auth/session.test.ts src/auth/rateLimit.test.ts
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

Missing production OAuth configuration is not permission to implement anonymous MCP. Use a bounded local fixture, clearly identify remaining real-auth/deployment evidence and keep unmet criteria open.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
