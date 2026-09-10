# ERP goal execution plan

Automatic credential handoff — 2026-09-10: user-directed Add Staff now generates
secure passwords automatically. The API uses Node crypto and Demo uses Web Crypto,
with 24 random bytes. Shared onboarding stores the login hash and seven-day encrypted
handoff atomically; existing-identity links preserve credentials. No manual password
entry or activation is required. Creation stays on the employee record. HR-write
operators can copy the password and generate/copy a complete English email template
for manual delivery. Every copy rechecks the reveal boundary; responses are no-store,
clipboard failure is explicit, and plaintext is not persisted or automatically sent.
This supersedes the earlier operator-password-entry handoff. Local regression passes 4 files / 20 tests plus desktop/375px browser copy, template,
login and permission checks. Lint, both typechecks, PGlite proof, build, i18n and
documentation checks pass; release verification follows.

Native Chrome resumed — 2026-09-10: user selected A and the Mac unlocked.
The existing Receipt Pilot Singapore workspace was preserved and refreshed to the
new account-access release. The actual Add Staff screen now shows Password and
account-ready-after-creation wording; the old activation/first-use expiry/forced
change copy is absent. The synthetic staff profile was re-entered and the browser
is at Login identity with the account password awaiting operator entry. No account
has been created or receipt uploaded yet. Two route-label fallback warnings were
visible in DevTools; no failure was attributed to them. CI 34464383875 shards 2/4
and 3/4 passed; shards 1/4 and 4/4 remain running. Full CI is not yet accepted.

Release verification — 2026-09-10T10:09:19Z: account-access revision
`55a57b39302fc6bdf44a68bcd4ccfdbf9c45545f` is deployed by Pages run 34464383892.
All 135 served files match the committed local build by size and SHA-256; the empty
`.nojekyll` marker is separately unserved. CI run 34464383875 is still running;
no full-CI or production PostgreSQL migration acceptance is claimed. Native Chrome
follow-up was unavailable because the Mac was locked. The 40 local focused tests
and desktop/375px synthetic browser results remain the verified account evidence.

Account access policy — 2026-09-10: Demo and real Company accounts are ready
immediately on creation, including administrator and employee flows. Mandatory
first-login activation and forced initial password changes are removed from the
shared commands, API guard and browser adapters. Migration 0111 clears legacy
pending state without changing passwords, role grants or disabled/offboarded access.
Password resets still revoke sessions; encrypted password handoff expiry does not
expire login credentials. The historical onboarding commit command is retained for
compatibility and is not a separate user activation step. Local verification: 19
account/onboarding/API tests, 11 session and 10 auth lifecycle/freshness tests,
desktop/375px creation and direct
employee login, zero browser console errors, lint, both typechecks, PGlite transaction
proof, Demo build, generated artifacts and documentation checks pass. The normal
employee login also clears prior Demo impersonation state. Production PostgreSQL
rollout and the real Receipt-to-Pack operator pilot remain separate acceptance.
See [account access evidence](ai-native/evidence/TASK-234-2026-09-09.md#immediate-account-access--2026-09-10).

Current TASK-234 checkpoint — 2026-09-10: shared G06 intent and Pack persistence
commands are now browser-compatible factories. Server facades preserve their
existing APIs; Demo runtime binds both factories with Web Crypto and shared audit.
The Demo Pack path uses shared creation/replay commands and enforces the reviewed
selection digest. Demo preparation, persisted approval and execution now use shared
G06 commands with actor/Company ownership and transactional audit. Local integration
and Company Receipts browser regression pass; authentication remains synthetic.
Real operator acceptance remains open. Pages release
`6f06a883bdddbdb86d92ca5f1fa233534246c5d4` is deployed by run 34426075225.
All 135 served assets match the clean committed build; the remaining manifest
entry is the unserved empty `.nojekyll` marker. The previous release has a
hash-verified local rollback copy. Full-suite local regression passed: 895 tests,
with 3 PostgreSQL tests skipped. Remote CI run 34426075276 completed successfully for revision 6f06a883. The prior login revision passed
all four unit-test shards before being superseded by this menu repair. Earlier revision eaf7f6 passed
all four unit-test shards, PostgreSQL 16 non-superuser security lifecycle and
PGlite/PostgreSQL transaction/concurrency checks; this is not whole-CI acceptance.
Browser access resumed. The real existing-Master setup path exposed a static
catalog/entitlement mismatch. The local repair projects actual Master availability,
disables unavailable modules/dependencies and preserves the shared write guard.
Eight focused tests, four browser viewports and common local gates pass. The
repair is deployed; full human pilot acceptance remains open. Chrome control
again requires Mac unlock. Continue in an isolated fresh Demo session or an
already authorized workspace; do not overwrite the old Master's disabled modules.
The isolated live setup completed, but login exposed a Company-scope restoration
bug that substituted the seeded owner for the new administrator. The deployed Demo
adapter repair restores actual role membership before payload loading and retires
invalid sessions without identity fallback. New login/reload/revocation assertions
and the receipt browser regressions pass. All 135 served release assets were
verified against the committed build at 2026-09-10T01:25:31Z. Mac unlock still
blocks the next real Chrome pilot step; no human acceptance is claimed.
A later native Chrome reload showed the new administrator correctly. Closed shell
menus then obstructed accessibility navigation: opacity-only hiding preserved
invisible menu controls. A shared visibility-state repair passes before/after
browser regression at desktop/375px and common local gates. The repair is deployed;
all 135 served assets match the committed build at 2026-09-10T01:37:26Z.
Native Chrome now confirms correct Company/identity, closed-menu navigation and
Company Receipts access. My Receipts correctly requires an employee; a new synthetic
staff draft is prepared. The 2026-09-10 user decision below removes mandatory
first-login activation for Demo and real Company accounts.
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
The user selected and authorized the public GPT Demo gateway. The reviewed current
build is now hosted on its registered Pages origin. No gateway registration or
Pages environment protection was changed. Browser control reported the Mac locked;
manual unlock is the next required input for live page interaction. Remote CI
continues independently. Simulated confirmation is not human acceptance, and the
public query-proposal flow does not prove server native tools.

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
