# ERP goal execution plan

Latest full workspace regression — 2026-09-11: `npm test -- --run` exited 0 with
204 test files passed, 3 skipped, 901 tests passed and 3 skipped in 1186.52
seconds. This supersedes the previous 900-test local count while remaining
repository-only evidence; PostgreSQL target, production, public Tunnel, OCR,
provider and human acceptance remain separate gates.

TASK-236 durable workflow checkpoint — 2026-09-11: the merged revision
`fc64f342c95a74702967cf339d86e1c63e4caf6c` persists `receipt_pack.create` run/step
state, hash-only trigger provenance, leases, checkpoints and bounded attempts.
Approval waiting, pause/resume/cancel, current grant/module/intent rechecks,
transactional outbox deduplication, PostgreSQL two-worker proof and Pack/PDF result
reconciliation are covered by focused PGlite/PostgreSQL tests plus the existing
outbox/telemetry and Agent integration suites. S1-S5 and repository common-DoD
acceptance are complete; provider, production and business-owner gates remain
separate. See [TASK-236 evidence](ai-native/evidence/TASK-236-2026-09-11.md).

The fixture-only `scripts/receipt-assistant-pilot.ts --fixture` runner also
completed for both C-SG and C-MY against fresh private PGlite databases. It
detail-read and hash-checked every selected receipt, required the exact digest
before one Pack write, reopened the database and verified the persisted Pack/PDF.
The confirmation was simulated and the provider was a local OpenAI-shaped
fixture, so this remains technical evidence rather than real-provider or
business-user acceptance.

Hosted Demo checkpoint — 2026-09-11: the latest successful Pages workflow
serves the current branch; its application assets come from code release
`ae7a3cfabde0e03a704d943dc1d99cc3bb672e2a`. A fresh public-origin browser
context completed Setup Wizard with `expenses_tax`, confirmed one explicitly
labelled synthetic Company Receipt, called the live Demo gateway
(`/demo/session` 201 and `/demo/v1/responses` 200), required visible
confirmation and read back one persisted Pack and PDF. This proves the
deployed Demo UI/gateway/command boundary; it does not establish production
OCR, a real provider account, public Tunnel health or human business
acceptance. Full evidence is in
[TASK-234 hosted E2E evidence](ai-native/evidence/TASK-234-2026-09-09.md#public-pages-deployment-and-hosted-demo-receipt-to-pack-e2e--2026-09-11).

Latest production renderer checkpoint — 2026-09-11: release
`03487b13ce838407d97cd00697bd2b54b4a7c918` is healthy across API, Web,
calendar-worker and PostgreSQL, with matching API health and Web `release.json`
revisions. The application-only release recreated all application containers and
did not migrate or reset the database. The tiny-image PDF repair keeps the governed
source bytes and emits a readable identity page for sub-2×2 PNG/JPEG sources; final
SG/MY PDFs are two-page A4 artifacts with embedded Noto OpenType fonts and no page-2
image XObject. Final private artifact hashes are SG
`3bcba83bc29d60f407c6a6ec9194702b3a9d9c8734270e0904c2235ebfc18b69` (28,263,373
bytes) and MY `4a377d1ef83945709109c3b07e7e9f0d435ddca89c09a81713651c04810d210a`
(28,263,378 bytes). The source rows are still synthetic 68-byte 1×1 PNGs, so
human business acceptance and replacement with a readable receipt source remain open.
Public `/erp/health` remains HTTP 502 until the prepared system Tunnel route is
activated.

Production Receipt-to-Pack pilot baseline — 2026-09-10: the fresh local production PostgreSQL
environment exercised the coherent API/Web revision
`9ec8c0e5c1361dfe77c8a3e8cdca4730e0b56e05`. Authenticated SG/MY employee sessions
completed clean-evidence inspection, manual metadata confirmation, Receipt creation,
exact selection preview, immutable Pack persistence/readback and two-page PDF export.
The source versions are ClamAV-clean. No old data was imported. The system Tunnel
still lacks the `/erp` route and public HTTPS returns 502; production OCR is not
configured, so extraction is dead-lettered after scanning. The artifact hashes and
remaining visual-review/public gates are recorded in
[TASK-234 production evidence](ai-native/evidence/TASK-234-2026-09-09.md#production-receipt-to-pack-pilot--2026-09-10).
The prepared Tunnel candidate passes cloudflared ingress validation; the active
system configuration remains unchanged until administrator authentication.

CI checkpoint — 2026-09-10: GitHub Actions run
[34475283757](https://github.com/yapweijun1996/ERP-System/actions/runs/34475283757)
completed successfully for production/Demo revision
`b9326f87732d904dc640d78d8b783418f5e9eb90`; all four Vitest shards and the
aggregate typecheck, transaction/security proof and Demo build job passed. Pages
run [34475283620](https://github.com/yapweijun1996/ERP-System/actions/runs/34475283620)
also completed successfully. The later production release `9ec8c0e` contains the
HR tenant-context/idempotency fix and has targeted local tests, lint, typechecks and
image verification; a full CI run for that delta was not rerun. Public Tunnel
activation, production OCR readiness and human visual PDF review remain open.

Current workspace verification — 2026-09-10: `npm test` completed with 204 test
files passed, 3 skipped; 900 tests passed, 3 skipped. This is additional local
regression evidence for the current dirty workspace and does not replace the
separate production image, public Tunnel, OCR or human visual-review gates.
Schema drift, permission registry, Demo schema/pack, both i18n generators and
production-RLS coverage checks also passed; the local release verifier matched
all 126 production asset hashes and the 9ec8c0e revision.

Browser smoke — 2026-09-10: `npm run smoke` passed the Demo dashboard at 1280×800
and 375×812 with the expected title/content and zero console or page errors. This
is local browser evidence; public Tunnel, production OCR and human PDF review are
still separate gates.

TASK-234 focused recheck — 2026-09-10: 16 runtime/API/provider/assistant test files
and 115 tests passed. The Demo Receipt Assistant workspace E2E and isolated
authenticated Company Receipts API E2E both passed, including Pack/PDF assertions;
the real-provider and public Tunnel gates remain separate.

WebMCP native recheck — 2026-09-11: Chrome 152.0.7977.83 with the official
`WebMCPTesting` flag passed the six governed Receipt/Pack tools, visible
cancellation/confirmation, one-Pack/PDF persistence, permission/Company/navigation
retirement and 375px bounds in an isolated Demo fixture.

Overnight production recheck — 2026-09-11: loopback revision
`03487b13ce838407d97cd00697bd2b54b4a7c918` and all four Compose services remain healthy;
public `/erp/health` remains 502 because the active system
Tunnel lacks `/erp`. The guarded candidate still passes cloudflared ingress
validation, with no system configuration change.

Pack result handoff — 2026-09-11: SG and MY persisted PDF artifacts were queued to
the current Codex panel for operator review; the queue result does not establish
human visual acceptance.

Production Pack source-image audit — 2026-09-11: both fresh-production source
versions are 68-byte PNGs with `1x1` dimensions. The two-page A4 Pack PDFs retain
valid hashes and a readable register page, but page 2 contains only the source
pixel. This is a synthetic pilot-material limitation; replace the source with a
readable receipt image/PDF before business sign-off.



Earlier local deployment checkpoint — 2026-09-10: revision b9326f87732d904dc640d78d8b783418f5e9eb90
was the pre-pilot API/Web image. It established the `/erp` redirect, health,
initialized setup and 126 asset hashes before the HR idempotency release. The
current coherent production revision is recorded at the top of this plan; public
cutover still requires the prepared system Tunnel activation and subsequent HTTPS
health/revision verification.

Release verification — 2026-09-10T11:57:17Z: translation repair
539f4f008308a07b4023fb49e31028905bdce1e3 is deployed by Pages 34473757892.
All 135 served assets match the committed build; the empty .nojekyll marker is
separately unserved. All 859 build inputs match the snapshot and the original
index is unchanged. Desktop/mobile smoke, 50-route transaction layout and the
operational workspace layout audits pass with zero console/page errors.
CI 34473757884 remains running; full-screen local audit is running. Production
root and health still return HTTP 502; no production migration/deployment claimed.


Current verification checkpoint — 2026-09-10: CI 34469731319 finished with one
blocking hardcoded Goods Receipts description in the desktop i18n matrix. All four
Vitest shards and preceding lint/type/schema/PostgreSQL/transaction/build gates
passed; subsequent browser gates were skipped. The description now has all five
locale resources; the targeted desktop/mobile matrix (10 combinations), local
lint/typechecks, build and PGlite proof pass. Full CI rerun remains pending.
Screen-saver automatic start was disabled at the user request (idleTime=0).
CUA now reads Chrome successfully; previous lock reports must not be treated as
proof that the user manually locked the Mac. The existing Receipt Pilot Singapore
Incognito workspace was located; the live account/receipt/Pack pilot remains open.


CI checkpoint — 2026-09-10: run 34469731319 for 0e204ff passed all four Vitest
shards, lint, both typechecks, generated-schema/drift/permission checks, PostgreSQL
16 non-superuser security lifecycle and the PGlite/PostgreSQL transaction/concurrency
proof. The build passed; the five-language desktop/mobile browser matrix is running.
Remaining smoke/screen/layout/subpath checks are pending, so full CI is not accepted.
Native Chrome again reports Mac locked; unlock request pending. No real receipt
upload, human selection confirmation or persisted live Pack outcome is claimed.

Automatic credential release verified — 2026-09-10T11:17:30Z: revision
`0e204ff60ba308a75ca2c7f31b9b3e73d2975864`, Pages run 34469731345 succeeded.
All 135 served files match the exact committed local build by size and SHA-256;
the empty .nojekyll marker is separately unserved. Original worktree/index retained.
Latest CI 34469731319 remains running; previous CI 34464383875 passed all four unit
shards before its aggregate job was superseded/cancelled. No full-CI acceptance is
claimed. Native Chrome follow-up was unavailable because the Mac locked again.
The old manual-password request is obsolete. Refresh and resume ordinary Add Staff:
password generation is automatic, followed by employee-record Account handoff.
No email was sent; production deployment and real Receipt-to-Pack acceptance remain open.

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

Earlier TASK-234 checkpoint — 2026-09-10, superseded by the production pilot:
shared G06 intent and Pack persistence
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
Actual human PDF inspection, public Tunnel/OCR readiness and the same-run live
server-assistant pilot remain open.

The default browser gateway is `https://gpt.yapweijun1996.com/demo` / `demo-auto`.
One synthetic query on the registered GitHub Pages origin succeeded (117 reported
tokens); tested localhost origins were rejected. This is protocol evidence only,
not full Receipt-to-Pack/operator acceptance. Requests send user query text, not
receipt files, and do not occur at startup. See [AI_PROVIDERS.md](AI_PROVIDERS.md).

Reviewed: **2026-09-10**. Goal owner: product owner. Execution/evidence owner:
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
**Integrated regression:** the latest full run exited 0 with 204 files / 901 tests
passed and 3 PostgreSQL files/tests skipped because POSTGRES_URL was unset.
This supersedes the previous 900-test count and historical MCP fixture-clock
failures. PostgreSQL and real operator acceptance remain open. See [regression
evidence](ai-native/evidence/TASK-234-2026-09-09.md#full-workspace-regression-recheck--2026-09-11).
**Pilot runner:** `scripts/receipt-assistant-pilot.ts` now rehearses fresh disk-backed
SG/MY fixtures through authenticated APIs and verifies persisted Pack/PDF after
database reopen. It now requires individual receipt detail reads and saves exact
source versions with matching hashes before confirmation. Exact-confirmation
rejection creates no Pack. Register font declarations/digit mapping and complete
wrapped fields now have local PDF rendering evidence. File access does not prove
human viewing.
**Next:** open the persisted SG/MY Pack PDFs from the local production pilot and
record business-user visual confirmation. Public Tunnel activation, production OCR
readiness and the live server-assistant provider remain separate gates. The user
selected and authorized the public GPT Demo gateway; its registered Pages-origin
protocol is live and sends query text only. Native Chrome DevTools evidence remains
unavailable, and the public query-proposal flow does not prove server native tools.

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

- **Primary pilot lane:** TASK-234 -> TASK-236 -> TASK-231 -> TASK-237. TASK-236 is
  complete for repository scope after PostgreSQL and remote acceptance;
  both 236 and 231 depend on 234, and the ordering follows the execution guide.
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
