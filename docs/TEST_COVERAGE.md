# ERP module verification coverage

Reviewed: **2026-09-07**, source `243af56`, TASK-214 evidence; TASK-215 documentation reconciliation.

**All modules have not passed complete end-to-end testing.** All 129 registered routes
rendered at desktop/mobile, but the complete screen audit failed one recovery assertion.
Route rendering, API metadata, test-file presence, successful commands and production
acceptance are separate evidence levels. No percentage of business coverage is inferred.
The [specialist report](ERP_SPECIALIST_REVIEW_2026-09-07.md) contains reproductions,
screenshots and exact run limitations; [STATUS.md](STATUS.md) owns implementation status.

## Module evidence inventory

Every current directory under `src/modules/` is listed. Test-file counts are recursive
`*.test.ts` files in that directory only, including integration files if colocated;
API/auth tests elsewhere are not counted. Counts describe discoverability, not executed
or passing tests. Latest full Vitest attempt stopped without a result; prior 173-file /
705-test evidence is historical. Source folder links provide the current implementation
and colocated test entry points.

| Module/source | Colocated test files | Latest audit evidence and remaining boundary |
| --- | ---: | --- |
| [account](../src/modules/account/) | 2 | No fresh account lifecycle business E2E; earlier notification/auth evidence remains dated. |
| [admin](../src/modules/admin/) | 1 | Route rendering only in TASK-214; permission matrix and role mutation proof were not rerun. |
| [approval](../src/modules/approval/) | 0 | Procurement approval actor/reason observed; other approval and delegation paths not fully exercised. |
| [assets](../src/modules/assets/) | 2 | Route rendering only; acquisition/depreciation/disposal business cycle not rerun. |
| [crm](../src/modules/crm/) | 6 | PGlite proof passes conversion to order/stock/GL plus duplicate and insufficient-stock rejection; no fresh complete browser lead-to-cash cycle. |
| [documents](../src/modules/documents/) | 5 | Route rendering only; external scanning/OCR/storage/provider and recovery evidence remains TASK-205. |
| [expenses](../src/modules/expenses/) | 12 | Receipt/claim routes rendered; no fresh complete claim approval/reimbursement or Pack export business E2E; TASK-202 production evidence open. |
| [finance](../src/modules/finance/) | 6 | Sales/purchasing/payroll GL assertions pass in PGlite proof; invoice aging/period KPIs fail (F03); voucher recovery has unresolved timing (F08). No full AR/AP closing cycle. |
| [hr](../src/modules/hr/) | 14 | My Leave and Staff Calendar included in targeted i18n matrix; full onboarding/leave/balance/calendar mutation cycles not rerun. Existing Calendar browser fixture stubs reads AND appointment creation, so it is not persisted-create proof. |
| [integration](../src/modules/integration/) | 3 | Route rendering only; real SMTP/calendar/provider delivery and recovery not proven. |
| [inventory](../src/modules/inventory/) | 5 | PGlite stock issue, transactional rollback and sales/purchase effects pass; no full lot/serial/pick-pack/warehouse cycle. |
| [localization](../src/modules/localization/) | 1 | Governed seed rejection observed; payroll fixture arithmetic is not statutory certification. Tax-owner review remains TASK-204. |
| [manufacturing](../src/modules/manufacturing/) | 2 | Route rendering only; BOM/work-order/material/finished-goods cycle not rerun. |
| [payroll](../src/modules/payroll/) | 3 | PGlite SG/MY fixture totals, balanced journals and repost denial pass; browser payroll lifecycle and statutory submissions not rerun. |
| [project](../src/modules/project/) | 3 | Route rendering only; progress claim, timesheet, billing and receipt lifecycle not rerun. |
| [purchasing](../src/modules/purchasing/) | 11 | Fresh compact seed and simulated historical-pack upgrade now approve/receive/post exactly one balanced supplier invoice through shared commands; the fail-closed unclassified/regime-mismatch guard remains covered. Browser/API production tax-owner evidence is separate. |
| [quality](../src/modules/quality/) | 1 | Route rendering only; inspection/disposition business cycle not rerun. |
| [reporting](../src/modules/reporting/) | 1 | Routes rendered; aggregate report reconciliation, export correctness and large-data plans not comprehensively tested. |
| [sales](../src/modules/sales/) | 8 | MCP SO-2 confirmation/stock/invoice/balanced GL and SO-3 rejection pass; F02 due date and F03 invoice KPIs fail; no complete customer settlement chain. |
| [service](../src/modules/service/) | 2 | Route rendering only; contract/ticket assignment/resolution lifecycle not rerun. |
| [setup](../src/modules/setup/) | 3 | Fresh local Demo setup/sign-in observed; current production bootstrap/provisioning and remote health not exercised. |
| [warehouse](../src/modules/warehouse/) | 1 | Route rendering only; receiving/transfers/picking reconciliation not fully exercised. |

## Cross-cutting execution results

| Gate | TASK-214 result | Required follow-up |
| --- | --- | --- |
| Demo build / PGlite domain proof | Passed | TASK-216 fresh seed and simulated v15→v16 upgrade complete the seeded PO approval → receipt → invoice chain with one balanced supplier invoice; shared rejection guards remain green |
| Desktop/mobile route rendering | 129 routes rendered, no console/page errors; full audit failed voucher Retry | TASK-223; a focused three-route desktop pass does not close the full gate |
| i18n | Seven routes × five languages × two viewports; two hardcoded labels fail | TASK-219, then full release matrix |
| Theme/mobile | Selected pages inspected; contrast, touch/zoom/status gaps | TASK-220/222; no complete palette/device certification |
| PWA update lifecycle | Passed explicit deferral/acceptance/reload flow | Physical devices, multiple tabs, unsaved drafts, in-flight requests and interrupted upgrades remain unverified |
| Performance | Warm route and bundle observations only | TASK-201; cold-start, interaction percentiles, realistic data and concurrent tenant workloads |
| Worker telemetry | Aggregate shape/redaction tests pass 3/3 | TASK-201; telemetry is awaited before work, uses whole-table aggregates and does not yet make `ready` identical to queue claim eligibility |
| Full unit/integration suite | Stopped without final result | Fresh complete run; do not use historical counts as current proof |
| PostgreSQL/API/production | Not rerun by this audit | TASK-199/203/209 and module-specific PostgreSQL/API UAT |
| Generated schema/RLS static coverage | TASK-215 fresh check passed: 104 migrations, 255 tables, 225 policies + 10 exemptions | This does not execute PostgreSQL RLS or prove target-host deployment |

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
TASK-221 depends on restoring the seeded procurement journey in TASK-216. Translation,
contrast, mobile usability and recovery investigation can proceed independently.
Existing production gates remain TASK-199/201/202/203/204/205/209, physical-device
acceptance TASK-017, and SMTP-dependent recovery TASK-193. Documentation completion
TASK-215 does not close any runtime finding or production gate.

## Documentation and KB reconciliation

TASK-215 and TASK-216 are complete; TASK-217–223 remain Todo. Current registry:
**207 Done / 4 In Progress / 9 Todo / 3 Blocked / 223 Total**. The project KB
`erp-system-project-logic` (`ef47bf4b-83e1-42b2-a412-66912d04ea24`) now includes coverage
item `8007eaf3-0ec3-4fa4-b4ca-1bdc3d8153b3`; the architecture inventory, EPIC-066 and
specialist audit items plus KB description were updated and read back. TASK-216 changed
local seed/pack/test runtime files only; no production system, deployment or remote CI
result is claimed.
