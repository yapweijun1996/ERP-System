# TASK-234 — Deliver the server AI runtime and contextual ERP workspace

Goal: **G07** · Current status: **In Progress** · Priority: **P1**.
Live status and dependencies: [task registry](../../tasks/tasks.jsonl).
Required tasks: **TASK-230**.

Read the [execution guide](../AI_NATIVE_EXECUTION.md) before starting.
Use the [pilot cases](PILOT_TEST_MATRIX.md) and [evidence template](EVIDENCE_TEMPLATE.md).
The five S-checkpoints are execution checkpoints, not five new task records.
Check a checkpoint only after its listed exit is observed and recorded.
All four G07 criteria plus common DoD remain required for task completion.

## User-authorized Demo review and upload repair — 2026-09-11

Use the existing Demo endpoint and let Codex perform OCR/receipt/PDF review;
the user explicitly requires no manual action for this Demo run. Do not ask for
a separate provider key or human-review action to repeat this approved scope.
[New dated evidence](evidence/TASK-234-2026-09-11-codex-demo.md) records the real
Demo gateway call, readable source, explicit delegated confirmation, one persisted
Pack and matching authorized PDF hash after reload. This is Demo evidence with
isolated module/scan fixtures, not production OCR or the separate server-provider gate.

S4 supporting defect: My Receipts now unwraps `contextResponse.data` before
reading capabilities, so authorized employees can select/upload receipt files.
The focused source regression now preserves this envelope guard across future
screen changes; see [dated regression evidence](evidence/TASK-234-2026-09-13-my-receipts-capability-regression.md).
The browser-level authorized-control check is recorded in [the dated browser
evidence](evidence/TASK-234-2026-09-13-my-receipts-browser-controls.md).
The existing command authorization remains authoritative. Verify positive and
negative capability rendering plus actual upload at desktop/375px. Before the
authorized publication, the local fix was verified but not deployed. A 2026-09-11 public Pages recheck with the real
Finance Preparer persona showed no upload controls and found the published bundle
reading `d.capabilities` directly. The 2026-09-13 read-only `release.json` and
bundle recheck still identifies revision `976a863eabcb8f1499308a64dac646146ed44b6e`
with the same pre-repair application and screen assets; the wizard scroll CSS is
present. See the [dated public bundle recheck](evidence/TASK-234-2026-09-13-public-bundle-recheck.md).
That pre-publication record is superseded by the hosted verification below.
The hosted run used a temporary equivalent override only for the earlier local
Demo evidence.

## Authorized Pages publication and hosted no-override verification — 2026-09-13

The release owner authorized publication of the current candidate. The merged
Pages workflow `34751369035` completed successfully and `release.json` reports
the exact published revision `a67595d5b67d24d6dfcc02b0c04f89c0e6c391ae`, Demo
mode and 136 files. A fresh hosted Chromium session then used the normal Demo
setup/login and navigation paths. The restricted Company Receipts page rendered
the exact visible title `Expenses & Tax unavailable` with no literal `&amp;`. My
Work → My Receipts exposed `Take photo`, `Choose file` and `Sync all`; an actual
5 KB PNG upload changed from `Offline draft 1` to `Stored securely 1` and
remained after reload as `Quarantined · scanner unavailable`. No source,
network, module/permission or business-table override was used. See the [merged
hosted evidence](evidence/TASK-234-2026-09-13-merged-hosted-no-override.md) and
the [prior hosted evidence](evidence/TASK-234-2026-09-13-hosted-no-override.md)
for the earlier `d936a348` publication.

This closes the hosted Demo publication/title/upload visibility gap. The scanner,
real provider/OCR, production and human Finance/QA Pack/Print gates remain open,
so TASK-234 stays In Progress and no G07 criterion or S-checkpoint count changes.
S5 supporting exit: Codex checked both PDF pages and exact persisted identity.
No existing S checkbox or full G07 criterion is newly promoted by this increment.

Latest browser-tested Pages revision `07d2b08d34b6fe9aa52bf06fb50386befc7709c8` was rechecked
after the documentation release. A fresh normal Demo browser session rendered
the exact `Expenses & Tax unavailable` title without `&amp;`, uploaded the 5 KB
PNG through My Work → My Receipts, observed `Stored securely 1` and
`Quarantined · scanner unavailable`, and retained the row after reload. Browser
console errors and warnings were both zero; no source, response, permission,
module or business-table override was used. See the [current hosted
no-override evidence](evidence/TASK-234-2026-09-13-current-hosted-no-override.md).

The merged revision's remote CI run `34751368911` is separately tracked. It
reached a terminal failure after all four Vitest shards, pre-browser source,
generated, database, Demo and build gates, the i18n matrix/report upload and the
desktop/mobile Browser smoke test succeeded. The Screen audit reported one
failure, `LAYOUT [desktop:user-mgmt] transaction-list-v1 root missing`, and the
job skipped later layout/public-subpath/cleanup steps. The local bounded
recovery budget is now 30 seconds and the focused desktop/mobile list and full
screen audits pass; a fresh candidate CI terminal run is still required. See
the [merged CI failure evidence](evidence/TASK-234-2026-09-13-merged-ci-failure.md)
and the earlier [merged CI progress record](evidence/TASK-234-2026-09-13-merged-ci-progress.md).

The fresh candidate CI run `34755628672` for `a6b2bb7d836d5bd2dfc3914637b80400e97f8c6d`
also reached a terminal failure at the same `desktop:user-mgmt` list-root
assertion after all pre-browser gates, i18n and Browser smoke passed. The
transaction-list, operational-workspace, public-subpath and cleanup steps were
skipped. The follow-up audit repair now retries one bounded route navigation
when the list root is still absent after the 30-second wait; local 50/50 and
full 130-route desktop/mobile audits plus lint pass. See the [fresh CI failure
evidence](evidence/TASK-234-2026-09-13-fresh-ci-failure.md).

Hosted CI run `34759696683` then completed successfully for repair revision
`20e8af00da0a9a4fdeee2a73b88abe2fde9bc791`. All four Vitest shards and the
combined source/generated, PostgreSQL, Demo, i18n, Browser smoke, Screen,
transaction-list, operational-workspace, production public-subpath and cleanup
gates passed; Pages run `34759696630` also completed successfully for the same
revision. This closes the audit-recovery regression-safety boundary only. It
does not promote G07.3: approved provider/model/data-policy/spend scope and a
same-run real-provider receipt-to-Pack proof remain required. See the [terminal
retry evidence](evidence/TASK-234-2026-09-13-ci-retry-terminal.md).

The documentation-only descendant `71d14f2bbd7bcd4b8c0aaabbf1964d99d2a8dfea`
also passed hosted CI run `34764953884`: all four Vitest shards and the
combined source/generated, PostgreSQL, Demo, i18n, Browser smoke, Screen,
transaction-list, operational-workspace, production public-subpath and cleanup
gates completed successfully. This confirms repository regression safety after
the evidence refresh; it adds no product capability and does not promote G07.3.
Approved provider/model/data-policy/spend scope and same-run real-provider
Receipt-to-Pack evidence remain required. See the [docs-only CI terminal
evidence](evidence/TASK-234-2026-09-14-ci-docs-terminal.md).

## Remove mandatory account activation — user decision 2026-09-10

Outcome: accounts created in Demo or a real Company are usable immediately.
There is no employee first-login activation form or activation-only session.
Staff onboarding still creates the employee, identity, Company membership and
roles atomically; creating an account is not a permission bypass. Password reset
still replaces the credential and revokes sessions, without another activation.

Ownership: employeeAccount/staffOnboarding own initial account state; auth/session
and HTTP own login and access checks; browser adapters/shell own the retired
activation screen; migration owns existing preactivated accounts. Encrypted
credential handoff may expire independently of the account password. Preserve
password verification, offboarding, role/tenant checks and audit. Retain historical
schema/audit compatibility rather than deleting governed records.

1. Remove pending-activation state from creation/reset commands and migrate old
   pending flags without changing passwords or re-enabling disabled accounts.
2. Remove activation login/API/page gates and retire the completion endpoint.
3. Update account/staff wording and both adapters consistently.
4. Verify immediate authenticated API/employee access, password reset invalidation,
   disabled/offboarded/foreign-Company denial and migration behavior. Run common
   gates and desktop/375px browser checks before deployment and the live pilot.

Browser verification also exposed a pre-existing Employee-role validation mismatch:
0097/seed/showcase include own Company Receipt create/edit/void grants, while the
account helper accepted only the older six grants. Accept exactly the legacy six
or current nine, still rejecting privileged/altered permissions and scopes. New
base roles use the existing nine-grant contract; existing roles are not rewritten.

## Remove closed menus from accessibility navigation — 2026-09-10

Real Chrome reload now exposes the new administrator, but closed shell menus
remain in the native accessibility tree. The shared .pop CSS uses opacity and
pointer-events only, leaving invisible menu controls discoverable and focusable.
The shell stylesheet owns visibility; no Company, authorization or receipt
command changes are required. Hide closed menus from accessibility and keyboard
navigation while preserving normal open/close behavior and animation.

Verify the existing desktop/375px setup-login regression: no closed menus in
role navigation, account menu available when opened and absent after Escape.
Run common gates and then verify native Chrome after release. This supporting
repair does not replace the pending real gateway/evidence/human/Pack outcome.

## Restore the actual Demo login identity — 2026-09-10

The isolated live pilot completed setup, but signing in with the new Company's
administrator rendered the original seeded Company Owner. Demo boot reset scope
to C-SG; the selected user was absent from that Company's role projection, and
applyData silently chose another owner. Repair this before further pilot writes.

The Demo adapter owns browser workspace preference restoration, not business
permission grants. Resolve the selected human account's actual same-Master role
memberships before loading Company data. Restore a saved Company only while it
remains authorized, otherwise choose an authorized membership. Never substitute
another identity for a requested account. Invalid membership retires the local
session; Company switching also requires current membership for owners.

Verify new-Company setup -> real login form -> correct user/company -> reload,
rejected stale Company preference and revoked-membership sign-out. Preserve Demo
persona selection, public one-click fixtures, shared commands and API auth policy.
Run existing setup/receipt browser regressions and common gates before release.

## Existing-Master setup obstruction — 2026-09-10

The deployed real-browser pilot found an upgraded existing IndexedDB Master with
Expenses & Tax disabled. The first-run wizard recommended that module from the
static catalog, then the shared setup command correctly rejected the selection.
Fix the read projection, not the entitlement guard: the Demo wizard must display
existing Master availability/default allocation and disable unavailable modules
or dependencies. Missing configuration uses the same trusted-bootstrap defaults;
reading the catalog must not create or enable entitlement rows. Production's
new-Master setup defaults remain unchanged.

Source owners: moduleProvisioning.ts supplies the scoped catalog projection;
Demo runtime/adapter transports it; screens-setup-wizard.js renders availability.
Verify disabled existing modules/dependencies, cross-Master isolation, no read-side
writes, unchanged fresh-Master defaults, and desktop/mobile wizard behavior. Then
resume the registered-origin pilot using normal authorized module allocation.
This supporting repair cannot establish human Pack acceptance.

## Freeze the reviewed Pages source — 2026-09-10

Outcome: bind the registered-origin pilot to a reproducible Git revision while
preserving the operator's existing worktree and index. This release snapshot
includes the accumulated TASK-228/229/230/232/233/234/235 dependencies, documented
recovery fixes and locale repairs. It is not a receipt-screen-only release.

1. Review changed entry points, shared commands, default-deny server activation,
   generated migration custody and the public gateway boundary against their tests.
2. Create an isolated local release ref with a temporary Git index; include only
   the inventoried repository paths. Record the parent, tree and commit identity.
   Verify that the original index and worktree remain unchanged by this operation.
3. Build that clean source revision with the Pages base and verify the artifact
   manifest and startup. Compare source inputs with the already tested candidate;
   any material difference invalidates that earlier evidence for the new revision.
4. Use the existing main-only Pages workflow after source review. Verify its exact
   deployed revision and assets before starting the real gateway pilot. No change
   to environment protection or gateway origin policy is part of this checkpoint.

Observable exit for the local freeze is a clean isolated source ref, matching
candidate input hashes and a verified build tied to that commit. This exit does
not complete deployment or human acceptance. Existing applicable authorization
is retained; the plan itself does not create new authority.

## Refresh the registered-origin candidate — 2026-09-10

Build the current verified source with the production Pages base path into a new
private output directory, preserving web/dist and earlier artifacts. Write a
release manifest explicitly labeled local/uncommitted, add normal Pages fallback
files, and verify every asset byte count/hash plus required gateway, approval,
evidence and PDF entry points. Serve only on loopback for path/startup inspection.
No source commit, push or deployment is implied by a successful local candidate.

The existing Pages site uses the official Actions workflow; a directory upload
alone cannot publish it. Before a release, review the accumulated worktree and
verify an exact source revision through that workflow. The live pilot must use a
registered real origin, never a forged Origin header or transplanted session.
Candidate readiness is not human or real-model acceptance.

## Inspect exact original evidence — 2026-09-10

Add a document-content adapter in Demo/API and an original-evidence action per
assistant row. Resolve the current receipt through its governed detail command,
match receipt/document versions and hash to the preview, then read the explicit
document version. Reuse accessManagedDocument for permission, scan and access audit;
Demo supplies only a read-only database storage provider with Web Crypto integrity.
Extract the unchanged scan guard to scanAccess.ts; processing.ts preserves its
exports so browser reads do not import the server worker/session dependency graph.
Likewise storageRead.ts/accessCommands.ts own the unchanged read/ownership/audit
policy with an explicit registry; existing server wrappers preserve default storage.
The shared error class remains identical across both paths. Demo calls the
transaction-internal access entry from its existing transaction; the server
wrapper opens a transaction. Do not nest an ORM transaction on a PGlite client
that is already inside the native browser transaction.
API uses the existing documents content endpoint and purpose/idempotency headers.
No receipt permission may imply document-management authority. Render bounded
PDF/PNG/JPEG/WebP bytes only after hash verification; close revokes temporary URLs.

Verify denied/quarantined access, mismatched evidence refusal, exact-version read,
no approval/execution from inspection, desktop/375px rendering and cleanup. Run
common local gates and affected browser tests. Actual human review and real gateway
acceptance remain open; browser automation cannot attest to human inspection.

## Review every selected receipt — 2026-09-10

Outcome: every selected row is reachable before confirmation, with amount,
currency, purpose, receipt/version and original-file facts. The Company Receipts
screen renders the first 20 rows and exposes the existing localized Load more
action in bounded batches of 20. The action is presentation-only: selection and
digests, approval commands and server authority remain unchanged. Source owner:
the existing Company Receipts screen; regression owner: the assistant workspace
E2E. The current recheck is recorded in the [dated evidence](evidence/TASK-234-2026-09-13-progressive-preview.md).

The 2026-09-13 Demo recheck verifies a 21-row preview, expands and inspects the
last row, preserves its fields and confirmation payload, and checks desktop/375px
layout. Common CLAUDE gates and the affected browser regression pass. This proves
review availability only; original-file inspection and real-provider human
acceptance remain separate open gates.

The same assistant inspection path now accepts governed HEIC/HEIF originals after
matching the receipt/document version and SHA-256. Browsers that cannot decode
those formats receive an explicit governed-original explanation and a download
link retaining the original file name; PDF/PNG/JPEG/WebP previews are unchanged.
The focused Company Receipts E2E verifies the split and object-URL cleanup. This
is local source/Demo evidence and does not close production or human acceptance.

## Open the verified assistant result — 2026-09-10

Outcome: after governed assistant success, the user can open that exact persisted
Pack PDF inside the assistant. Scope is the existing vanilla-JS screen and focused
browser regression; no gateway access changes, new Pack creation or deployment.
Depend on the completed persisted approval binding. Read by the returned Pack ID,
verify the bytes against the completion artifact hash, and render only after the
same assistant/context remains active. Revoke temporary URLs on close. Denied or
changed artifacts remain visible errors with no replacement record creation.

Checkpoints: add the result action using existing localized Pack labels; verify
same-ID read, no additional execution, hash mismatch refusal, desktop/375px layout;
run lint, both typechecks, isolated Demo, build and affected browser regressions;
record evidence. Browser opening proves the preview was rendered, not human review.

## Demo persisted approval bridge — 2026-09-10

Bind the Demo adapter's preparation, decision and execution to shared G06 commands.
A local-only bootstrap creates a synthetic, non-login assistant identity per
Company/actor with no credentials or role grants; never reactivate a revoked
identity. The bridge derives actor/scope from current Demo context, checks current
read permission, enforces intent ownership, and records execution/replay audit in
the same transaction as Pack creation. Abort/context changes before commit roll
back. Prepared intent keys remain transient UI state; only hashes are persisted.
Verify unapproved/cancelled/stale/mismatched requests produce no Pack, refreshed
approval executes and replays, and cross-actor/Company decisions fail.
The browser Demo remains a synthetic local-auth environment, not production auth.

## Shared Pack IO binding checkpoint — 2026-09-10

Extract selection/persistence/replay/list/read commands into
`companyReceiptPackCommands.ts`, parameterized only by sync/async hashing. Keep
server document storage and PDF rendering in `companyReceiptPack.ts` with its
existing exports. Bind Pack and G06 command factories in the Demo runtime using
Web Crypto and shared audit. Replace the Demo manual insert/replay path with
these commands, preserving the required assistant digest guard. Run Pack/G06/API
regressions, all-async command parity, browser Pack flow and common gates.
Principal provisioning and persisted decision/execute wiring remain the next
part of the approval repair; exporting factories alone does not close it.

## Shared approval core extraction — 2026-09-10

`agentExecutionIntentCommands.ts` now owns the unchanged persistent G06 policy
through `createAgentExecutionIntentCommands`. Its platform dependencies are typed
hashing (sync or async), audit and existing Pack helpers. The original
`agentExecutionIntent.ts` is a server facade preserving existing exports and
supplying Node SHA-256 plus server bindings. All digest-dependent operations await
hash completion. No intent schema, TTL, decision, permission or replay rule changes.

This checkpoint only makes the command core browser-loadable. Demo binding of
Pack IO, principal identity and persisted decisions still remains. The audit
attribution module itself already has a browser-safe fallback; the prior audit's
claim that audit attribution alone prevented browser imports was too broad.
Verify original G06/HTTP/MCP tests, the same intent cases with async Web Crypto,
and an actual browser-platform bundle before integrating Demo bindings.

## Demo approval persistence gap — 2026-09-10

Source audit: `receiptAssistantDecision` in the Demo adapter returns a synthetic
status without persisting an execution intent; `receiptAssistantExecute` checks
selection integrity but does not require an approved intent. Therefore Demo UI
confirmation/cancellation is not equivalent to the server G06 boundary. Do not
close governed approval acceptance from these Demo results or publish the earlier
candidate as a completed pilot.

The repair must reuse G06 approval/expiry/version/replay semantics, not add a
second in-memory approval flag. Relevant source ownership:
`src/modules/agent/agentExecutionIntent.ts` owns the persistent contract;
`src/api/receiptAssistant.ts` owns the authenticated server bridge;
`web/src/erp-demo-runtime-impl.ts` owns browser bindings. Current G06 module imports
Node crypto, server audit attribution and server Pack helpers; it is not directly
browser-loadable. Extract browser-compatible command dependencies while preserving
the existing server facade, then bind the Demo through the same persisted commands.
Verify pre-approval refusal, cancel/reject refusal, expiry, Company/actor mismatch,
version conflict, stale selection and idempotent approved replay on both paths.
The public model endpoint must never receive authority to approve an intent.

## Demo exact-selection repair checkpoint — 2026-09-10

Source audit found that Demo assistant execution drops the reviewed selection
digest and Pack creation repeats the selection query/calculation in raw SQL.
Reuse the existing shared selector inside the existing creation transaction;
compare the assistant's required digest before insert and on idempotent replay.
Keep ordinary manual Pack callers compatible when no digest is supplied. Prove
missing/wrong/stale digest cannot create a Pack, valid selection can create and
replay, and relevant Demo/API regression gates pass. This is required before
publishing the candidate; previous candidate is not release-ready.

## Local Pages candidate checkpoint — 2026-09-10

Build the current worktree with the existing GitHub Pages base-path settings into
an isolated private directory. Mark its manifest as an uncommitted local candidate,
not HEAD or a deployed release. Verify all asset hashes and the gateway script
load order under `/ERP-System/`. Preserve the existing root preview and all
unrelated changes. This produces a reviewable candidate; it does not publish the
148-file worktree, prove CI, or close the live Pack/operator acceptance gate.

## Live-session recovery checkpoint — 2026-09-10

Observed live localhost session rejection must produce an actionable bounded
configuration error instead of a generic retry suggestion. Map only session HTTP
403 to website/project access denial; never echo the remote body. Verify that no
inference is dispatched after denial and preserve cancellation, other errors and
existing ERP confirmation. This recovery repair does not close live Pack acceptance.

## User-directed Demo gateway checkpoint — 2026-09-10

Outcome: use `https://gpt.yapweijun1996.com/demo` as the default browser Demo
Receipt assistant provider, with `demo-auto` and the guide's `github-pages`
project. Acquire an origin-bound session only on an explicit assistant run; keep
its token in memory and never persist or log it. The supplied guide disables native
tools, so the model proposes only a bounded search term from the user's message;
explicit date inputs remain authoritative. Existing ERP selection, confirmation
and Pack commands own every business action. This is a real model-assisted Demo
query, not proof of the server six-tool autonomous pilot or production readiness.

## Upload envelope repair release candidate — 2026-09-11

The My Receipts screen now unwraps the `{data, meta}` context response before
reading the writable receipt capability. A detached candidate based on the
published Demo revision is `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4`; it changes
only `web/public/assets/screens-hr.js`. Candidate lint, typechecks, PGlite proof,
Demo build and a fresh browser setup passed, and the three writable upload
controls rendered without a screen override. The candidate is not pushed or
deployed; release CI, Pages publication and the server-provider acceptance remain
separate gates.

## Demo gateway rejected-response cleanup — 2026-09-11

The browser Demo gateway now cancels an unconsumed response body before returning
the bounded `demo_gateway_session_denied` or `demo_gateway_unavailable` error for
HTTP 403, other non-success responses and redirects. Session denial still stops
before any inference request. The focused gateway regression covers 403 and 503
body cancellation, and the existing assistant/browser regressions remain green.
This is a local source/Demo resource-cleanup improvement; it does not promote a
packet checkpoint or G07 criterion and does not claim a real provider, production
deployment or release-owner acceptance. See the [dated evidence](evidence/TASK-234-2026-09-09.md#demo-gateway-rejected-response-cleanup--2026-09-11t103256z).

Ownership: a dedicated classic-script gateway client owns HTTP/session/response
validation; the Demo adapter owns integration; shared domain commands remain
unchanged. API-mode encrypted Company configuration and document OCR are excluded.
Do not route real Company records or receipt files through this browser default.
Only the user's query is transmitted. No requests occur at startup.

Sequence: document the contract -> implement the bounded client and Demo adapter
integration -> inject transport success/failure/cancellation tests -> run common
CLAUDE gates -> observe browser behavior and record live origin availability.
No silent deterministic or private-key fallback. Validate response shape, text
bounds and proposed search type; keep gateway usage separate from monetary cost,
which the guide does not establish. DoD: an explicit Demo assistant submission
uses the gateway by default, proposes a query before exact ERP preview, leaves
creation behind human confirmation, and fails visibly on unavailable gateway.

## Current continuation — 2026-09-09

The active [goal execution plan](../GOAL_EXECUTION_PLAN.md) now records the local
Responses adapter, Company resolver and default-deny bootstrap implementation.
The previous missing-source audit is superseded. Complete its current verification
and the approved real-model/account/data-policy/spend journey; injected HTTP
responses do not close live acceptance. Preserve HTTP cancellation, conservative
cost custody and the existing task status.

### Runtime integration prerequisite: retry cost custody

Source review found that `aiRuntime.ts` releases a dispatched call reservation on
any exception, and `receiptAssistant.ts` carries only reported successful costs
between turns. Before enabling a real adapter, preserve unknown dispatched costs,
reconcile valid reported usage, and carry the charged budget across turns. Keep
reported spend distinct from conservative reserved exposure. Do not change Pack
commands, tenant/approval ownership or activate network providers.

Ordered exit: reproduce retry-budget escape with nonzero synthetic costs; repair
runtime accounting and conversation carry-over; verify targeted runtime/assistant
regressions and common gates; record evidence. Observable DoD: no physical call is
started when prior known plus unknown exposure cannot cover its reservation, even
across a failed attempt followed by a successful tool turn. No live cost claim is
made by these tests. Run `npx vitest run src/modules/agent/aiRuntime.test.ts
src/api/receiptAssistant.integration.test.ts` and the execution guide's common gates.

### Concrete adapter checkpoint

Implement `src/modules/agent/openAiProvider.ts`: OpenAI Responses, fixed HTTPS
origin, pinned `gpt-4.1-mini-2025-04-14` for the existing `gpt-4.1-mini`
configuration, text/custom functions only, no built-in tools or fallback. Extend
`AiMessage` with assistant tool calls and result call IDs and retain them in
`receiptAssistant.ts`. Translate canonical dotted names through a bijective wire
name map. Use explicit non-strict function schemas so optional ERP fields remain
optional; the ERP parser and dispatcher retain validation/authorization authority.

Order: protocol/limits review -> transcript and adapter -> injected-fetch tests
and governed assistant regression -> common gates -> evidence. DoD: actual HTTP
request serialization and response parsing pass for a two-turn tool conversation;
unknown tools, malformed/truncated/oversized responses, redirects, model/usage
mismatch and cancellation fail closed with sanitized errors. No external spend.
Pricing is deployment-supplied, positive, bounded and explicitly reviewed; reserve
against the full documented model context window plus capped output rather than
inventing a character-to-token cost bound. Cached input is charged conservatively
at the configured input rate. Account invoice reconciliation remains external.
Company resolver and default-deny bootstrap are the following checkpoint; this
adapter alone does not activate the assistant or close live acceptance.

Protocol sources reviewed 2026-09-09:
[function calling](https://developers.openai.com/api/docs/guides/function-calling),
[model context/snapshot](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

### Company resolver and bootstrap checkpoint

Ownership: `src/api/receiptAssistantProvider.ts` resolves only the authenticated
session Company in a tenant transaction and supplies provider plus Company limits;
`src/receiptAssistantBootstrap.ts` parses explicit deployment activation/pricing/
Agent configuration; `src/server.ts` wires those options. Existing encrypted
configuration and Agent grant resolution remain authoritative. The bootstrap must
stay unavailable by default even when credentials exist. Only global-region,
`tenant_no_training` OpenAI GPT-4.1 mini configuration is supported by this first
adapter; tenant-local/tenant-only and alternate providers/models fail closed.
`store:false` does not assert zero provider retention or residency guarantees.

Sequence: implement resolver and option binding -> test disabled/missing/wrong
Company/policy, rotation and live grant revocation without egress -> bootstrap
wiring/default-deny checks -> common gates and evidence. Pin configuration and
resolved grant snapshots for each run; compare before every egress and abort on
change. Advertise only initially granted pilot tools; changing authorization
requires a fresh run. Do not hold a database transaction across network calls.
Observable DoD: HTTP route consumes persisted Company limits and encrypted key,
unauthorized/changed configurations cannot reach injected fetch, and server source
uses the tested bootstrap. Real-provider and deployed bootstrap proof stay open.

### Integrated local regression checkpoint

After provider/bootstrap, inspection and PDF repairs, run the current full Vitest
suite once with `POSTGRES_URL` unset. This checks integration beyond the focused
suites; it does not authorize external accounts or production fixtures. Preserve
all source while the suite runs. Inspect terminal completion and every failure or
skip; never infer success from an older KB run or an active process. Diagnose a
failure before changing code, then rerun the affected tests and relevant gates.
Record exact file/test totals and omitted PostgreSQL/live/production coverage in
this packet's evidence and the authoritative status/KB. No task criterion closes
merely because a local suite is green.

### MCP HTTP test-clock repair checkpoint

The integrated suite reports failures in MCP authorization-boundary and cross-client
Receipt pilot tests. Both construct short-lived execution intents at a fixed wall
clock while the HTTP executor checks the actual current time. Confirm the terminal
error, then replace only those fixtures with a per-test current preparation time.
Keep historical receipt business dates and consistently injected unit-test clocks.
Do not change production expiry, add a client-supplied clock, or weaken approval.

Rerun both MCP suites and the Agent execution/intent regression. Check fixture
freshness before exercising cancellation or dropped-response replay so a setup
expiry cannot masquerade as a different behavior. Record the failed full run and
subsequent targeted result separately. Save the repeated mixed-clock prevention
rule in the existing project testing runbook after verification.

### Readable Pack artifact checkpoint

Pilot rendering exposed CFF/OpenType embedding warnings and silent fixed-character
truncation in the register. Ownership: `companyReceiptPackPdf.ts` owns register
font/layout; `documents/evidencePdf.ts` owns source composition and placeholder
font embedding. Correct renderer-owned OpenType/CFF font stream declarations and
disable unmapped localized alternate digits/ligatures; retain complete
register cell text with width-aware wrapping and repeated headers across pages.
Do not change stored selection, amounts, approval rules or source document bytes.
Regenerated PDF hashes can change with renderer changes; source digests do not.

Order: verify font/renderer source -> implement bounded wrapping/page continuation
and embedding -> font stream, text preservation and deterministic rendering tests
-> SG/MY governed pilot, PDF raster/text inspection -> common gates/docs/KB.
DoD: no font-type warnings on newly rendered pilot artifacts; full long fields and
Unicode remain readable without column/page overflow. Existing source attachment
ordering, failure placeholders and tenant/approval contracts remain covered.
This local artifact fix does not close live-model or production acceptance.

### Receipt inspection completeness checkpoint

The initial runner's search/prepare sequence does not prove the milestone's
inspect-evidence step. Extend only pilot orchestration: require successful
`receipt.get` results for every preview row, matching receipt version, document
identity/version and source hash. Download the exact source version through the
ordinary authenticated managed-document route, verify the byte hash, and save
private source files before presenting confirmation. Expose local paths in the
operator review. Missing/mismatched details must fail before approval; do not
change shared Pack creation policy or fabricate evidence from model prose.

Order: inspection guard tests -> fixture detail calls -> authenticated source
retrieval/private artifacts -> SG/MY and cancellation integration -> common gates
and docs/KB. Observable DoD: both sources exist and hash-match before the review
callback; rejected evidence cannot reach approval. File retrieval is not proof of
human viewing, OCR, scanner execution or model image understanding. Real-model and
operator confirmation/viewing remain separate authorized acceptance gates.

2026-09-13 identity-hardening follow-up: `verifyPilotInspection` now also fails
closed when preview receipt IDs repeat, successful `receipt.get` identities repeat,
or the successful detail identity set contains an extra/missing receipt. The
one-to-one set check runs before version/document/hash comparison and before the
review callback. New duplicate/extra identity negatives pass alongside the SG/MY
fixture runner; this strengthens local orchestration evidence without changing
tenant, document-permission or Pack command rules. See [dated identity-guard evidence](evidence/TASK-234-2026-09-13-inspection-identity-guard.md).

### Reproducible pilot execution checkpoint

Implemented a typed local orchestration harness under `src/pilot/receiptPilot.ts` and a
thin `scripts/receipt-assistant-pilot.ts` CLI. It creates a fresh private disk-backed
PGlite database with two synthetic receipts in exactly one selected SG/MY Company;
no external database or existing customer data can be selected. Reuse the Company
provider resolver and ordinary authenticated assistant/confirmation/execute APIs.

Default fixture mode injects Responses transport and labels automatic confirmation
as simulated. Live mode requires explicit mode, recorded account/data/spend approval,
a positive run ceiling no greater than USD 1, reviewed pricing and an ephemeral key.
It must require an interactive operator to type the exact selection digest after
seeing the preview; credentials alone never trigger a live run. No live mode is
executed during local implementation. Model retries stay within the single run's
existing budget. No autonomous repeat after failure.

Ordered exit: guard tests -> SG/MY fixture journeys -> exact confirmation/no-Pack
negative cases -> independent persisted Pack/PDF verification after database reopen
-> sanitized atomic evidence artifacts -> common gates. Keep model text, credentials,
session cookies, intent keys and encrypted envelopes out of the evidence report.
Report fixture vs live transport, confirmation source, usage estimate, duration,
source/PDF hashes and persisted identity separately. Opening a PDF is a separate
observable user step; saving a file must not claim that a human viewed it.

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

- [x] **S1 — Define runtime states and limits.**

  Action: Specify provider request/response/tool-call types and conversation/run states. Add explicit maximum calls, duration, output size and cost reservation policy; count retries. Start with one approved provider/model and a deterministic zero-spend test double.

  Checkpoint exit: Unavailable provider and exhausted-budget cases return actionable errors without a simulated success.

  Evidence: [TASK-234-2026-09-09 evidence](evidence/TASK-234-2026-09-09.md#s1--define-runtime-states-and-limits).

- [x] **S2 — Implement secret-safe server configuration.**

  Action: Add Company-authorized provider/model/data-policy configuration using encrypted credentials. Validate endpoints and egress. Avoid exposing credentials in browser APIs, prompt traces and audits; changing provider must be explicit.

  Checkpoint exit: Configuration, credential rotation and disallowed model/endpoint tests pass; real-account readiness is separate.

  Evidence: [TASK-234-2026-09-09 evidence](evidence/TASK-234-2026-09-09.md#s2--implement-secret-safe-server-configuration).

- [x] **S3 — Implement receipt conversation loop.**

  Action: Resolve current Company/actor; retrieve only allowed facts, propose exact Pack contents and wait for G06 confirmation. Resume through the governed executor and read actual result/artifact evidence before announcing completion.

  Checkpoint exit: P01-P12 pass through assistant tool calls; denied or ambiguous requests create no Pack.

  Evidence: [TASK-234-2026-09-09 evidence](evidence/TASK-234-2026-09-09.md#s3--implement-the-receipt-conversation-loop).

- [x] **S4 — Build the contextual workspace.**

  Action: Show sources, selected Company, preview, confirmation, progress, cancel and recovery in the current vanilla-JS UI. Preserve drafts and prevent cross-Company conversation contamination. Add five locale resources, both themes and keyboard/focus behavior.

  Checkpoint exit: Desktop/375px user can complete and cancel the pilot without hidden execution or browser errors.

  Evidence: [TASK-234-2026-09-09 evidence](evidence/TASK-234-2026-09-09.md#s4--build-the-contextual-workspace).

- [x] **S5 — Validate fixture and real-model journeys.**

  Action: Run provider/workspace tests, receipt E2E and common gates; add a real approved model run with redacted latency/call/cost evidence. Do not treat the mocked provider or wizard preview as live AI proof.

  Checkpoint exit: G07 has functional workspace, governed execution, provider-failure handling and real-provider evidence or an explicit remaining gate.

  Evidence: [TASK-234-2026-09-09 evidence](evidence/TASK-234-2026-09-09.md#s5--validate-fixture-and-real-model-journeys).

## DoD mapping: all four must pass

The numbered goal criterion is authoritative in [GOAL.md](../../GOAL.md).
The wording here mirrors the registry; update all three if a valid scope refinement
is needed. Do not mark the task Done merely because all five checkpoints are checked.

- **G07.1:** Implement a server-owned provider interface and Company configuration with encrypted secrets, allowed models, data policy, bounded timeout and per-run cost/call budgets.
  - Required evidence: Server provider/configuration and budget cases.
  - Current result: S1 defines the server-owned provider request/response/tool-call contract, explicit draft/waiting/running/succeeded/failed/cancelled run states, whole-run timeout and cancellation, input/output/call/retry/cost limits, pre-call cost reservation and stable actionable errors. S2 adds Company-scoped provider/model/data-policy configuration, encrypted AES-GCM credentials, explicit rotation/provider-change decisions, model and exact-host egress validation, bounded persisted limits, permission/idempotency/API isolation and secret-free views/audits. The deterministic zero-spend provider is local test evidence only; real provider evidence remains S5.
- **G07.2:** Provide contextual chat, cited receipt results, Pack preview and confirmation, with distinct draft, waiting, running, succeeded, failed and cancelled states.
  - Required evidence: Visible states, sources and confirmation UI.
  - Current result: S3 implements the server conversation/tool loop, cited Receipt facts, exact Pack preview, separate human confirmation/cancel endpoints and truthful draft/waiting/running/succeeded/failed/cancelled outcomes. S4 adds the contextual vanilla-JS workspace with visible sources, exact preview, confirmation, progress, cancellation and recovery states; the focused desktop/375px browser matrix passes without unexpected page errors.
- **G07.3:** Complete the real receipt-to-Pack journey using governed tools and verified database/artifact postconditions; the assistant cannot announce success from model prose alone.
  - Required evidence: Persisted Pack/artifact evidence from assistant execution.
  - Current result: S3 loopback/PGlite evidence and the S4 Demo E2E execute the approved intent through the existing governed dispatcher/command, read the persisted Pack, verify the PDF artifact/source hashes, and prove replay/no duplicate Pack. On 2026-09-10, the fresh local production PostgreSQL environment also completed authenticated SG/MY evidence inspection, human confirmation, Receipt creation, exact preview, Pack persistence/readback and PDF export; the dated hashes and container/revision proof are in the [production evidence](evidence/TASK-234-2026-09-09.md#production-receipt-to-pack-pilot--2026-09-10). This is fixture/API/operator evidence only: it is not a live assistant-provider call or public hosted server/provider acceptance. G07.3 remains open pending an approved provider/model/data-policy/spend scope and same-run provider evidence.
- **G07.4:** Prove provider failure/cancellation and zero credential leakage; test en/ms/zh/ja/vi, light/dark, desktop/mobile and accessible focus/keyboard behavior.
  - Required evidence: Failure/cancellation/secret checks and locale/theme/mobile matrix.
  - Current result: S1-S3 prove provider unavailability, cancellation, bounded failure and no-write paths; S2 proves encrypted credential non-disclosure. S4 covers en/ms/zh/ja/vi, light/dark, 1280px/375px, focus restoration, keyboard action flow, visible progress and mobile touch targets. The receipt-specific browser matrix passes, and the post-S5 TASK-232 locale follow-up now makes the full local i18n audit pass at 1,773 canonical keys / 74 local packs across 130 routes × five languages × desktop/mobile. Provider, production, remote-CI and physical-device evidence remain separate.

### Final milestone evidence boundary

| Requirement | Current evidence | Still required |
| --- | --- | --- |
| Governed find/detail/source inspection | SG/MY authenticated production sessions, exact-version source hash checks and clean ClamAV results | Approved real model making the calls, if assistant-provider evidence is required |
| Exact preview and meaningful human confirmation | MY live employee session plus the earlier SG live employee confirmation; exact selection digest and totals | Human visual review record for the source/PDF |
| Governed creation and persisted Pack/PDF | SG/MY production Receipt IDs 1/2, Pack IDs 1/2, readback and independently hashed two-page PDFs | A single same-run assistant-provider execution, if required by the G07.3 wording |
| Open and review result | Agent-rendered PDF inspection; Codex open request queued | Actual operator opens and reviews the result; browser business-user acceptance |
| Regression safety | Later local full run: 895 pass / 3 PostgreSQL skips. Revision eaf7f6 passed PostgreSQL 16 security lifecycle and cross-engine transaction/concurrency CI steps. Subsequent login/menu targeted gates pass | Remote run [34730030719](https://github.com/yapweijun1996/ERP-System/actions/runs/34730030719) completed successfully for `d936a348`: all source/generated, Demo, i18n, desktop/mobile Browser smoke, Screen, transaction-list, operational-workspace, production public-subpath and cleanup steps passed. This closes the remote CI regression-safety gate; it remains separate from production/provider/OCR and human Pack/Print acceptance. See the [terminal CI evidence](evidence/TASK-234-2026-09-13-ci-terminal.md). |
| Production readiness | Separate inherited release evidence | Approved PostgreSQL/deployment/operations and business-owner acceptance |

A CLI service-route pilot and a separate browser fixture must not be reported as
an observed real-model browser journey. Preserve these evidence classes in the
final report even after the account/spend gate is authorized.

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

## Automatic secure credential handoff — user decision 2026-09-10

Outcome: Add Staff generates a secure password automatically; authorized HR or
Superadmin can copy it and a complete employee email template for manual delivery.
Accounts remain immediately usable. No automatic email delivery is in scope.

Ownership: server credential lifecycle / browser Web Crypto generate passwords;
shared onboarding atomically stores the login hash and expiring encrypted handoff.
Existing-identity links preserve their password and expose no new handoff. HR-write
permission and authenticated Company scope protect every reveal/copy request; no
plaintext enters drafts, idempotency results, logs, audit or persistent UI storage.
The existing seven-day encrypted handoff expires independently of login validity.

1. Generate credentials at the trusted API/Demo adapter boundary and persist the
   envelope with the account transaction; retain rollback and existing-user rules.
2. Replace manual password entry with explanatory copy and finish at the employee
   record so HR can copy credentials before optionally entering employee workspace.
3. Reuse audited reveal for password/email copy, include organization, login URL,
   username and employee name, and show clipboard failure without claiming success.
4. Verify generated-password login, ciphertext-only persistence, repeat/expiry/reset,
   permission/Company denial, email contents and desktop/375px UI. Run CLAUDE gates.
