# ERP goal execution plan

Current TASK-234 checkpoint — 2026-09-10: shared G06 intent and Pack persistence
commands are now browser-compatible factories. Server facades preserve their
existing APIs; Demo runtime binds both factories with Web Crypto and shared audit.
The Demo Pack path uses shared creation/replay commands and enforces the reviewed
selection digest. Demo preparation, persisted approval and execution now use shared
G06 commands with actor/Company ownership and transactional audit. Local integration
and Company Receipts browser regression pass; authentication remains synthetic.
Real operator acceptance remains open. A refreshed local candidate includes the
latest repairs; its 136 files and the recovered 133-file live rollback copy are
hash-verified. Neither is a deployment. Full-suite release regression passed: 895 tests,
with 3 PostgreSQL tests skipped because POSTGRES_URL was unset. Earlier candidates are stale.
The assistant success view now opens its existing Pack PDF after rechecking the
completion artifact hash; opening does not execute another creation command.
Selected rows are now progressively expandable beyond 20 with amount, currency,
purpose, version and evidence facts. Original evidence can now be opened through
the governed document-content boundary after exact-version and byte-hash checks.
Actual human inspection and the same-run real gateway pilot remain open.

The default browser gateway is `https://gpt.yapweijun1996.com/demo` / `demo-auto`.
One synthetic query on the registered GitHub Pages origin succeeded (117 reported
tokens); tested localhost origins were rejected. This is protocol evidence only,
not full Receipt-to-Pack/operator acceptance. Requests send user query text, not
receipt files, and do not occur at startup. See [AI_PROVIDERS.md](AI_PROVIDERS.md).

Reviewed: **2026-09-09**. Goal owner: product owner. Execution/evidence owner:
engineering. This page owns the active focus and continuation decision;
[GOAL.md](../GOAL.md) owns the goal/acceptance criteria, and
[tasks/tasks.jsonl](../tasks/tasks.jsonl) owns statuses and dependencies.

## Outcome and current milestone

Build a modular SG/MY ERP in which people and authorized AI perform real business
work through shared, governed commands. Permissions, Company isolation, financial
calculations, approvals and final records remain ERP responsibilities.

The current milestone is **Phase 2: the real Company Receipt-to-Pack pilot**:

1. Ask for Company Receipts and inspect cited source evidence.
2. Review the exact Pack selection and totals.
3. Give explicit human confirmation.
4. Generate through the ordinary governed command.
5. Verify persisted Pack identity, source selection and PDF artifact; open the result.

The full project also includes durable workflows, one approved external connector,
repeatable safety evaluation, selected ERP business journeys and production
operations. Completing the first pilot does not complete that wider scope.

## Active work: TASK-234 runtime integration

**Current result:** HTTP cancellation and conservative retry-cost custody are
implemented. The OpenAI Responses adapter, session-derived Company resolver and
server/Compose opt-in wiring now exist and have injected-HTTP/PGlite evidence.
**Verification:** 5 focused files / 60 tests, final 19-test adapter hardening,
G06 regression, common local gates and desktop/375px fixture pass. See
[TASK-234 evidence](ai-native/evidence/TASK-234-2026-09-09.md#company-resolver-and-bootstrap--local-integration-verified).
**Integrated regression:** the final full run exited 0 with 204 files / 895 tests
passed and 3 PostgreSQL files/tests skipped because POSTGRES_URL was unset.
This supersedes the historical MCP fixture-clock failures. PostgreSQL and real
operator acceptance remain open. See [regression evidence](ai-native/evidence/TASK-234-2026-09-09.md#final-full-suite-release-regression--2026-09-10).
**Pilot runner:** `scripts/receipt-assistant-pilot.ts` now rehearses fresh disk-backed
SG/MY fixtures through authenticated APIs and verifies persisted Pack/PDF after
database reopen. It now requires individual receipt detail reads and saves exact
source versions with matching hashes before confirmation. Exact-confirmation
rejection creates no Pack. Register font declarations/digit mapping and complete
wrapped fields now have local PDF rendering evidence. File access does not prove
human viewing.
**Next:** run the current browser assistant from a registered origin, inspect its
exact source evidence and contents, obtain human confirmation, then open its
verified persisted Pack. Local UI availability is not actual human acceptance.
The user selected and authorized the public GPT Demo gateway. The current local
origin is not registered; the authenticated gateway Settings page was inspected on
2026-09-10 and is read-only. Source registration requires gateway server access, or
a reviewed current build must be hosted on the already registered Pages origin.
Neither route was changed in this checkpoint. Simulated confirmation is not human
acceptance, and the public query-proposal flow does not prove server native tools.

| Boundary | Current source evidence | Remaining evidence |
| --- | --- | --- |
| Protocol | `openAiProvider.ts`: pinned GPT-4.1 mini, tool/result IDs, fixed HTTPS, bounded sanitized failures | Approved account response and usage |
| Company configuration | `receiptAssistantProvider.ts`: encrypted credential, Company limits, global/no-training policy, pre-egress configuration/grant recheck | Actual approved Company configuration and operator policy |
| Route | `routes/assistant.ts`: provider plus Company runtime limits; cancellation preserved | Real-model authenticated pilot |
| Bootstrap | `receiptAssistantBootstrap.ts`, `server.ts`, Compose: explicit activation, Agent and pricing; credentials alone do not enable calls | Deployed configuration/release verification |
| Pilot | Injected Responses HTTP plus governed human confirmation, persisted Pack/PDF assertions | Authorized real model, latency/call/cost and artifact-opening evidence |

The earlier missing-source audit is superseded by this local implementation, not
by account availability. Alternate providers/models, tenant-only/tenant-local data
and implicit pricing are rejected. No account or spend is enabled by this change.

### Implementation and verification order

1. Inspect the current interface, configuration validation, route limits, Agent
   identity resolution, runtime message/tool mapping and production environment
   entry. Reuse those boundaries; do not add another business-command layer.
2. Implement one reviewed provider protocol adapter and a Company-scoped resolver.
   Keep credentials server-only; enforce the configured endpoint/model/data policy,
   timeout, call/retry and cost budgets before egress. Never silently fall back to
   another account/provider or to a deterministic fixture.
3. Wire the resolver into server startup with explicit activation and the existing
   governed Agent identity. Missing provider, key, Agent or policy fails closed.
4. Use local injected HTTP responses to test malformed output, unknown tools,
   timeout/cancel, redirect/egress denial, secret non-disclosure, Company isolation,
   disabled/rotated configuration and budget exhaustion. Then prove the real UI/API
   path still requires human confirmation and verified database/artifact results.
5. Run the applicable [execution gates](AI_NATIVE_EXECUTION.md#normal-code-change-gates).
   Record source changes and actual evidence in the TASK-234 packet. Keep the task
   open until an authorized real-model run and common DoD are satisfied.

No external credentials or spend are needed for steps 1–4. Actual provider usage
requires an approved account, model, data policy and cost authority; never request
secrets in chat. No deployment is authorized by this plan.

## Delivery lanes and dependencies

- **Primary pilot lane:** TASK-234 -> TASK-236 -> TASK-231 -> TASK-237. Both 236 and
  231 depend on 234; the ordering between them follows the execution guide.
- **Production lane:** TASK-199 -> TASK-201 and TASK-209. An unchanged public 502
  with no authorized origin access is not solved by repeating the same probe.
- **Business acceptance lane:** TASK-238 owner decisions and TASK-204 qualified tax
  review. Prepare concrete evidence independently; do not invent settlement or
  statutory business decisions.
- **Supporting release gates:** TASK-202 Pack production UAT, TASK-205 Vision,
  TASK-017 real phone, TASK-193 administrator recovery. Tenant recovery now has
  [local proof](ai-native/evidence/TASK-193-2026-09-09.md); Platform email recovery
  and real SMTP remain open. These tasks do not replace the pilot goal.
- **Final release:** TASK-239 consumes its registered dependencies, exact deployed
  revision, real pilot acceptance, rollback/recovery and operational handover.

## Continue without losing the goal

At each checkpoint, state the user outcome, the evidence just gained, the remaining
unverified boundary and the next safe action. Continue ordinary authorized local
implementation and testing without asking the user to choose each engineering step.
Ask only for missing business intent or external authority/resources needed for
that step; keep independent eligible work moving.

Before switching to a supporting task, record why it advances or unblocks the
current milestone. Do not select work merely because it is small or convenient.
Preserve unrelated worktree changes. Do not create duplicate tasks for substeps.

Use the existing GOAL count command; completed documentation or repeated baseline
tests must not raise capability completion. Keep local fixture, real provider,
PostgreSQL, browser, remote CI and production evidence distinct. This plan does
not schedule background execution after the active session ends.
