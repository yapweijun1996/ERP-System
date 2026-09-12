# ERP Project Progress

Reviewed: **2026-09-11, Asia/Singapore**. Snapshot of the current root worktree,
not an automated live monitor. Source baseline: `a4b7982bcf10ac71d709740af80dc2e79991e1c5`
on `main`, with existing uncommitted work. This SHA alone does not identify all local changes.
Task registry SHA-256: `3a4220943d0ec5fe29364ef989fab49af1a8e683691677ba98f683445a5d9bf6`.

[GOAL](GOAL.md) owns acceptance; [task registry](tasks/tasks.jsonl) owns status and
dependencies; [GOAL_PROMPT](GOAL_PROMPT.md) owns continuation. Recompute with
[the read-only count command](GOAL.md#reproduce-the-count) before using this snapshot.
Historical evidence below remains separately attributed. The later 2026-09-11
continuation added targeted upload tests, an authorized Demo gateway run and a
one-file Pages release candidate; see the dated records below. The latest
public-ingress evidence records a 2026-09-11 read-only verifier pass with health
200, 126 verified asset hashes and anonymous protected-API 401 responses;
alerting, incident ownership and an exercised rollback remain open under
TASK-199.

**TASK-199 release-verifier response cleanup — 2026-09-11:** the release verifier
now cancels response bodies on final-URL, invalid-length and advertised-size
failures, cancels a reader when streamed reading fails and always releases reader
locks on stream errors. Focused verifier and availability tests pass 2 files / 25
tests; production alert delivery, incident ownership and rollback remain open.

**TASK-205 bounded response contract — 2026-09-11:** shared document processing
drivers now reject malformed/non-object JSON with one bounded application error and
cancel an unconsumed response body before rejecting invalid or unsafe
`Content-Length`; the same 8 MiB cleanup path covers non-success responses and
text-only runtime fallbacks. Stream reader failures now cancel before rethrowing the
original transport error and release the reader lock. The processing/driver/readiness
regression passes 3 files / 44 tests; production provider, rotation/revocation and
dead-letter alert/recovery evidence remain open.

**TASK-205 provider endpoint ownership audit — 2026-09-11:** Agent provider
configuration keeps the fixed OpenAI egress and allowlisted HTTPS-compatible endpoints
separate from document Vision policy metadata; the worker sends Vision only to the
deployment-owned `DOCUMENT_VISION_GATEWAY_URL`. The focused provider/readiness/driver
regression passes 3 files / 39 tests, and no local egress defect was established. The
approved production gateway/account/model/region/retention, live rotation/revocation
and dead-letter alert/recovery evidence remain open.

**TASK-205 BYOK credential boundary — 2026-09-11:** persisted Vision connector
credential state is revalidated with `isEncryptedToken` at enable, health, readiness,
policy selection and both worker extraction guards, including explicitly
credential-free connectors. A malformed non-empty envelope therefore cannot enable,
report healthy/ready or trigger Vision/local OCR; a null envelope remains valid for
the credential-free OpenAI-compatible path. The focused policy/processing/driver/
API/governance regression passes 5 files / 52 tests; production provider, account,
region, retention, rotation/revocation and dead-letter alert/recovery evidence remain
open.

**TASK-193 temporary credential envelope boundary — 2026-09-11:** employee account
create/reset now reject malformed encrypted credential envelopes before writes;
active-secret and reveal paths fail closed on malformed or cryptographically
tampered persisted values with bounded `temporary_credential_unavailable` output.
The HR module/API regression passes 2 files / 16 tests. Production SMTP, Platform
Superadmin recovery and PostgreSQL/RLS evidence remain open; task and GOAL counts
are unchanged.

**TASK-199 immutable rollback references — 2026-09-11:** the application-only
rollback handoff now requires lowercase `@sha256:<64-hex>` image references before
any Docker operation, preventing mutable tags from passing the rollback plan. The
rollback regression passes 1 file / 5 tests; alert delivery, incident ownership,
rollback drill and owner acceptance remain open.

**TASK-199 canonical alert scheduler handoff — 2026-09-11:**
`check:availability-alert` now reuses the bounded verifier and default-deny alert
adapter. It stays dry-run without an explicit HTTPS endpoint and host allowlist;
allowlisted delivery, missing configuration, sink rejection, timeout and CLI
redaction pass 1 file / 7 tests. Production sink, responder, delivered alert and
rollback drill remain open. A read-only public dry-run against
`https://gmb01.xyz/erp` returned the expected revision, 126 assets and seven healthy
checks with `configured=false, delivered=false`.

## Current situation

**Phase 2 remains open.** The governed Receipt-to-Pack foundation, MCP/WebMCP,
identity, confirmation and semantic reads are accepted at their documented scope.
The assistant has local fixture and hosted Demo evidence. The real server-provider
pilot with readable receipt evidence and human business acceptance is still missing.

**Latest authorized exit: TASK-234 Demo receipt review completed by Codex.** The
user selected the existing Demo endpoint and delegated OCR/receipt/PDF review,
with no manual user action needed. The real Demo gateway produced an exact preview;
one Pack and its authorized PDF hash survived reload. This run also exposed and
locally repaired the missing-upload-controls defect. A clean candidate based on
the deployed Demo revision now contains only that repair; it has not been pushed
or deployed. See [dated evidence](docs/ai-native/evidence/TASK-234-2026-09-11-codex-demo.md).

**Next measurable action:** obtain release-owner authorization for external push,
then publish candidate `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4` and verify hosted
uploads without a source override. The read-only public recheck at revision
`3e93249e34ff607fc693c1ad7b72e020df25825c` still renders the pre-repair screen
for Finance Preparer, so the hosted gap is confirmed rather than assumed.
Candidate review and current local CI pass; keep the separate server-provider
G07.3 scope open and do not request a new provider key or human review merely to
repeat the approved Demo scope.

**Latest local TASK-202 increment — 2026-09-11:** the authenticated Company Receipt
Pack Print API now has direct contract coverage for inline PDF delivery, private
no-store caching, artifact/source hashes, `%PDF` content and `pdf_print` audit
attribution. This strengthens local download/Print semantics without promoting
production readability or the Finance/QA human Print verdict.

**Supporting work:** TASK-199 operational acceptance; reconcile the existing TASK-236
candidate before any new durable-workflow implementation. No Todo task currently has
all registry dependencies Done. In-progress tasks can still have actionable technical
work; resolve their precise remaining gates instead of rerunning the same green suite.

**TASK-204 source recheck — 2026-09-11:** current IRAS and Royal Malaysian
Customs/MOF material is now recorded against the seeded effective-dated rules. The
Malaysia rental/leasing rate and exemption update conflicts with an older MySST FAQ;
the qualified tax owner must select the authoritative source/version before any
production rule change. This is review preparation, not tax approval.

**TASK-204 effective-date ambiguity guard — 2026-09-11:** `getEffectiveTaxRate()` now
returns no rule when overlapping rows match one Company, tax code and document date,
so downstream posting fails closed instead of silently selecting a version. The
inclusive/exclusive boundary cases remain covered; focused repository/tax tests pass
2 files / 16 tests. This is source/PGlite/Demo parity evidence only; qualified-owner
approval and production configuration remain open.

**TASK-205 source egress/error guard — 2026-09-11:** the shared document scanner/local-OCR/
Vision HTTP drivers reject gateway URLs containing embedded credentials, query parameters
or fragments before any document request and pass `redirect: 'error'` to fail closed on
HTTP redirects; successful driver responses are streamed and capped at 8 MiB before
JSON parsing, while failed responses cancel unconsumed bodies before returning fixed
status errors; the HTTP Vision driver preserves only a provider-supplied valid
64-character hexadecimal visual fingerprint for worker validation/persistence and
never derives one from OCR text; worker retry/dead-letter persistence maps arbitrary
exceptions to bounded application-owned messages. The authenticated `POST /api/documents/:documentId/actions/
retry-processing` action now exposes the same-chain dead-letter requeue only to
`documents.governance.manage`, validates the tenant-bound version and records an
idempotent audit event. Focused driver/processing/API
tests pass; this is source-level egress evidence only and does not change the production
provider/account/region/retention/health/rotation/recovery gate below.

**TASK-205 readiness recheck — 2026-09-11:** source tests for Vision failure,
revocation, bounded retry, dead letter and same-chain manual recovery pass. The
connector health check now keeps configured `document-vision` at `warning` with
`provider_health_unverified` and does not advance `lastSuccessAt` from a
credential alone. Readiness also requires a paired `lastCheckedAt` health-check
timestamp; a historical success without that check remains unverified. The authorized Demo endpoint returned its bounded receipt-search protocol, while
Codex OCR review remains synthetic; the endpoint does not accept receipt bytes
and cannot prove a production Vision gateway, account, region, retention or live
alert/recovery operation. TASK-205 remains `in_progress`; next exit is an
approved provider scope plus real extraction and controlled recovery evidence.
Required persisted credential envelopes are also revalidated at connector enable,
health-check and readiness boundaries; malformed non-empty values fail closed and
cannot report healthy or ready.

## Progress scoreboard

| Metric | Count | Denominator / meaning |
| --- | --- | --- |
| Registry tasks | 240 | All historical and current registered tasks |
| Done | 226 | Historical closure; not product readiness |
| In progress | 6 | Started, acceptance incomplete |
| Todo | 5 | Not accepted; dependencies still open |
| Blocked | 3 | Registry explicitly records an impediment |
| Open tasks | 14 | 8 inherited gates + 6 AI workstreams |
| AI workstreams accepted | 6 | 12 workstreams; 50.0% |
| Goal criteria accepted | 27 | 48 criteria; 56.3% |
| Execution checkpoints | 36 | 60 S-checkpoints; 60.0%, not acceptance |

No combined “ERP percent complete” is claimed. The registry's 226/240 (94.2%)
includes historical and documentation work. TASK-227/240 are Done documentation
milestones, excluded from the 12 AI workstreams. There is no evidence-backed ETA;
named owners, capacity and external gate dates have not been agreed.

### Acceptance correction

On 2026-09-11, G07.3 was reopened: the prior checked box cited governed local
execution, while its complete real server/provider receipt journey remains unverified.
This changes criteria from 28/48 to 27/48 without changing any acceptance text,
registry status or product code. It is an evidence-accounting correction.

TASK-234 S5 stays checked because its packet allows fixture evidence plus an explicit
remaining real-provider gate. Thus 5/5 execution steps can coexist with 3/4 accepted
criteria and an in-progress task. Completing a procedure is not the same as satisfying
its business outcome. See [TASK-234 packet](docs/ai-native/TASK-234.md) and
[dated evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md).

## Workstream board

Status below is copied from the current root registry. Criteria and steps are
independent projections of GOAL and the corresponding packet.

| Goal | Task | Registry status | Criteria | Steps | Remaining outcome |
| --- | --- | --- | --- | --- | --- |
| G01 | TASK-228 | done | 4/4 | 5/5 | Accepted governed action contract |
| G02 | TASK-229 | done | 4/4 | 5/5 | Accepted WebMCP pilot scope |
| G03 | TASK-230 | done | 4/4 | 5/5 | Accepted authenticated MCP scope |
| G04 | TASK-231 | todo | 0/4 | 0/5 | Approved outbound connector |
| G05 | TASK-232 | done | 4/4 | 5/5 | Accepted agent identity/delegation scope |
| G06 | TASK-233 | done | 4/4 | 5/5 | Accepted exact approval/execution scope |
| G07 | TASK-234 | in_progress | 3/4 | 5/5 | Real server/provider receipt pilot |
| G08 | TASK-235 | done | 4/4 | 5/5 | Accepted permission-aware semantics |
| G09 | TASK-236 | todo | 0/4 | 0/5 | Reconcile candidate, integrate and accept |
| G10 | TASK-237 | todo | 0/4 | 0/5 | Versioned repeated safety/quality evaluation |
| G11 | TASK-238 | in_progress | 0/4 | 1/5 | Agree scope, close business journeys/UAT |
| G12 | TASK-239 | todo | 0/4 | 0/5 | Exact release and operations acceptance |

Phase 0 definition and Phase 1 foundation have their recorded exits. Phase 2 is
open at G07. Phase 3 is partial (G08 accepted; other gates open). Phase 4 is open.
The registry dependency graph governs sequencing; phase progress is not elapsed time.

## Evidence and release boundaries

| Surface | Latest inspected evidence | What it proves / what remains |
| --- | --- | --- |
| Root source | `a4b7982` plus dirty worktree | Current working implementation; not an immutable tested release |
| Local regression | Recorded 2026-09-11: 209 files, 943 tests passed; 3 files/tests skipped (212 files / 946 tests total) | Current dirty-workspace regression; PostgreSQL target and live provider remain separate |
| Local assistant runner | SG/MY private PGlite fixture runs | Confirmation, reopened Pack/artifact persistence; simulated provider and confirmation |
| Hosted Demo | Earlier E2E used `ae7a3cfabde0e03a704d943dc1d99cc3bb672e2a`; current public manifest is revision `3e93249e34ff607fc693c1ad7b72e020df25825c` | Public Demo gateway/UI/persisted Pack remains synthetic; current published My Receipts screen is pre-repair and hides upload controls |
| Upload repair candidate | Detached `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4` from `ae7a3cfabde0e03a704d943dc1d99cc3bb672e2a`; 134-file Demo manifest | Local fresh-browser controls verified; public revision `3e93249` still hides them; no push or deployment |
| Production application | `03487b13ce838407d97cd00697bd2b54b4a7c918` | Recorded API/Web coherence and SG/MY manual receipt/Pack path; source images remain synthetic 1×1 PNGs |
| Public ingress | Recorded 2026-09-11: health 200, 126 assets verified, protected anonymous APIs 401 | Public recovery verified; alerting, incident ownership and exercised rollback still open |
| Remote CI | Candidate run `34530777179`, head `3c508beb34c4865ae9baf44ddd2cd21ca0459da2`, green; root has no current run | Candidate repository gates are green; no current root CI or production release claim |
| Durable-workflow candidate | Branch `task-236-docs-final`, inspected HEAD `103e4ef` (source scope boundary `bc726cc`, implementation `fc64f34`, route/retry `7953efa`, process restart `702ccc6`, scope boundary `77829ce`) | Candidate route, retry-budget, child-process restart, scope-boundary and full PostgreSQL gates now pass; root dependency acceptance remains open |

Sources: [STATUS](docs/STATUS.md), [execution evidence history](docs/GOAL_EXECUTION_PLAN.md),
[TASK-234 evidence](docs/ai-native/evidence/TASK-234-2026-09-09.md),
[public recovery evidence](docs/ai-native/evidence/TASK-199-2026-09-11.md).
Do not reuse earlier “public 502” as the current blocker. Do not rerun an old
TASK-209 migration instruction without checking the actual target journal; the
recorded production journal already reaches migration 0111.

CI provisioning is defined in [.github/workflows/ci.yml](.github/workflows/ci.yml):
root dependency installation and sharded tests, followed by a validation job with
disposable PostgreSQL, web dependencies, static/schema checks, database tests and
Demo/browser gates. This describes configured coverage, not evidence that a particular
revision passed. `docs:check` scans README/docs, so these three root files also need
separate rendered-link validation.

### Existing durable-workflow candidate

The inspected worktree is `/private/tmp/erp-freeze-task234-20260911-b` on
`task-236-docs-final`. Its current HEAD is `103e4ef`, with source scope boundary
`bc726cc` and implementation commit
`fc64f34`, route/retry follow-up `7953efa`, process-boundary follow-up `702ccc6` and
scope-boundary follow-up `77829ce`,
`src/modules/agent/durableWorkflow.ts`, migrations 0112–0114 and
`docs/ai-native/evidence/TASK-236-2026-09-11.md`. These paths belong to that
candidate, not the current root. Locate it again with `git worktree list`; temporary
paths can disappear. The local `origin/main` ref also points to `fc64f34`; root
HEAD has not been pulled or merged because the worktree contains unrelated changes.

The candidate records durable runs/steps, leases, bounded retries, cancellation and
fresh permission checks, with local tests and disposable PostgreSQL/RLS proof.
Its registry marks TASK-236 done for repository scope after CI run `34530777179`,
while this root still has Todo. Read-only GitHub metadata confirms that run is green
for head `3c508be`. The candidate now has authenticated workflow-route coverage, an
explicit repeated retryable-failure exhaustion test, a disposable PostgreSQL
child-process kill/restart proof and foreign actor/Company-boundary coverage. Browser integration and production acceptance are
not established by its database tests. The route/retry follow-up reported 2 files /
29 tests; the current process-boundary suite reports 1 file / 2 tests and the
combined suite reports 3 files / 33 tests. The current full `test:postgres` gate
reports 4 files / 5 tests. Generated/schema/permission/RLS/i18n/pack checks also
passed.

The 2026-09-11 [source reconciliation](docs/ai-native/evidence/TASK-236-2026-09-11-reconciliation.md)
confirmed that the earlier implementation delta had 24 of 29 paths matching the
root base; five current documentation/registry paths required manual reconciliation.
Existing migration SQL and the 112-entry journal prefix match. The current candidate
pointer now includes the route, repeated retry-budget, child-process restart and
scope-boundary evidence. No root integration or production acceptance is implied
by the candidate.
Next preserve the candidate and resolve the dependency before isolated integration. TASK-234 is still a root dependency; record any approved dependency
change before treating TASK-236 as execution-ready. Preserve candidate evidence and
avoid rebuilding it. No merge, migration, deployment or task-status promotion is
performed by this progress update.

## Open-task ledger

Owners are accountable roles to assign, not claims that a named person has accepted
work. `In progress` does not imply an external gate is available. The next exit is
a measurable deliverable, not a promise to finish the entire task in one session.

| Task | Status | Accountable role | Current gap | Next observable exit |
| --- | --- | --- | --- | --- |
| TASK-017 | blocked | Product owner + device tester | Physical-phone layout/PWA/business proof missing | Record one real-device journey, device/browser and owner verdict; emulation stays separate |
| TASK-193 | blocked | Identity engineer + mail operator | Real SMTP unavailable; Platform Superadmin recovery unimplemented; target RLS/delivery proof open | Separate tenant recovery from platform implementation; complete one scoped flow with expiry/replay and delivery evidence |
| TASK-199 | in_progress | Operations owner | Public route fixed; source-controlled rollback handoff and default-deny availability/verification response cleanup now exist, including fixed-message redaction, HTTPS host allowlisting, redirect rejection, timeout and reader cleanup, but approved alert sink/incident route, named responder and exercised rollback evidence are missing | Connect the checker to the approved alert destination and responder, observe a test alert, then execute/document an approved rollback drill |
| TASK-201 | todo | Operations + database owner | Document telemetry now matches scan/extraction claimable statuses, records aggregate `queryDurationMs`, accepts a bounded transaction-local query timeout and has a source-controlled budget handoff validator; TASK-195/TASK-199 dependencies, representative budgets, off-machine DR and scale proof remain absent | After prerequisite closure, define workload/SLO/RPO/RTO and prove representative load plus isolated restore with measured outcomes |
| TASK-202 | in_progress | Finance owner + QA | Hosted Demo readable-source/PDF evidence is recorded; production Pack still uses synthetic tiny source and human Print verdict is missing | Process readable SG/MY receipts; owner verifies selected contents and rendered/downloaded PDF |
| TASK-204 | in_progress | Qualified SG/MY tax owner | Effective-date/regime safeguards now fail closed on overlapping windows; current official-source review exposes a rental/leasing rate/exemption conflict and statutory policy sign-off is missing | Select the authoritative source/version, approve versioned rate/exemption/transitional cases and verify effective-date boundaries; do not label MY SST compliant |
| TASK-205 | in_progress | OCR operator + security owner | Source failure/recovery fixtures, gateway URL egress guard, bounded error persistence, bounded JSON response shape, 8 MiB response boundary including text-only fallback with advertised-size and invalid-metadata body cleanup, provider visual-fingerprint validation/persistence and tenant-scoped audited dead-letter retry action pass; Demo protocol passes; production gateway/account/region/retention/health/rotation/recovery not accepted | Record approved provider/data policy and a real extraction plus controlled recovery outcome |
| TASK-209 | blocked | Release owner | TASK-199 open; current release CI/role/RLS/backup evidence needs reconciliation | Replace stale migration assumptions with exact revision/journal/role evidence and close remaining release checks |
| TASK-231 | todo | Integration engineer + service owner | TASK-234 open; generic approved outbound MCP connector absent | Select one useful read-only connector and approved consent/egress scope after prerequisites |
| TASK-234 | in_progress | AI engineer + release owner | Codex-reviewed Demo run and detached upload-repair candidate CI pass; public revision `3e93249` still serves the pre-repair My Receipts screen; separate server-provider scope remains open | Obtain release authorization, publish the exact candidate, then verify hosted capture without source override |
| TASK-236 | todo | Workflow engineer + reviewer | Root dependency open; candidate route/restart/retry evidence passes but is not integrated or accepted | Resolve dependency, freeze the integration base, rerun root-scoped gates and accept without copying candidate task status |
| TASK-237 | todo | Evaluation owner + QA | Depends on unfinished connector/runtime/workflow; release evaluation absent | Version ≥30 valid cases; each of 3 runs ≥95% success and 100% deterministic safety, zero false success |
| TASK-238 | in_progress | Product owner + finance owner | S1 inventory only; selected financial journeys and market acceptance undecided | Approve included/excluded journeys and financial allocation rules, then implement/verify the first agreed gap |
| TASK-239 | todo | Release + product owner | Depends on remaining AI and inherited gates | Assemble exact candidate CI/UAT/operations matrix; release only with applicable gates satisfied |

Detailed evidence and scope: [inherited tasks](docs/ai-native/INHERITED_TASKS.md),
[TASK-202 Demo Pack/export](docs/ai-native/evidence/TASK-202-2026-09-11-codex-demo.md),
[AI packets](docs/AI_NATIVE_EXECUTION.md), [TASK-238 inventory](docs/ai-native/evidence/TASK-238-2026-09-09.md),
[domain contracts](docs/PROJECT_LOGIC.md). Registry dependencies remain authoritative.

## Prioritized improvement ideas

These are proposals inside existing tasks, not newly completed work. S/M/L are
relative engineering effort after prerequisites, not calendar estimates. Risk means
implementation/operational exposure. Business owner choices remain pending.

| Rank | Idea / existing task | Expected value | Effort / risk | First deliverable and acceptance |
| --- | --- | --- | --- | --- |
| 1 | Close the real receipt pilot / TASK-234 | Converts fixture confidence into a usable business result | M / medium | Approved readiness record; actual server-provider run binds exact confirmation to one persisted Pack, and independently verifies authorized artifact/hash plus sanitized usage |
| 2 | Accept readable Pack output / TASK-202 | Removes synthetic-artifact false confidence; supports #1 | S–M / low | Readable SG/MY source examples; selected source identities match the PDF, and finance owner records visual/print acceptance |
| 3 | Complete operational ownership / TASK-199 | Unblocks release and operations dependents | M / medium | Named responder and reversible drill plan; injected incident produces actionable alert, and approved rollback restores the verified release within recorded time |
| 4 | Recover candidate delivery evidence / TASK-236 | Avoids duplicate development and lost worktree progress | S review, M integration / medium | Commit/schema/prerequisite reconciliation; preserve restart/RLS proofs, and pass integration/CI plus applicable UI checks before acceptance |
| 5 | Decide one financial allocation slice / TASK-238 | Closes a concrete money workflow gap | M–L / high | Owner-approved ordinary sales-invoice allocation contract; partial allocation conserves balances, and overpayment/cross-currency cases reject or follow explicitly approved rules |
| 6 | Separate recovery scopes / TASK-193 | Makes hidden implementation work visible | M / high | Tenant and Platform recovery checklist; expiry/replay/isolation pass, and real delivery plus approved Platform recovery is evidenced separately |
| 7 | Approve SG/MY tax decision table / TASK-204 | Prevents unsupported tax-compliance claims | M / high | Qualified-owner rate/regime/exemption cases; interval boundaries are tested, and unsupported MY treatment fails closed |
| 8 | Prove OCR custody and recovery / TASK-205 | Converts enabled code into an operable document workflow | M / medium | Approved region/retention/provider and failure drill; real source extracts correctly, and rotation/dead-letter recovery preserves traceability without secrets |
| 9 | Ship one bounded external read / TASK-231 | Tests connector value without broad write exposure | M / medium | Approved document/calendar use case; least-privilege consent and SSRF/egress denial pass, and revocation removes access |
| 10 | Establish release evaluation and budgets / TASK-237 | Makes quality, latency and cost measurable | M / medium | Versioned case set and manual baseline; all 3 runs meet GOAL thresholds, and owner-approved latency/cost budgets report measured pass/fail |
| 11 | Exercise recovery and scale with explicit targets / TASK-201 | Makes operability claims testable | L / high | Agreed workload/capacity/RPO/RTO; off-machine restore verifies data, and representative load reports p95/error/resource measurements |
| 12 | Use one release acceptance matrix / TASK-017/209/239 | Prevents mixing local, Demo and production evidence | M / medium | Candidate SHA × environment × journey × owner matrix; physical-device evidence is distinct, and each required gate links to matching source/release proof |

Quick wins are readiness/owner records, readable-source review and candidate inventory;
none substitutes for its task's exit. Larger investments are financial allocation,
durable integration, evaluation and scale. For TASK-238, current
[bank receipt code](src/modules/finance/bankReceipt.ts) handles Project Progress Claim
receipts; this is not ordinary sales-invoice allocation or Employee Expense Claims.
The S1 inventory's local 26-file/140-test record does not establish full market UAT.
Start with an owner-approved narrow allocation rule; do not infer financial policy.

## Operating and update cadence

At each work session, inspect current source/registry/worktrees, run the count check,
and choose one primary outcome. Keep one primary implementation writer; independent
review or investigation must have a bounded purpose. Urgent service recovery may
preempt the pilot with an explicit reason. No background schedule is created by this file.

At each verified checkpoint or genuine blocker change:

1. Record task/criterion, source revision plus dirty-state limits, environment, actor,
   expected/actual postconditions and a dated evidence link. Redact secrets.
2. Update packet steps only when their exits pass. Change registry status and goal
   checkmarks only to the extent supported; all four criteria, five steps and common
   DoD are required for Done. Record any reopening and preserve acceptance history.
3. Recompute this board, open ledger and registry fingerprint; update relevant STATUS,
   test/domain docs and KB. Keep detailed logs in dated evidence, not this dashboard.
4. Report the new outcome, remaining gap and next measurable action. If no gate changed,
   say “no acceptance delta” and identify why; do not count repeated tests or prose.

Evidence becomes suspect when affected code, configuration, dependency, schema,
provider/model, permissions or deployment changes. Revalidate the affected boundary;
old passing tests do not certify a new revision. A hash-consistent board still needs
human/source review of evidence quality. Do not silently replace an unavailable
resource with a fixture and claim the original gate passed.

## Session changes

| Date | Change | Acceptance impact |
| --- | --- | --- |
| 2026-09-11, prior operational work | Public Tunnel recovery verified with health, protected APIs and 126 asset hashes | Public-access gate resolved; TASK-199 remains in progress |
| 2026-09-11, this documentation review | Three root documents separated by responsibility; complete open ledger, candidate inventory and prioritized ideas added | No new capability or task closure |
| 2026-09-11, this documentation review | G07.3 reopened to match missing real server/provider acceptance | Criteria 28 → 27; tasks and S-checkpoints unchanged |
| 2026-09-11, Codex Demo evidence | Hosted Demo source readability, exact Pack totals, PDF hash/text read-back and PDF/Print control invocation recorded for TASK-202 | Demo acceptance slice strengthened; production readable-source and human Print verdict remain open |
| 2026-09-11, TASK-199/TASK-201 source-truth reconciliation | Marked pre-recovery 502 as historical and aligned Deployment/Scalability telemetry text with claim-aware non-blocking worker source | Documentation accuracy improved; alert sink/owner, rollback, budget and recovery acceptance remain open; [TASK-201 record](docs/ai-native/evidence/TASK-201-2026-09-11.md) |
| 2026-09-11, TASK-199 current verifier recheck | Re-ran the bounded public release verifier against `https://gmb01.xyz/erp` and matched health, setup, manifest, revision and all 126 asset hashes | Fresh public identity evidence; no alert, owner or rollback acceptance was claimed |
| 2026-09-11, TASK-201 local query-plan baseline | Ran source-equivalent eight queue aggregates with `EXPLAIN (ANALYZE, BUFFERS)` as `erp_worker` against the local production Compose database | 0–4 rows per queue and 0.032–0.052 ms scans provide a tiny-volume baseline only; no representative scale or budget acceptance claimed |
| 2026-09-11, TASK-201 claim-alignment repair | Aligned document scan/extraction telemetry `ready` predicates with worker claimable statuses and added an expired-lease regression; focused telemetry, lint, typecheck, web typecheck, Demo build and PGlite Demo gates pass | False-ready SLI risk is removed at source; representative query budget, alert ownership, backup/restore, capacity and failover evidence remain open; [dated record](docs/ai-native/evidence/TASK-201-2026-09-11.md) |
| 2026-09-11, TASK-201 telemetry duration measurement | Added `queryDurationMs` to aggregate-only worker snapshots, preserving single-flight/non-blocking emission and existing queue predicates; focused telemetry 7/7, lint, both typechecks, PGlite Demo and Demo build pass | Duration is now observable for a future approved budget run; no SLO, alert, scale, restore or task-status acceptance is claimed; [dated record](docs/ai-native/evidence/TASK-201-2026-09-11.md#aggregate-duration-measurement--2026-09-11) |
| 2026-09-11, TASK-201 budget handoff checker | Added the read-only `check:worker-telemetry` validator with explicit `--max-query-ms` classification, aggregate-only schema/privacy checks and sanitized output; focused 4/4 tests and a Demo-shaped eight-queue record pass | Owner-approved threshold, representative PostgreSQL volume, alert delivery, restore/failover and reviewed operational ownership remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-201-2026-09-11.md#source-controlled-budget-handoff-checker--2026-09-11) |
| 2026-09-11, TASK-201 transaction-local timeout handoff | Added optional `WORKER_TELEMETRY_QUERY_TIMEOUT_MS`, clamped to 1–120,000 ms and applied with `SET LOCAL` inside each telemetry transaction; focused telemetry tests pass 9/9 and Demo/PGlite accepts the same scoped setting | This is a bounded source handoff only; representative PostgreSQL cancellation/budget, alert ownership, restore/failover and capacity evidence remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-201-2026-09-11.md#optional-transaction-local-query-timeout--2026-09-11t035857z) |
| 2026-09-11, TASK-201 isolated PostgreSQL timeout proof | Disposable PostgreSQL 16 cancelled `pg_sleep(200ms)` under a `25ms` transaction-local setting with SQLSTATE `57014` at 28ms; the setting reset to `0` after commit, telemetry returned 8 queues, and parity/concurrency plus 3 PostgreSQL integration files passed | Local cancellation semantics are now evidenced; representative 100–800 GB plans/volume, owner-approved p95/p99 budget, alert/restore/failover and production acceptance remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-201-2026-09-11.md#isolated-postgresql-timeout-cancellation--2026-09-11t041409z) |
| 2026-09-11, TASK-201 synthetic queue-volume plan baseline | Disposable PostgreSQL 16 fixture used 25,000 synthetic rows per monitored queue (200,000 total); the real snapshot returned 8 queues in 49ms under 250ms, and source-equivalent plans were captured with `calendar-leave` at 169.348ms | Local 122MiB plan/volume baseline is recorded; required 100–800 GB workload, owner-approved p95/p99 budget, alert/restore/failover, capacity and production acceptance remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-201-2026-09-11.md#synthetic-queue-volume-plan-baseline--2026-09-11t042327z) |
| 2026-09-11, TASK-201 calendar connection join experiment | Compared three PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` runs for the 25,000-row calendar aggregate: correlated `EXISTS` 14.176–15.116ms versus tenant-scoped derived enabled-connection `LEFT JOIN` 8.856–9.252ms; current source snapshot returned 25,000 ready leave events in 32ms and the 9-test telemetry suite passed | Calendar ready lookup is cheaper while disabled connections remain pending; representative 100–800 GB workload, owner-approved p95/p99 budget, alert/restore/failover, capacity and production acceptance remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-201-2026-09-11.md#calendar-connection-join-experiment-and-source-repair--2026-09-11t044232z) |
| 2026-09-11, TASK-199 rollback handoff | Added confirmation-gated `deploy/rollback-release.sh` with explicit application image references, no-Docker plan, temporary mode-0600 Compose override and private `/health` check; focused shell/plan/execute guards pass 1 file / 4 tests and the isolated fake-Docker path proves service scoping/cleanup | Production rollback, alert destination, incident owner and exercised recovery remain open; no registry status or acceptance count change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#source-controlled-rollback-handoff--2026-09-11) |
| 2026-09-11, TASK-199 public verifier recheck | Resolved a stale KB Tunnel note by directly checking `/erp/health` (HTTP 200) and running the complete verifier for revision `03487b13ce838407d97cd00697bd2b54b4a7c918`; all 126 asset hashes and seven checks pass | This is read-only release identity evidence; alert delivery, incident ownership and exercised rollback remain open; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#current-public-verifier-recheck--2026-09-11t032750z) |
| 2026-09-11, TASK-199 availability event handoff | Added `check:availability` around the release verifier with bounded timeout and sanitized healthy/degraded JSON; focused 3/3 fixture tests pass, and the public wrapper recheck reports revision `03487b13ce838407d97cd00697bd2b54b4a7c918`, 126 assets and seven checks healthy | The source event contract is ready for scheduler integration; approved alert sink, incident owner, delivered alert and exercised rollback remain open; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#source-controlled-availability-event-handoff--2026-09-11) |
| 2026-09-11, TASK-199 availability event sanitization | Unexpected verifier exceptions now map to a fixed message while verifier codes and known bounded messages remain stable; focused availability tests pass 5/5 including internal URL/detail and invalid-option redaction fixtures | The source event contract is safer for scheduler integration; approved alert sink, incident owner, delivered alert and exercised rollback remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#availability-event-unexpected-error-sanitization--2026-09-11t050017z) |
| 2026-09-11, TASK-199 default-deny alert delivery boundary | Added fixed-message degraded/recovered events plus an HTTPS host-allowlisted delivery adapter with credential/query/fragment and redirect rejection, bounded timeout and response-body cleanup; focused fixture passes 13/13 | Source alert delivery is now reviewable without sending an external notification; approved sink, incident owner, delivered alert and exercised rollback remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#default-deny-alert-delivery-boundary--2026-09-11) |
| 2026-09-11, TASK-199 deterministic alert dedupe | Availability events now carry a secret-free SHA-256 `dedupeKey` stable across scheduler retries and deliver it as the sink `idempotency-key`; focused availability regression passes 1 file / 14 tests | Source alert retries are now deduplicable; approved sink, incident owner, delivered production alert and exercised rollback remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#deterministic-alert-dedupe-key--2026-09-11t092708z) |
| 2026-09-11, TASK-199 degraded-code dedupe regression | Added a focused retry/separation assertion for controlled degraded codes: same `revision_mismatch` identity remains stable while `health_mismatch` produces a new key; availability regression passes 1 file / 15 tests | The source contract now covers both recovered revision identity and degraded-code identity; approved sink, incident owner, delivered production alert and exercised rollback remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#degraded-code-dedupe-regression--2026-09-11t093423z) |
| 2026-09-11, TASK-199 current availability input | `npm run check:availability` against `https://gmb01.xyz/erp` exited 0 with healthy revision `03487b13ce838407d97cd00697bd2b54b4a7c918`, 126 files and all seven verifier checks true | Fresh read-only event input confirms the public release identity; no alert sink, responder or rollback drill was exercised, so TASK-199 remains in progress; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#current-availability-event-input--2026-09-11t100924z) |
| 2026-09-11, TASK-199 release verifier response cleanup | Release verifier now cancels early-failing response bodies and releases reader locks on stream errors; verifier/availability regression passes 2 files / 24 tests plus lint, typechecks, Demo and Demo build | Source resource cleanup is strengthened; approved alert sink, incident owner, delivered alert and exercised rollback remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#release-verifier-response-cleanup--2026-09-11t110150z) |
| 2026-09-11, TASK-199 streamed response reader cleanup | Release verifier now cancels a streamed reader when reading fails before returning the fixed `evidence_read_error`, then releases its lock; verifier/availability regression passes 2 files / 25 tests | Source probe cleanup covers failed reads as well as early URL/size rejection; approved alert sink, incident owner, delivered alert and exercised rollback remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#streamed-response-reader-cleanup--2026-09-11t120654z) |
| 2026-09-11, TASK-199 immutable rollback references | `deploy/rollback-release.sh` now requires lowercase `@sha256:<64-hex>` image references before Docker; mutable tags are rejected by the no-Docker plan, and rollback regression passes 1 file / 5 tests | Rollback provenance is source-enforced; approved alert sink, incident owner, delivered alert and exercised production rollback remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#immutable-rollback-image-references--2026-09-11t133226z) |
| 2026-09-11, TASK-199 canonical alert scheduler handoff | Added `check:availability-alert`; it reuses the verifier and default-deny delivery adapter, stays dry-run without endpoint/allowlist, passes 1 file / 7 tests and returned a healthy 126-asset public dry-run | Source scheduler handoff is reviewable; approved sink, incident owner, delivered production alert and exercised rollback remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-199-2026-09-11.md#canonical-availability-alert-scheduler-handoff--2026-09-11t134731z) |
| 2026-09-11, TASK-205 gateway URL egress guard | Shared scanner/local-OCR/BYOK-Vision driver construction rejects embedded credentials, query parameters and fragments; focused processing-driver regression passes 2 files / 22 tests and common Demo/PostgreSQL/docs gates pass | Source egress safety is strengthened; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#gateway-url-egress-guard--2026-09-11t061126z) |
| 2026-09-11, TASK-205 HTTP redirect hardening | Shared scanner/local-OCR/BYOK-Vision HTTP drivers now pass `redirect: 'error'` to every document request; focused processing-driver regression passes 2 files / 26 tests | Source egress is fail-closed for redirect handling; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#http-redirect-fail-closed-guard--2026-09-11t065046z) |
| 2026-09-11, TASK-205 bounded response body | Shared scanner/local-OCR/BYOK-Vision responses are streamed with an 8 MiB cap before JSON parsing, including missing `Content-Length`; focused processing-driver regression passes 2 files / 28 tests | Source memory-safety boundary is strengthened; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#response-body-size-boundary--2026-09-11t070308z) |
| 2026-09-11, TASK-205 advertised response-size cleanup | Shared scanner/local-OCR/BYOK-Vision drivers now cancel an unconsumed body before rejecting an advertised `Content-Length` above 8 MiB; processing/driver/readiness regression passes 3 files / 41 tests | Source bounded-response ownership is strengthened; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#advertised-response-size-cleanup--2026-09-11t111123z) |
| 2026-09-11, TASK-205 invalid response-size declaration cleanup | Shared scanner/local-OCR/BYOK-Vision drivers reject malformed, non-decimal or unsafe `Content-Length` before parsing, cancel the unconsumed body and return a bounded application error; processing/driver/readiness regression passes 3 files / 42 tests | Source transport metadata now fails closed with cleanup; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#invalid-response-size-declaration-cleanup--2026-09-11t111958z) |
| 2026-09-11, TASK-205 bounded JSON response shape | Shared scanner/local-OCR/BYOK-Vision drivers now reject syntax-invalid JSON and non-object JSON with one bounded application error before field access; processing/driver/readiness regression passes 3 files / 42 tests | Source provider-response contract is stable for malformed shapes while response-size errors remain distinct; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#bounded-json-response-shape--2026-09-11t113329z) |
| 2026-09-11, TASK-205 body-less response bound | The shared HTTP driver now byte-checks text-only successful responses against the same 8 MiB limit before JSON parsing; processing/driver/readiness regression passes 3 files / 43 tests | Source bounded-response ownership covers both streamed and body-less runtimes; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#body-less-response-bound--2026-09-11t114655z) |
| 2026-09-11, TASK-205 streamed response reader cleanup | Streamed scanner/local-OCR/BYOK-Vision response reads now cancel the reader on transport failure before rethrowing the original error and always release its lock; processing/driver/readiness regression passes 3 files / 44 tests | Source response cleanup covers both bounded overflow and failed reads; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#streamed-response-reader-cleanup--2026-09-11t115624z) |
| 2026-09-11, TASK-205 failed response-body cleanup | Failed scanner/local-OCR/BYOK-Vision HTTP responses now cancel unconsumed bodies before the fixed status error; focused processing-driver regression passes 2 files / 29 tests | Source resource cleanup is strengthened; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#failed-response-body-cleanup--2026-09-11t072243z) |
| 2026-09-11, TASK-205 authenticated dead-letter retry | `POST /api/documents/:documentId/actions/retry-processing` now validates the tenant-bound document version, requires `documents.governance.manage`, requeues the existing extraction chain and records an idempotent audit event; API/PGlite recovery regression passes 2 files / 14 tests and full Vitest passes 208 files / 932 tests with 3 skipped files/tests | Local/API manual-recovery boundary is strengthened; delivered production dead-letter alerting, responder ownership, approved provider scope and real recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#authenticated-dead-letter-retry-action--2026-09-11t075758z) |
| 2026-09-11, TASK-205 bounded worker error persistence | Worker scan/extraction retry and dead-letter records now persist fixed application-owned messages; synthetic credential/URL provider errors are absent from document jobs and processing outbox signals; focused processing/driver regression passes 2 files / 23 tests | Source privacy boundary is strengthened; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#bounded-worker-error-persistence--2026-09-11t062707z) |
| 2026-09-11, TASK-205 source/configured provider readiness | Added tenant-scoped `GET /api/integration/document-processing-readiness` and a secret-free domain projection that separates local OCR/BYOK source capability, Company policy/connector configuration and live health evidence; focused readiness/API regression passes 2 files / 5 tests, with credential-only Vision remaining unverified | Source readiness is now explicit without exposing encrypted credentials or crossing Company scope; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#source-configured-provider-readiness-projection--2026-09-11) |
| 2026-09-11, TASK-205 cross-Master readiness isolation | Readiness regression now proves a configured `M1/C-SG` Vision connector is invisible to foreign Master `M2/C-SG`, which returns the local-OCR default with no endpoint or credential; readiness/API tests pass 2 files / 5 tests | Source tenant boundary is directly covered across both Company and Master scope; approved provider gateway/account/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#cross-master-readiness-isolation-regression--2026-09-11t093744z) |
| 2026-09-11, TASK-205 HTTP readiness scope tamper | Authenticated readiness API regression proves client-supplied `masterFn`/`companyFn` query parameters are ignored and the session-scoped response contains no foreign identifiers; readiness/API tests pass 2 files / 5 tests | Source tenant boundary now covers HTTP query tampering as well as cross-Master projection; approved provider gateway/account/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#http-readiness-scope-tamper-regression--2026-09-11t094224z) |
| 2026-09-11, TASK-205 readiness invalidation after connector pause | Readiness regression proves a previously healthy connector loses `externalProviderReady` after pause even when historical `lastSuccessAt` remains; readiness 1 file / 4 tests, connector 1 file / 6 tests and API 1 file / 2 tests pass | Source health evidence is now subordinate to current enabled/status state; approved provider gateway/account/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#readiness-invalidation-after-connector-pause--2026-09-11t094912z) |
| 2026-09-11, TASK-205 paired readiness health evidence | Readiness now requires paired `lastCheckedAt` and `lastSuccessAt` timestamps; a historical success without its health-check timestamp remains `configured-provider-unverified`; focused processing/driver/readiness/connector regression passes 4 files / 51 tests, while the authorized Demo probe returned session 201 and completed response 200 | Source evidence closes the missing-timestamp misclassification; Demo/Codex OCR remains synthetic and needs no user action, while production gateway/account/region/retention, live rotation/revocation, delivered alert and controlled recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#paired-health-check-evidence--2026-09-11t121730z) |
| 2026-09-11, TASK-205 persisted credential-envelope revalidation | Connector enable, health-check and readiness now revalidate required stored credentials with `isEncryptedToken`; a malformed non-empty envelope fails closed, remains unhealthy/unready and is never serialized; processing/driver/readiness/connector regression passes 4 files / 53 tests | Source credential boundary is strengthened without exposing secrets or changing tenant/approval/fallback behavior; production provider/account/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#persisted-credential-envelope-revalidation--2026-09-11t123127z) |
| 2026-09-11, TASK-205 BYOK credential revalidation at policy and worker boundaries | BYOK Vision policy selection and both worker extraction guards now require `isEncryptedToken`; malformed persisted credentials fail closed before Vision egress and do not trigger local OCR; focused policy/processing/driver/API/governance regression passes 5 files / 52 tests | Source fail-closed coverage is strengthened without changing tenant, approval or manual-retry policy; approved provider gateway/account/model/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#byok-credential-revalidation-at-policy-and-worker-boundaries--2026-09-11t130554z) |
| 2026-09-11, TASK-193 temporary credential envelope revalidation | Employee account create/reset reject malformed envelopes before writes; active reveal validates persisted structure and maps malformed/tampered credentials to bounded `temporary_credential_unavailable` output without crypto detail; HR module/API regression passes 2 files / 16 tests | Local credential-custody boundary is strengthened; Platform Superadmin recovery, production SMTP/delivery, PostgreSQL/RLS and owner acceptance remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-193-2026-09-09.md#temporary-credential-envelope-fail-closed-boundary--2026-09-11t132031z) |
| 2026-09-11, TASK-205 Demo parity gate | After the readiness regression, `npm run demo` passes all PGlite transaction/rollback/approval/stock/GL assertions and `npm run build:demo` completes with exit code 0; no generated schema or migration changed | Local Demo/PGlite parity remains green; real provider, production gateway/account/region/retention, live rotation/revocation and dead-letter alert/manual recovery remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#demo-parity-gate-after-readiness-regression--2026-09-11t095323z) |
| 2026-09-11, current full regression | `npm test -- --reporter=dot` passes 209 files / 943 tests with 3 skipped files/tests (212 files / 946 tests total) in 1330.15 seconds; PostgreSQL target separately passes 3/3 against the disposable PostgreSQL 16 instance | Current source/test regression is green after the TASK-205 readiness projection; no task, criterion or checkpoint count changed; production, provider and external alert acceptance remain separate; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#full-regression-recheck--2026-09-11t085626z) |
| 2026-09-11, TASK-205 HTTP driver-to-worker failure boundary | Added a cross-layer 401/500 HTTP Vision regression; extraction remains failed with `rawText=null` and bounded error, and local OCR is not called; processing/driver tests pass 2 files / 31 tests plus lint, typechecks, Demo and Demo build | Non-success provider responses are now directly evidenced as unsafe at the worker boundary; production provider configuration, rotation/revocation, alert/recovery and owner acceptance remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#http-vision-driver-to-worker-failure-boundary--2026-09-11t101459z) |
| 2026-09-11, TASK-205 HTTP visual-fingerprint propagation | HTTP Vision now preserves and normalizes a provider-supplied 64-character hexadecimal visual fingerprint; invalid type/format fails closed, and the driver-to-worker test persists the value; processing/driver tests pass 2 files / 37 tests plus lint, typechecks, Demo and Demo build | Provider provenance is no longer silently dropped at the HTTP boundary; live provider/account/region/retention, rotation/revocation, alert/recovery and owner acceptance remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#http-vision-visual-fingerprint-propagation--2026-09-11t104542z) |
| 2026-09-11, TASK-234 candidate recheck | Reviewed detached `02f28fe` upload-envelope repair, ran candidate lint/typechecks, focused 3-test capability check, PGlite Demo, Demo build, docs and diff gates; temporary dependency/test files were removed | Candidate evidence is clean and reviewable; publication, hosted post-push verification and real-provider/OCR acceptance remain open; CI for the separately published pre-repair revision is recorded below; [dated record](docs/ai-native/evidence/TASK-234-2026-09-11-codex-demo.md) |
| 2026-09-11, TASK-234 public candidate recheck | Read-only Pages manifest/hash verification passed (136 files; 135 served assets); fresh Finance Preparer Demo showed the published My Receipts bundle still hides upload controls because it reads the response envelope before unwrapping `data` | Hosted pre-repair gap is confirmed; exact candidate publication and post-push upload verification remain open; [dated record](docs/ai-native/evidence/TASK-234-2026-09-11-codex-demo.md#public-pages-candidate-recheck--2026-09-11t023929z) |
| 2026-09-11, TASK-204 official-source recheck | Rechecked current IRAS and Royal Malaysian Customs/MOF rates, thresholds and transitions against the seeded resolver; recorded the rental/leasing source conflict and preserved fail-closed scope | Review packet is stronger and current; qualified tax-owner approval, authoritative source selection and production configuration remain open; [dated record](docs/ai-native/evidence/TASK-204-2026-09-11-source-review.md) |
| 2026-09-11, TASK-204 effective-date ambiguity guard | Overlapping effective tax-rule rows now return no match; 2 repository/tax files / 16 tests plus lint, typechecks, Demo and Demo build pass | Source ambiguity is fail-closed while owner decisions remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-204-2026-09-11-source-review.md#effective-date-ambiguity-guard--2026-09-11t105346z) |
| 2026-09-11, TASK-204 purchasing fixture repair | Full regression exposed duplicate identical fixture rows being treated as ambiguous; the fixture now reuses the tenant-scoped `SR` rule for repeated setup, and purchasing 11 files / 60 tests plus repository/localization/purchase-return 3 files / 22 tests pass | Production effective-date, classification, official-source and qualified-owner acceptance remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-204-2026-09-11-source-review.md#purchasing-fixture-preserves-ambiguity-guard--2026-09-11t150229z) |
| 2026-09-11, current full regression after TASK-204 fixture repair | Current root `npm test -- --reporter=dot` passes 210 files / 984 tests with 3 PostgreSQL-dependent files / 3 tests skipped because no PostgreSQL target is configured | Full local Vitest regression is green; qualified tax-owner, production configuration, provider, alerting, deployment and Print acceptance remain separate; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-204-2026-09-11-source-review.md#full-current-root-regression-after-fixture-repair--2026-09-11t152424z) |
| 2026-09-11, TASK-204 disposable PostgreSQL parity | Using the existing disposable `codex-erp-postgres-s5` PostgreSQL 16 target, `POSTGRES_URL=... npm run test:postgres -- --reporter=dot` passes 3 files / 3 tests in 12.22 seconds after the purchasing fixture repair | Local PostgreSQL parity is green; qualified SG/MY tax-owner approval, production configuration, provider, alerting, deployment and Print acceptance remain separate; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-204-2026-09-11-source-review.md#disposable-postgresql-parity-after-fixture-repair--2026-09-11t153034z) |
| 2026-09-11, TASK-204 Company/regime isolation regression | Added a cross-Company/foreign-Master tax lookup regression for identical `SR` codes with GST/SST-specific rates; focused repo test passes 1 file / 10 tests and the 4-file repository/localization/purchasing regression passes 31/31; complete current-root Vitest passes 210 files / 985 tests with 3 PostgreSQL-dependent files / 3 tests skipped | Tenant/regime lookup evidence is stronger without changing production logic; qualified SG/MY tax-owner approval, production configuration, provider, alerting, deployment and Print acceptance remain separate; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-204-2026-09-11-source-review.md#company-and-regime-isolation-regression--2026-09-11t155951z) |
| 2026-09-11, TASK-205 local OCR HTTP worker extraction | A loopback-only Tesseract 5.5.3 endpoint carried a readable synthetic receipt through `createHttpLocalOcrExtractor` and `processDocumentJobBatch`; one clean scan and one `local_ocr` extraction persisted with source/output hashes; durable processing regression passes 1 file / 17 tests and the 4-file document/driver/readiness/control-plane regression passes 52/52 | Local HTTP OCR source/worker evidence is stronger; production gateway/account/region/retention, live rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; no count/criterion/checkpoint/status change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#local-ocr-http-worker-extraction--2026-09-11t161239z) |
| 2026-09-11, TASK-205 OCR worker full regression and parity gates | Current root `npm test -- --reporter=dot` passes 210 files / 986 tests with 3 PostgreSQL-dependent files / 3 tests skipped because the full run has no default PostgreSQL URL; the explicit disposable PostgreSQL target passes 3 files / 3 tests; lint, both typechecks, Demo, Demo build, docs check, root Markdown/link review and `git diff --check` pass | Local OCR worker evidence is fully regression-gated across PGlite and disposable PostgreSQL; no task, criterion or checkpoint count changed; production provider/account/model/region/retention, live rotation/revocation, delivered alert/recovery and owner acceptance remain open; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#verification-gates-after-local-ocr-http-worker--2026-09-11t163920z) |
| 2026-09-11, TASK-205 cross-tenant Local OCR worker scope | One shared worker claimed `M1/C-SG` and `M1/C-MY` jobs, sent each exact source byte/hash to Local OCR and persisted each result under its matching composite scope; focused processing passes 1 file / 18 tests and the 4-file document/driver/readiness/control-plane regression passes 53/53 | Worker tenant-boundary evidence is stronger without changing production RLS or task status; production provider/account/model/region/retention, live rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; no count/criterion/checkpoint change; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#cross-tenant-local-ocr-worker-scope--2026-09-11t164628z) |
| 2026-09-11, TASK-205 cross-tenant full regression and parity recheck | Current root Vitest passes 210 files / 987 tests with 3 PostgreSQL-dependent files / 3 tests skipped; diagnostic isolated PostgreSQL files pass 1/1 each and the final serial disposable PostgreSQL 16 suite passes 3 files / 3 tests after one concurrent harness observation returned two assertion failures | Cross-tenant worker evidence is fully regression-gated; the concurrent PostgreSQL harness observation is retained as a stability note and does not change task counts; production provider/account/model/region/retention, rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#verification-after-cross-tenant-scope-regression--2026-09-11t170811z) |
| 2026-09-11, TASK-205 canonical PostgreSQL parity clean-window rerun | After the long local Vitest run terminated, the unmodified `POSTGRES_URL=... npm run test:postgres -- --reporter=dot` command passed 3 files / 3 tests in 11.83 seconds; the earlier concurrent observation remains separately recorded | Canonical PostgreSQL parity is confirmed without changing the test script or registry counts; production provider/account/model/region/retention, rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#canonical-postgresql-parity-rerun-after-full-regression--2026-09-11t171223z) |
| 2026-09-11, TASK-205 documentation gates after parity rerun | Exact GOAL validator passes with 226 done / 6 in progress / 5 todo / 3 blocked, 27/48 criteria and 36/60 checkpoints; `npm run docs:check` passes 79 Markdown files / 795 local links, root review reports `8 196 0`, and `git diff --check` passes | Documentation consistency is current; repeated gates add no capability progress and no task/criterion/checkpoint status changes; production provider/account/model/region/retention, rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#documentation-gates-after-canonical-postgresql-parity--2026-09-11t171548z) |
| 2026-09-11, TASK-205 cross-tenant extraction policy and credential routing | One shared worker processed `C-SG` Local OCR and `C-MY` BYOK Vision jobs; each received only its own source bytes/hash and policy, Malaysia received its own region/model/base URL/credential, and persisted rows retained the matching provider/scope; focused processing 1 file / 19 tests and four-file regression 54/54; full local 210/988 with 3 PG-dependent tests skipped; canonical PostgreSQL 3/3 | Tenant/policy/credential routing evidence is stronger across Local OCR and Vision without changing task counts; production provider/account/model/region/retention/health, rotation/revocation, dead-letter alert/recovery and owner acceptance remain open; [dated record](docs/ai-native/evidence/TASK-205-2026-09-11-source-review.md#cross-tenant-extraction-policy-and-credential-routing--2026-09-11t174711z) |
| 2026-09-11, TASK-202 Pack Print API artifact boundary | Authenticated Company Receipt Pack `action=print` now has a focused contract regression: HTTP 200 `application/pdf`, inline disposition, private no-store headers, bounded artifact/source hashes, `%PDF` body prefix and `pdf_print` audit under the matching Company scope; full Company Receipts API file passes 1/8 and the new case 1/1 | Local API download/print semantics are directly evidenced without changing Pack lifecycle or task counts; production readable SG/MY source replacement and human Finance/QA Print acceptance remain open; [dated record](docs/ai-native/evidence/TASK-202-2026-09-11-codex-demo.md#api-print-artifact-boundary--2026-09-11t180836z) |
| 2026-09-11, TASK-234 remote CI terminal recheck | Read-only GitHub Actions query confirms run `34423634351` concluded `cancelled`; all four Vitest shards passed, but the combined typecheck/transaction/Demo-build job stopped during the i18n browser matrix | Corrected stale `in progress` wording; no green remote CI or task/criterion/checkpoint promotion is claimed; [dated record](docs/ai-native/evidence/TASK-234-2026-09-09.md#remote-ci-terminal-recheck--2026-09-11) |
| 2026-09-11, TASK-234 published-revision CI recheck | Read-only GitHub Actions query confirms run `34539106998` passed for published pre-repair revision `3e93249`; four Vitest shards, typecheck/transaction/Demo build, i18n browser matrix, smoke and layout audits all passed | This is hosted pre-repair evidence, not current root or detached upload-repair candidate acceptance; publication and post-push upload verification remain open; [dated record](docs/ai-native/evidence/TASK-234-2026-09-09.md#later-remote-ci-success-for-the-published-pre-repair-revision--2026-09-11) |
| 2026-09-11, TASK-234 Demo gateway response cleanup | Browser Demo gateway cancels unconsumed 403/503/redirect response bodies before bounded errors; denied-session path dispatches no inference request; gateway 1-file/10-test and assistant 3-file/32-test regressions, lint/typechecks, Demo/build and desktop/375px E2E pass | Source/Demo transport robustness is stronger; no provider/production acceptance, release-owner authorization, task/criterion/checkpoint or count change; [dated record](docs/ai-native/evidence/TASK-234-2026-09-09.md#demo-gateway-rejected-response-cleanup--2026-09-11t103256z) |
| 2026-09-11, TASK-234 Agent persisted credential-envelope revalidation | Agent provider public views now use `isEncryptedToken`; malformed stored credentials are unconfigured/disabled with no label, and updates fail closed until clear or valid replacement; provider/API/assistant regression passes 3 files / 30 tests | Local TASK-234/S2 secret-safety evidence is strengthened without changing tenant, approval, Demo/PGlite parity or status; real provider account/model/region/retention, live model/OCR, production and human acceptance remain open; no count/criterion/checkpoint change; [dated record](docs/ai-native/evidence/TASK-234-2026-09-09.md#agent-persisted-credential-envelope-revalidation--2026-09-11t124524z) |

Documentation acceptance: run the GOAL count command, `npm run docs:check`, separately
render/check links in GOAL/PROGRESS/GOAL_PROMPT, inspect the final diff and run
`git diff --check`; read back the concise project KB update. Runtime gates are outside
this documentation-only change and must not be reported as newly passed.

Verification recorded for the prior documentation update: the read-only validator passes, all 48 acceptance
strings match the registry, and only G07.3 changed checkbox state. The registry is
byte-for-byte unchanged. Isolated negative checks reject a stale total, changed
acceptance text and a missing open-task row. Markdown rendering verifies 78 local
link targets/anchors across the three root files; three pre-existing evidence anchors
were repaired. The repository docs checker passes 73 files / 774 local links.
Final `git diff --check` passed. The project goal KB item
`24435a44-ca84-4794-a242-3d10bae8a7ab` was updated and read back exactly.
These are documentation checks, not new application test results.

Verification recorded for the 2026-09-11 TASK-201 runtime repair: the exact
GOAL count/dependency/fingerprint validator passes with 240 registry rows (226
done / 6 in progress / 5 todo / 3 blocked), 27/48 criteria and 36/60 checkpoints;
`npm run docs:check` passes 77 Markdown files / 784 local links; the rendered root
Markdown review passes 81 links; and `git diff --check` passes. The focused telemetry
test passes 1 file / 7 tests; lint, root/web typechecks, Demo build and PGlite Demo
pass. `npm run test:postgres` was invoked but its three configured files were all
skipped because no PostgreSQL test URL was available, so no PostgreSQL pass is claimed.

## Continuation resource check — 2026-09-11

Candidate reconciliation added no accepted capability: tasks/criteria/checkpoints
delta **0/0/0**. Count totals remain unchanged; the registry fingerprint above
includes the new source-review record. TASK-234 is still the next acceptance exit.
The user subsequently authorized the existing Demo endpoint with Codex OCR/review.
That Demo run is complete; no user action or separate provider credential is pending
for it. The separate server-provider configuration was inventoried and locally revalidated; no live provider account/model call or production acceptance is claimed.

The 2026-09-11 TASK-201 PostgreSQL follow-up used only the empty disposable
`codex-erp-postgres-s5` container. A 25ms transaction-local budget cancelled a
deliberate 200ms sleep with SQLSTATE `57014` at 28ms, and a new connection showed
the default timeout `0` after commit; the configured telemetry snapshot returned
8 queues. `POSTGRES_URL=... npm run demo` passed parity/concurrency and
`npm run test:postgres` passed 3 files / 3 tests. This closes local cancellation
semantics only; representative queue volume/plans, owner-approved p95/p99
budgets, alert/restore/failover and production acceptance remain open. The exact
GOAL validator still passes with 226/240 done, 6 in progress, 5 todo, 3 blocked,
27/48 criteria and 36/60 checkpoints; `npm run docs:check` passes 79 files / 792
links, root Markdown review passes 95 local links, and `git diff --check` passes.
Evidence and KB read-back: [TASK-201 PostgreSQL timeout record](docs/ai-native/evidence/TASK-201-2026-09-11.md#isolated-postgresql-timeout-cancellation--2026-09-11t041409z),
KB item `ab6adbe0-b8ee-4c96-8400-a6e118f62036`.
The upload UI fix and targeted verification are actual engineering progress, while
full task/criterion/checkpoint counts remain unchanged.

The follow-up calendar connection join experiment used a fresh temporary PostgreSQL
database in the same disposable container. The current source keeps queue-wide
aggregates and worker RLS, but evaluates enabled calendar connections through a
tenant-scoped derived `LEFT JOIN`; 25,000 synthetic leave events remained pending and
ready as expected, and the source calendar snapshot completed in 32ms. The comparison
and focused 9/9 telemetry test result are recorded in the [TASK-201 join evidence](docs/ai-native/evidence/TASK-201-2026-09-11.md#calendar-connection-join-experiment-and-source-repair--2026-09-11t044232z).
This is a local query improvement only; the task counts, criteria and checkpoints are
unchanged.

The project KB connector recovered during this continuation. `kb_list` resolved
`erp-system-project-logic` to UUID `ef47bf4b-83e1-42b2-a412-66912d04ea24`, and the
source-backed reconciliation item was synchronized and read back successfully.
The KB remains continuity context; current source, tests and STATUS/SPEC docs remain
authoritative.

## Demo authorization boundary recheck — 2026-09-11

The user reconfirmed that the existing Demo endpoint may be used directly and that
Codex may perform the AI OCR/receipt/PDF review without any manual user action. This
matches the already recorded Demo evidence and creates no new capability, criterion or
checkpoint. The public Pages `release.json` still reports revision
`3e93249e34ff607fc693c1ad7b72e020df25825c`, while the verified local upload-repair
candidate `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4` remains unpushed. The exact
missing resource is release-owner authorization for external push and Pages
deployment; the next measurable exit is publication followed by a fresh Hosted Demo
upload check without a screen override. The confirmation is recorded in KB item
`a9237e74-94ab-4612-9696-dbf411256c56` and does not authorize provider credentials,
production writes or business-owner acceptance.

2026-09-11, TASK-234 current hosted/local recheck | Fresh public Pages Chromium
at revision `3e93249e34ff607fc693c1ad7b72e020df25825c` still rendered My Receipts
with zero camera/file/capture controls and no console errors; the local response-
envelope repair passed the focused 3-test screen regression and Company Receipts
desktop/mobile E2E | Hosted gap remains. The exact missing resource is release-
owner authorization to publish candidate `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4`,
then repeat the hosted upload check without a screen override. See [dated evidence](docs/ai-native/evidence/TASK-234-2026-09-11-codex-demo.md#current-public-and-local-candidate-recheck--2026-09-11t100220z).
