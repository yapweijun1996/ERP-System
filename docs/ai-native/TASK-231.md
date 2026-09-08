# TASK-231 — Connect the ERP agent to approved external MCP tools

Goal: **G04** · Initial status: **Todo** · Priority: **P1**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-232, TASK-234**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G04 criteria plus common DoD remain required for task completion.

## Outcome and scope

Build one approved read-only external document or calendar connector through MCP. Sending messages, payments, arbitrary network access and a connector marketplace are excluded.

## Read these existing files first

- [src/modules/integration/connector.ts](../../src/modules/integration/connector.ts)
- [src/modules/integration/connector.test.ts](../../src/modules/integration/connector.test.ts)
- [src/auth/tokenEnvelope.ts](../../src/auth/tokenEnvelope.ts)
- [src/auth/tokenCrypto.ts](../../src/auth/tokenCrypto.ts)
- [src/api/routes/integration.ts](../../src/api/routes/integration.ts)
- [src/modules/documents/processingDrivers.ts](../../src/modules/documents/processingDrivers.ts)

These are verified source entry points at the documentation baseline, not a claim
that the new Agent capability exists. Follow relevant callers and tests before editing.

## Implementation decisions and boundaries

Use existing encrypted connector lifecycle only where its contract fits; define distinct connector identity/scopes instead of overwriting document-vision credentials. External content never becomes an instruction, grant or ERP fact without verification.

Use test-only injected transports/resolvers for local adversarial fixtures. Keep
the live destination policy intact; do not add a production allow-all/private-IP
switch merely to make localhost fixture tests pass.

## Execute in this order

- [ ] **S1 — Select the first external service.**

  Action: Inventory already available approved integrations. Record the chosen provider, owner, resource scopes, retention/region, external data fields and concrete read use case. Prepare a local adversarial MCP fixture. If no real account is available, keep live verification pending.

  Checkpoint exit: Provider choice and data contract are recorded; no purchase or external message occurs.

  Evidence: Not run.

- [ ] **S2 — Implement isolated connection lifecycle.**

  Action: Implement authorize/configure, health, pause, rotate and revoke. Store credentials through the encrypted server boundary; never return plaintext or log raw connector payloads.

  Checkpoint exit: Old credentials stop working after rotation/revocation and health does not imply data access.

  Evidence: Not run.

- [ ] **S3 — Bound destination and tool trust.**

  Action: Allowlist intended HTTPS destinations; validate resolved IPs and redirects, including loopback/private/link-local/metadata addresses and rebinding cases. Permit only approved tool names/schema versions. Limit request/response bytes/time and reapproval of changed scopes.

  Checkpoint exit: Unsafe destination and changed-tool fixtures are rejected before data or credentials are sent.

  Evidence: Not run.

- [ ] **S4 — Enforce egress and content policy.**

  Action: Send only declared allowed fields. Treat returned text/descriptions as untrusted data. Prove malicious instructions cannot call a different tool, expose secrets or mutate ERP. Apply approved effects policy if future write tools are added.

  Checkpoint exit: P14/P15 malicious-content and network-policy cases pass; pilot connector remains read-only.

  Evidence: Not run.

- [ ] **S5 — Verify fixture and real connection separately.**

  Action: Run connector/token regression and new client tests. Exercise one actual authorized service read, timeout and revoke path with sanitized evidence. Record provider/operator responsibility and failure recovery.

  Checkpoint exit: G04 requires real chosen-provider proof; a fixture alone cannot close G04.4.

  Evidence: Not run.

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G04.1:** Implement a Company-owned outbound MCP connection lifecycle with encrypted credentials, explicit authorization, health, pause and revocation.
  - Required evidence: Connection lifecycle and credential non-disclosure.
  - Current result: Not run.
- **G04.2:** Allowlist destinations and approved tool versions; require review when tool definitions or requested scopes change and defend outbound requests against SSRF.
  - Required evidence: Destination/redirect/DNS and tool-version rejection.
  - Current result: Not run.
- **G04.3:** Enforce field minimization and an explicit egress policy; treat remote tool content as untrusted data and require approval for external side effects.
  - Required evidence: Field allowlist and prompt-injection cases.
  - Current result: Not run.
- **G04.4:** Prove one selected read-only document or calendar connector end to end, including malicious instructions, timeout, credential rotation and revoked-access denial.
  - Required evidence: Selected live service read plus failure/rotation/revocation evidence.
  - Current result: Not run.

## Existing regression commands

Read the [test runbook](../AI_NATIVE_EXECUTION.md#testing-runbook) before execution.
These commands verify existing regressions; they do not test code that has not been
written. Add focused tests for the new behavior and record their exact paths/commands.

```bash
npm test -- src/modules/integration/connector.test.ts src/auth/tokenCrypto.test.ts
```

Also run the common code gates and relevant generated/API/PostgreSQL/browser gates.
Use `npm run docs:check` and `git diff --check` for documentation-only increments.
Never mark a test passed because its command is listed in this packet.

## Stop or defer rule

If credentials, provider consent, region policy or material cost approval are missing, finish fixture-backed work and document the remaining live gate instead of inventing an account.

Fix acceptance-blocking defects or leave this task open. Record unrelated findings
as linked tasks with reproduction and DoD; a documented defect remains unresolved.
On interruption, record the next S-checkpoint, exact unverified criterion, changed
files and last verification in the task's evidence file, then recalculate progress.
