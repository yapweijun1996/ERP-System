# ERP module verification coverage

TASK-193 local recovery evidence is recorded in
[the 2026-09-09 record](ai-native/evidence/TASK-193-2026-09-09.md): lifecycle/API,
mail worker, rate-limit, admin and integration-event regressions plus the real
browser journey in `tests/e2e/auth-recovery.spec.ts`. The mail sink is in-memory;
this does not prove SMTP or Platform Superadmin email recovery.


TASK-240 adds a [pilot negative-case matrix](ai-native/PILOT_TEST_MATRIX.md) and
[evidence template](ai-native/EVIDENCE_TEMPLATE.md). These are planned tests,
not passing results. TASK-228/S1-S5 and TASK-232/S1-S5 now have dated passing
evidence; TASK-233/S1-S5 has source-backed action-class, approval-policy, exact-intent binding, guarded exact execution, replay, governed-correction and final negative-path evidence; TASK-229/S1-S5 has dated prerequisite, adapter-lifecycle, visible-confirmation, fallback, negative-path and local-gate evidence; TASK-235/S1-S5 has dated semantic-contract, bounded-read, authorization, deterministic-reconciliation, scoped-SOP, citation, uncertainty, cache-invalidation and final accuracy/isolation evidence;
TASK-236/S1-S5 now has durable run/step, recovery, concurrency and green remote CI evidence; TASK-234 and TASK-238 remain open while the remaining packets require their own evidence.

AI Native target coverage is tracked in [GOAL.md](../GOAL.md): **7/12 workstreams,
32/48 DoD criteria** and **41/60 execution checkpoints**. TASK-227 verifies documentation, counts and links only;
TASK-228 is verified through its contract, dispatch, preparation, replay and adapter
evidence; TASK-232/S1-S5 plus its post-S5 locale/route remediation has source-backed identity/grant/transport/audit/lifecycle/PostgreSQL and full i18n-browser evidence; TASK-233/S1-S5 has source-backed action-class, approval-policy, exact-intent binding, authenticated exact Pack execution, concurrency, replay, correction, negative-path and artifact evidence; TASK-230/S1-S5 has source-backed local MCP/auth/client/operations evidence; TASK-229/G02
now has source-backed local native WebMCP evidence in isolated Chrome 152, while
TASK-231, TASK-234 and TASK-237–239 require further connector, provider, evaluation and
release evidence; TASK-236 is complete for repository scope. Bundled Chromium 149 and the in-app browser remain ordinary-UI
fallback environments; local native WebMCP evidence does not certify a production
browser rollout.

TASK-234/S3 adds [Receipt Assistant loopback evidence](ai-native/evidence/TASK-234-2026-09-09.md#s3--implement-the-receipt-conversation-loop): six allowlisted server tool calls, cited Receipt facts, exact G06 preview/approval, persisted Pack and PDF artifact/source hash read-back, replay/no-duplicate behavior, denial/tenant-input rejection and cancel/no-write paths. S4 adds the contextual workspace and its five-locale/theme/desktop/mobile/focus matrix; S5 adds actual Demo/PGlite Pack/artifact assertions and local gates. No approved real-provider account or network model call is available, so that gate remains open.
TASK-238/S1 adds a [source-backed six-journey capability matrix](ai-native/evidence/TASK-238-2026-09-09.md#cross-module-capability-matrix) with owner roles, source/test references and explicit exclusions. It does not claim owner approval, settlement implementation, statutory compliance or production proof.

Reviewed: **2026-09-09**, audit baseline `243af56` with current verification follow-up
sources `3a4b6e8`, `7a06c47`, `df91653` and `2a43c95`; TASK-214 evidence and TASK-219/220/221/222 follow-up; TASK-215
documentation reconciliation.

**All modules have not passed complete end-to-end testing.** All 130 registered routes
rendered at desktop/mobile and the TASK-223 follow-up screen audit passes its recovery
assertion. Route rendering, API metadata, test-file presence, successful commands and
production acceptance are separate evidence levels. No percentage of business coverage is
inferred.
The [specialist report](ERP_SPECIALIST_REVIEW_2026-09-07.md) contains reproductions,
screenshots and exact run limitations; [STATUS.md](STATUS.md) owns implementation status.

## Module evidence inventory

Every current directory under `src/modules/` is listed. Test-file counts are recursive
`*.test.ts` files in that directory only, including integration files if colocated;
API/auth tests elsewhere are not counted. Counts describe discoverability, not executed
or passing tests. The latest full Vitest run passes 204 files / 901 tests with 3 skipped
files and 3 skipped tests. Source folder links provide the current implementation and
colocated test entry points.

| Module/source | Colocated test files | Latest audit evidence and remaining boundary |
| --- | ---: | --- |
| [account](../src/modules/account/) | 2 | No fresh account lifecycle business E2E; earlier notification/auth evidence remains dated. |
| [admin](../src/modules/admin/) | 1 | Route rendering only in TASK-214; permission matrix and role mutation proof were not rerun. |
| [approval](../src/modules/approval/) | 0 | Procurement approval actor/reason observed; other approval and delegation paths not fully exercised. |
| [assets](../src/modules/assets/) | 2 | Route rendering only; acquisition/depreciation/disposal business cycle not rerun. |
| [crm](../src/modules/crm/) | 6 | PGlite proof passes conversion to order/stock/GL plus duplicate and insufficient-stock rejection; no fresh complete browser lead-to-cash cycle. |
| [documents](../src/modules/documents/) | 5 | Route rendering only; external scanning/OCR/storage/provider and recovery evidence remains TASK-205. |
| [expenses](../src/modules/expenses/) | 12 | Receipt/claim routes rendered; Receipt Pack unit/API/Demo/browser coverage now includes unsupported-original identity-page rendering, while no fresh complete claim approval/reimbursement or production Pack export E2E is claimed; TASK-202 production evidence remains open. |
| [finance](../src/modules/finance/) | 6 | Sales/purchasing/payroll GL assertions pass in PGlite proof; TASK-218 repairs invoice aging/period presentation KPIs with focused/browser evidence; TASK-223 synchronizes and measures payment-voucher recovery in the full route audit. No full AR/AP closing cycle. |
| [hr](../src/modules/hr/) | 14 | My Leave and Staff Calendar included in targeted i18n matrix; full onboarding/leave/balance/calendar mutation cycles not rerun. Existing Calendar browser fixture stubs reads AND appointment creation, so it is not persisted-create proof. |
| [integration](../src/modules/integration/) | 3 | Route rendering only; real SMTP/calendar/provider delivery and recovery not proven. |
| [inventory](../src/modules/inventory/) | 5 | PGlite stock issue, transactional rollback and sales/purchase effects pass; no full lot/serial/pick-pack/warehouse cycle. |
| [localization](../src/modules/localization/) | 1 | Governed seed rejection observed; payroll fixture arithmetic is not statutory certification. Tax-owner review remains TASK-204. |
| [manufacturing](../src/modules/manufacturing/) | 2 | Route rendering only; BOM/work-order/material/finished-goods cycle not rerun. |
| [payroll](../src/modules/payroll/) | 3 | PGlite SG/MY fixture totals, balanced journals and repost denial pass; browser payroll lifecycle and statutory submissions not rerun. |
| [project](../src/modules/project/) | 3 | Route rendering only; progress claim, timesheet, billing and receipt lifecycle not rerun. |
| [purchasing](../src/modules/purchasing/) | 11 | Fresh compact seed and simulated historical-pack upgrade now approve/receive/post exactly one balanced supplier invoice through shared commands; the fail-closed unclassified/regime-mismatch guard remains covered. TASK-221's built-Demo E2E now verifies approval → warehouse/date/full-quantity review → receipt posting at desktop/mobile with no unsupported partial/QC register controls. Browser/API production tax-owner evidence is separate. |
| [quality](../src/modules/quality/) | 1 | Route rendering only; inspection/disposition business cycle not rerun. |
| [reporting](../src/modules/reporting/) | 1 | Routes rendered; aggregate report reconciliation, export correctness and large-data plans not comprehensively tested. |
| [sales](../src/modules/sales/) | 8 | MCP SO-2 confirmation/stock/invoice/balanced GL and SO-3 rejection pass; TASK-217 fixes F02 date-only due-date arithmetic, TASK-218 fixes F03 invoice aging/period presentation and TASK-219 fixes sales-invoice locale labels with focused/browser evidence; TASK-220 separately covers shared filled-action palette evidence; no complete customer settlement chain. |
| [service](../src/modules/service/) | 2 | Route rendering only; contract/ticket assignment/resolution lifecycle not rerun. |
| [setup](../src/modules/setup/) | 3 | Fresh local Demo setup/sign-in observed; current production bootstrap/provisioning and remote health not exercised. |
| [warehouse](../src/modules/warehouse/) | 1 | Route rendering only; receiving/transfers/picking reconciliation not fully exercised. |

## Cross-cutting execution results

| Gate | TASK-214 result | Required follow-up |
| --- | --- | --- |
| Demo build / PGlite domain proof | Passed | TASK-216 fresh seed and simulated v15→v16 upgrade complete the seeded PO approval → receipt → invoice chain with one balanced supplier invoice; TASK-217 date-only boundary tests and TASK-218 mixed invoice-fact tests plus built-Demo KPI/filter route checks pass; shared rejection guards remain green |
| Desktop/mobile route rendering | 130 routes rendered, no console/page errors; full audit passes recovery and layout checks | Production and remote CI evidence remain separate; current full Vitest pass is recorded below |
| i18n | Agent Governance module-local resources, Admin route labels and purchase-wizard labels are synchronized across en/ms/zh/ja/vi. Static audit passes at 1,773 canonical keys / 74 local packs; the full browser matrix passes 130 routes × five languages × two viewports with zero blocking findings. | Production, remote-CI and physical-device evidence remain separate |
| Theme/mobile | Receipt Assistant E2E passes light/dark, 1280px desktop and 375px mobile bounds, focus restoration and touch targets; existing filled-action contrast and mobile usability checks remain available | Physical-device acceptance TASK-017 and exhaustive palette/device certification remain separate |
| PWA update lifecycle | Passed explicit deferral/acceptance/reload flow | Physical devices, multiple tabs, unsaved drafts, in-flight requests and interrupted upgrades remain unverified |
| Performance | Warm route and bundle observations only | TASK-201; cold-start, interaction percentiles, realistic data and concurrent tenant workloads |
| Worker telemetry | Focused telemetry tests pass 6/6; ready/in-flight predicates cover active leases, enabled calendar connections and reminder due time; emission is single-flight and non-blocking | TASK-201; whole-table query budget/plan evidence, operational sink/alerts and production SLO/DR/load evidence remain |
| Release identity and read-only release evidence | `scripts/write-release-manifest.test.ts` passes 4/4 for replacement, `0600` permissions, cleanup, failure preservation and symlink/non-file rejection; `scripts/verify-release.test.ts` passes 6/6 against a local HTTP fixture for root/health/setup/manifest, asset byte/hash matching, revision mismatch, same-path redirect acceptance, changed-path rejection and CLI exit/status parity | Run `npm run verify:release -- <origin> --expected-revision <commit>` against the selected release origin; live deployed `/health` + `/release.json` and every listed asset hash/byte count must match, while remote revision and rollback evidence remain TASK-199 |
| Full unit/integration suite | Current workspace passes 204 files with 3 skipped / 901 tests with 3 skipped; TASK-234 assistant runtime/loop regressions and TASK-235 semantic/knowledge regressions are included | PostgreSQL target and production evidence remain separate |
| PostgreSQL/API/production | TASK-232/S5 disposable PostgreSQL 16 security/provisioning/Agent FORCE-RLS gate passes 3 files / 3 tests; TASK-233/S5 focused Agent/PGlite/API regression passes 7 files / 32 tests and disposable PostgreSQL passes 3 files / 3 tests | Production database, deployed revision, remote CI and module-specific PostgreSQL/API UAT remain TASK-199/203/209 gates |
| Generated schema/RLS static coverage | TASK-233/S2 check passes: 109 migrations/schema version 108, 259 tables, 229 policies + 10 exemptions; Agent credential/owner audit and execution-intent boundaries are generated and covered | This does not execute target-host deployment or production isolation |
| TASK-233/S5 negative paths and artifacts | P06-P12 pass with zero unauthorized or duplicate business writes; authenticated HTTP/PGlite, disposable PostgreSQL, Preview/PDF/Print browser flow at 1440×900 and 375×844, generated/static gates and full-suite evidence are recorded in the dated packet | Production, deployed-host, remote MCP/WebMCP, provider and physical-device evidence remain separate |
| TASK-230/S1 MCP topology and local authorization fixture | Official current authorization/transport docs were consulted; exact `@modelcontextprotocol/sdk@1.30.0` reports MCP `2025-11-25`; the local fixture passes valid mapping and rejects wrong resource, missing scope, expiry and revocation | Production issuer/deployment evidence remains separate |
| TASK-230/S2 MCP endpoint and discovery | Official SDK Streamable HTTP transport serves `/api/mcp/v1`; RFC 9728 discovery and 401 metadata challenge pass; official TypeScript client initializes with `2025-11-25`, lists exactly six G01 tools and completes structured `receipt.search`; strict inputs, bounded 50 MB result budget/100 MB hard cap and 10 second timeout are wired | Production OAuth/OIDC issuer and deployment remain release evidence |
| TASK-230/S3 per-call authorization and no-write negatives | Boundary revalidates configured issuer/audience and all required scopes, including JSON-RPC batch scope union; fresh PGlite/HTTP tests reject wrong audience, expired/revoked tokens and missing prepare scope, deny guessed Company data and deny cancelled pre-commit Pack creation; Pack row count remains zero | Production issuer cryptographic validation and PostgreSQL/deployed proof remain release evidence |
| TASK-230/S4 two-client interoperability | Official TypeScript SDK `1.30.0` and Python SDK `mcp==1.27.2` complete read/detail, bounded pagination, prepare, approved create, dropped-response replay, changed-key conflict, Pack read and PDF export against one fresh PGlite fixture; Python decodes the MCP resource and verifies artifact hash/byte length separately from source hash | Production OAuth issuer, multi-instance rate capacity and PostgreSQL/deployed proof remain release scope |
| TASK-230/S5 operations and final gates | Focused 9-file/37-test MCP/API regression, latest full 204-file/901-test local suite, 3 skipped PostgreSQL guards, Demo/build, Web typecheck, generated schema/pack/i18n/drift/RLS/permissions/docs/diff gates pass; documented 60/60s hashed-key rate guard, 1 MB input, 50 MB/100 MB result bounds, 10s timeout and protocol compatibility | No production OAuth/JWKS, shared rate store, deployed PostgreSQL, physical-device or rollback evidence is claimed |
| TASK-229/S1 WebMCP prerequisites and browser support | Official W3C/Chrome WebMCP references checked; TASK-228/232/233 are Done; Playwright Chromium 149 and the in-app browser expose no native `document.modelContext`, while isolated Chrome 152 with the official local `WebMCPTesting` flag exposes the native surface; the normal Company Receipts API/browser E2E passes | The native flag/browser combination is a local compatibility fixture; production browser rollout and release evidence remain separate |
| TASK-229/S2 WebMCP tool registration and retirement | Feature-detected six-tool page adapter uses live actor/Company/permission fingerprints, AbortSignal/generation retirement and navigation/logout/Company/capability hooks; native Chrome 152 registers all six tools at the local origin and the durable E2E proves permission, Company and navigation retirement; API/Demo detail and read-only Pack preparation reuse the tenant-scoped selection boundary | Bundled Chromium 149 and the in-app browser remain ordinary-UI fallback environments; production browser compatibility and rollout remain open |
| TASK-229/S3 visible preparation and confirmation | Company Receipts E2E and native Chrome 152 E2E prove exact selected evidence/totals, visible cancellation with no Pack row, visible confirmation, one persisted Pack, read-back and JSON-safe base64 PDF export; focused adapter tests pass 7 tests and the native artifact is independently hashed | Production Pack release/download evidence remains TASK-202; no production browser or provider result is claimed |
| TASK-229/S4 fallback and negative paths | Real authenticated API/PGlite browser E2E proves invalid date rejection, denied Company switch, server-side receipt-read revocation/recovery, changed-selection retry, cancelled confirmation, persisted Pack/source digest, Preview/PDF/Print and desktop/375px bounds; native Chrome 152 proves stale Company/permission scope retirement and no page errors | PostgreSQL, production release and physical-device evidence remain separate; unsupported browsers continue through the ordinary UI/API fallback |
| TASK-229/S5 browser regressions and local gates | Authenticated API/PGlite E2E, temporary 375px screenshot inspection, contrast (2 themes × 2 viewports), five-locale live i18n, mobile usability, full Vitest (204/900 with 3 skipped files/tests), Demo/build, schema/pack/i18n/drift/RLS/permissions, root/Web typecheck, lint/docs/diff all pass; `npm run test:e2e:webmcp-native` passes Chrome 152 native registration/invocation, cancellation/confirmation, Pack/PDF persistence and mobile bounds | Native local/repository scope is accepted; production browser flag/release, PostgreSQL target, provider and physical-device evidence remain open |
| TASK-235/S1 semantic contract and golden fixtures | Versioned Company Receipt semantic contract defines server-derived Master/Company scope, own/company visibility, inclusive date-only range, Company timezone, ready-only status, mixed-currency totals without FX conversion, as-of timestamp and receipt/document/version source IDs; 1 focused file/5 tests plus 4-file/17-test regression, typecheck and lint pass | S2 bounded read, SOP/policy retrieval, citations, cache invalidation and PostgreSQL/production evidence remain open |
| TASK-235/S2 bounded semantic read | Authenticated `/api/company-receipts/semantic-summary` reuses the G01 `receipt.search` selection boundary, server Company timezone and fixed fields, keyset page 100/max 5,000 rows; own/company/mixed-currency totals and source IDs reconcile in API/PGlite; tenant query tamper, invalid date and revoked access deny; 3 files/14 tests, 4-file/17-test regression, typecheck/Web typecheck/lint pass | SOP/policy retrieval, citations/uncertainty, cache/memory isolation and PostgreSQL/production remain open |
| TASK-235/S3 scoped SOP retrieval | Migration 0109 adds Company-scoped `agent_knowledge_document` metadata for corpus/version/effective window/required permission/field allowlist/revocation; registration requires governance, approved current document, clean scan and successful extraction; authenticated `/api/knowledge/sop` checks live `documents.knowledge.read` before bounded content, excludes expired/revoked/retention/field-denied/cross-Company rows, and labels embedded instructions as untrusted data; 2 files/5 tests plus schema/RLS/drift/permission/type/lint gates pass | Citations/freshness, conflicting-evidence uncertainty, cache/memory invalidation and PostgreSQL/production remain open |
| TASK-235/S4 citations and freshness | Governed SOP results return resolvable authenticated citations with document/version/source-hash identity, effective policy dates and as-of time; policy evidence is grounded/unknown/conflict with `inference:false`, transaction facts are labeled separately, malicious text remains data, and actor/Company/authorization-version scoped cache entries invalidate on source fingerprint changes or revocation; focused retrieval/API/semantic tests pass 4 files/13 tests plus typecheck, Web typecheck and lint | S5 full regressions/gates, explicit Company-switch/permission-downgrade citation isolation and PostgreSQL/production evidence remain open |
| TASK-235/S5 accuracy and isolation | Full local Vitest passes 204 files / 901 tests with 3 skipped files/tests; focused semantic/retrieval/API regression passes 7 files / 25 tests; Demo/build, generated schema/pack/i18n/drift/RLS/permission, type, lint, docs and diff gates pass. Cache warm/cold, cross-Company, live permission downgrade, stale/revoked citations and contradictory-policy non-disclosure are verified | PostgreSQL, provider, deployed-host and production-runtime evidence remain separate release gates |
| TASK-234/S1 runtime states and limits | Server-owned provider request/response/tool-call contracts, draft/waiting/running/succeeded/failed/cancelled states, whole-run timeout/cancellation, input/output/call/retry/cost limits, pre-call reservation and stable actionable errors are implemented; deterministic zero-spend tests pass 1 file / 6 tests plus backend typecheck/lint | Encrypted Company configuration, receipt tool loop, contextual UI and production evidence remain S2-S5 |
| TASK-234/S2 secret-safe provider configuration | Company-scoped `agent_provider_config` stores bounded provider/model/data-policy/runtime metadata and AES-GCM credentials; explicit rotation/provider-change decisions, allowlisted models, exact HTTPS egress, tenant-derived API scope, permission/idempotency boundaries and secret-free views/audits pass 2 files / 7 focused tests; migration 0110, generated schema, drift, permissions and production-RLS checks pass | Real provider account/network evidence, receipt conversation, contextual UI, locale/theme/mobile accessibility and production readiness remain S3-S5 |
| TASK-234/S3 Receipt conversation loop | Server-owned six-tool loop, cited facts, exact G06 preview/approval, persisted Pack/PDF read-back, replay/no-duplicate behavior, denial, tenant-input rejection, cancellation/no-write and unavailable-provider failure pass; focused assistant 1 file/6 tests and shared Agent/runtime regression 7 files/34 tests pass | Real provider, contextual workspace and production evidence remain separate |
| TASK-234/S4 contextual workspace | Vanilla-JS workspace shows Company/draft, cited sources, exact preview, confirmation, progress, cancellation and recovery; scope-change guard prevents contamination; five locales, light/dark, desktop/375px, keyboard focus and touch targets pass in the focused browser fixture. Actual Demo E2E persists/readbacks one Pack and independently verifies PDF artifact/source hashes | The later unlocked in-app browser recheck still found no native WebMCP API; no live provider claim is made. The separate TASK-232 Agent Governance locale follow-up is now closed locally |
| TASK-234/S5 fixture and real-model validation | Focused 7-file/34-test regression, receipt assistant/API/Demo E2E, Demo/API builds, full local Vitest (204 files/901 tests with 3 skipped files/tests), type/lint/Web typecheck and schema/pack/i18n/drift/RLS/permission/docs/diff gates pass | No provider account or approved spend is available; one redacted real-provider run and production/release evidence remain explicit gates |

## Completion requirements

For each business workflow, record actor and Company, starting facts, valid transition,
permission denial, invalid state, stale/replayed request, persisted result, audit evidence,
and stock/GL reconciliation where relevant. Repeat through Demo and authenticated API,
including cross-tenant denial and PostgreSQL concurrency where applicable. Test artifacts
must identify revision, fixture, command, viewport, date and outcome.

Use [USER_ACCEPTANCE_TESTING.md](USER_ACCEPTANCE_TESTING.md) for journey scenarios and
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for release gates. Financial fixture success
is not SG/MY statutory approval. A Bank Receipt currently settles a Project Progress
Claim in full; it does not prove general sales-invoice AR collection. Payment Voucher
currently pays a supplier invoice's full remaining amount; partial allocation is a
capability gap, not a tested feature.

## Findings and dependency order

F01–F08 map one-to-one to TASK-216–223 in [TASK.md](TASK.md) and the
[task registry](../tasks/tasks.jsonl). TASK-218 depends on TASK-217's date contract;
TASK-221 depended on restoring the seeded procurement journey in TASK-216 and is now
complete. TASK-222 closes the focused mobile/status finding and TASK-223 closes the
recovery audit timing finding with Promise-aware evidence.
Existing open production gates remain TASK-199/201/202/204/205/209; TASK-203 is Done
at its recorded CI revision. Physical-device acceptance remains TASK-017, and
SMTP-dependent recovery remains TASK-193. Documentation completion
TASK-215 does not close any runtime finding or production gate.

## Documentation and KB reconciliation

TASK-215 through TASK-230, TASK-232, TASK-233 and TASK-235 are complete; TASK-229/S1-S5 and G02 are
evidenced for local/repository scope. TASK-227 adds goal documentation only; TASK-234/S1-S5 is
evidenced for local/repository scope and remains in progress for its
real-provider gate; TASK-238/S1 is evidenced and remains in progress for owner decisions;
TASK-231, TASK-234 and TASK-237–239 remain AI Native delivery work; TASK-236 is complete for repository scope. Current registry:
**227 Done / 6 In Progress / 4 Todo / 3 Blocked / 240 Total** with 13 pending tasks. The project KB
`erp-system-project-logic` (`ef47bf4b-83e1-42b2-a412-66912d04ea24`) now includes coverage
item `8007eaf3-0ec3-4fa4-b4ca-1bdc3d8153b3`; the architecture inventory, EPIC-066 and
specialist audit items plus KB description were updated and read back. TASK-216 changed
local seed/pack/test runtime files, TASK-217 changed browser date derivation plus its
regression test, TASK-218 changed only sales presentation facts/list predicates plus
their regression test, TASK-219 changed only sales-invoice locale bindings, locale
resources, generated bootstrap and dynamic-date audit classification, and TASK-220 changed
only presentation tokens, filled-state selectors, PWA disabled styling, cache-bust
references and its focused E2E. TASK-221 changed only procurement workflow presentation,
the existing full-receipt modal wiring, canonical register scope and its focused E2E; no
partial-receipt domain capability, production system, deployment or remote CI result is
claimed. TASK-222 then changed only the mobile presentation boundary, viewport zoom metadata,
localized PO status display, shared modal focus lifecycle and its focused browser E2E; the
188px check is a repeatable reflow equivalent, not physical-device evidence. TASK-223
changed only the screen-audit recovery synchronization/budget and its stale PO approval
state expectation; focused case/posting audits and the full 130-route desktop/mobile audit
pass with measured payment-voucher recovery. No production or remote CI result is claimed;
the current full Vitest result is recorded above.
