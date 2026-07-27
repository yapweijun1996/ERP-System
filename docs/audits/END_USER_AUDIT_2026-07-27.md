# End-user ERP audit — 2026-07-27

## Executive result

The audit completed at baseline `a9fdb07` without changing application, schema or test
code. No P0 was found. Four P1, three P2 and two P3 root causes were confirmed and are
registered as TASK-141 through TASK-149. Core stock, money, GL, tenant and maker-checker
invariants passed in PGlite and PostgreSQL; the release gate is not green because the
full test run has six deterministic date-dependent failures plus one load-sensitive
timeout.

The isolated API environment remains running as Compose project
`erp-uat-20260727` on Web/API/PostgreSQL ports `18080/13000/15432`. Its named volumes
are retained for review. The Demo preview used origin `http://127.0.0.1:44173` with a
fresh IndexedDB. Existing Docker projects, default ports and databases were untouched.

## Baseline

| Item | Result |
|---|---|
| Commit | `a9fdb076c304a91c59a4779318c5186757bbb8bf` |
| Browser | In-app Chromium plus Playwright Chromium; Asia/Kuala_Lumpur |
| Viewports | 1280×800 and 375×812 |
| Modes | Fresh Demo origin; isolated API/PostgreSQL Compose stack |
| Companies | Acme Singapore (SGD/GST) and Acme Malaysia (MYR/SST) |
| Roles | Superadmin, Viewer+Employee+Manager, pure Employee, Manager, Finance preparer, Finance checker |
| Languages | English, Bahasa Melayu, 简体中文, 日本語, Tiếng Việt |

## Automated evidence

| Check | Result |
|---|---|
| lint; root/web typecheck | Pass |
| Demo schema and drift | Pass at audit baseline: 73 migrations, schema version 72, 226 tables; TASK-141 remediation passes 75 migrations, schema version 74, 232 tables |
| Demo proof | Pass in fresh PGlite; seeded PostgreSQL invocation fails non-idempotently (AUD-007) |
| Dedicated PostgreSQL proof | Pass; PGlite/PostgreSQL results identical and one of two stock races wins |
| PostgreSQL security/RLS | Pass |
| Demo build, smoke | Pass; desktop and 375px, no runtime errors |
| Demo screen audit | Pass: 122 routes, 122 Canonical / 0 Preview, desktop + 375px |
| Demo i18n audit | Pass: 122 routes × 5 languages × 2 viewports; 1,141 keys |
| API route matrix | 1,220/1,220 rendered; zero blank, overflow or session-loss states |
| API matrix network | 50 repeated expected 409 console signals on five unlinked-employee My Work routes (AUD-008) |
| Non-English writes | Pass: MS/ZH/JA/VI unpaid-leave draft → Void with localized headings |
| Full `npm test` | Fail: 505 pass, 7 fail, 1 skip; six deterministic document tests and one suite-load timeout |
| Focused session restart | Pass; the full-suite failure is load-sensitive |
| Focused maker-checker, Payroll/Leave and prior parallel failures | Pass individually |
| Production dependency audit | Fail: root 9 high + 1 moderate; Web 1 high (AUD-003) |

The API matrix's 409 responses show a clear “account is not linked to an active
employee” empty state, so those routes are not blank. They remain a P3 observability
issue because one navigation repeats the same expected conflict several times and
emits browser console errors.

## Journey results

| Journey | Result | Evidence/conclusion |
|---|---|---|
| First-run Demo setup | Pass | EN organization/company/admin/AI-skip/review/finish and Demo login completed on a fresh origin. |
| Admin/Viewer security | Pass with UX issue | Viewer admin reads/writes return 403; restricted page shows no user data. Navigation is too broad for Manager/custom roles (AUD-005). |
| Account and reporting line | Pass | Created employee, reporting manager and employee login through UI; activation forced a password change. |
| Employee → Manager leave | Fail/Pass workaround | One-day paid leave failed despite 14/14 displayed balance (AUD-001); unpaid leave submitted and manager-approved successfully with private reason hidden. |
| Finance maker/checker | Pass with provisioning gap | Separate preparer/checker accounts used official invitation/acceptance fixture; maker self-release denial, checker release, masked output and replay passed focused API test. UI cannot invite those roles (AUD-002). |
| Lead to cash | Pass | Sales/CRM conversion, quotation gate, stock rollback, balanced AR/revenue/tax and duplicate/race controls passed proof/focused tests. |
| Procure to pay | Pass | PO approval, receipt/AP, return, debit/credit, landed cost, payment and invalid-state rollback passed proof/focused tests. |
| Inventory/production/quality | Pass | Quantity conservation, insufficient-stock rollback, work-order lifecycle and NCR release passed. |
| Record to report | Pass | Manual journal/post/reverse, bank reconciliation, period rules and balanced GL passed focused tests. |
| Service/integration/admin | Pass with UX/a11y issues | Control plane and sanitized integration log pass; user-row icon buttons lack accessible names (AUD-009). |
| SG/MY switch and tenant scope | Pass | Settled UI shows MYR after MY switch; RLS/cross-company proof passes. A transient SGD read before reload was not reproducible and is not a finding. |
| Physical phone | Blocked | TASK-017 remains Blocked; 375px automation is not a physical-device acceptance. |
| SMTP/bank/tax external delivery | Blocked by scope | Local outbox/export/import and evidence invariants pass; no real external endpoint was claimed as tested. |

## Confirmed findings

### AUD-001 — P1 defect — new employee paid-leave balance disagrees with submission ledger

- **Mode/role/context:** API, pure Employee, Acme SG, English, desktop.
- **Precondition:** Create EMP-1089 with 14 annual-leave days, create and activate its Employee account.
- **Steps:** My Work → My Leave → New leave → Annual leave → one future full day → Save draft → Submit → Confirm.
- **Expected:** The displayed 14/14 balance permits a one-day reservation, or the UI shows zero before submission.
- **Actual:** The page displays 14/14 but the command returns `Paid leave balance is insufficient`; draft remains Draft.
- **Invariant:** Displayed available balance and the locked ledger balance used by submission must agree.
- **Evidence:** [screenshot](assets/2026-07-27/api-new-employee-leave-balance-mismatch.png).
- **Backlog:** TASK-141.
- **Resolved 2026-07-27:** Migration 0074 backfills eligible legacy employees and all
  new employee paths now create one idempotent `employee_opening` ledger grant in the
  same transaction. My Leave, the HR profile API and UI project that immutable ledger.
  Tests prove 14 days available, exactly one reservation and restoration after reject,
  withdraw and Void.

### AUD-002 — P1 capability gap — Manager and custom roles cannot be invited

- **Mode/role/context:** API/shared Admin UI, Superadmin, Acme SG, English, desktop.
- **Precondition:** Manager exists; Finance Preparer and Finance Checker are created through Roles & Permissions.
- **Steps:** Admin → Users → Invite user → inspect Role options.
- **Expected:** Every eligible tenant role is selectable.
- **Actual:** Only Superadmin, Viewer and Employee are offered. Manager and both Finance roles are absent, although the invitation API accepts their role IDs.
- **Impact:** Independent Manager/Finance users cannot be provisioned end to end through the product UI; the audit required an official API fixture.
- **Evidence:** [screenshot](assets/2026-07-27/api-invite-role-options.png) and DOM option list.
- **Backlog:** TASK-142.

### AUD-003 — P1 security gap — high production dependency advisories

- **Mode:** Build/release baseline.
- **Actual:** `npm audit --omit=dev` reports 9 high + 1 moderate in the root dependency graph (brace-expansion/uuid through Excel export dependencies) and 1 high in Web (PostCSS source-map path traversal).
- **Expected:** No unaccepted high advisory in shipped/build dependencies; any exception has a documented exploitability decision.
- **Backlog:** TASK-143.

### AUD-004 — P1 release-gate defect — document queue tests depend on wall-clock date

- **Mode:** Automated baseline.
- **Steps:** Run `npx vitest run src/modules/documents/processing.test.ts` on 2026-07-27.
- **Actual:** All six tests fail because rows default `available_at` to current DB time while the tests pass hard-coded `now` on 2026-07-26, so zero jobs are claimable.
- **Expected:** Queue tests control both insertion and claim clocks and pass regardless of execution date.
- **Backlog:** TASK-144.

### AUD-005 — P2 UX/RBAC — Manager and custom-role navigation is broader than permissions

- **Mode/roles:** API, Manager and custom Finance roles, Acme SG, English.
- **Actual:** The shell shows Sales, Purchasing, CRM, Inventory, Warehouse, Manufacturing, Quality, HR, Projects, Service, Assets, Admin and Integration even when the role only has dashboard/team/expense or Finance permissions. Restricted APIs still return 403 and no protected rows were observed.
- **Expected:** Navigation and quick actions are derived from effective permissions; direct URLs retain server-side denial.
- **Backlog:** TASK-145.

### AUD-006 — P2 test infrastructure — parallel integration setup exceeds fixed hook timeout

- **Actual:** A 12-file integration batch produced six 10-second `beforeEach` timeouts; every failed file passed alone. The full suite also timed out once in API session restart while its focused rerun passed.
- **Expected:** The supported full-suite command is stable on the documented local environment without hiding real assertion failures.
- **Backlog:** TASK-146.

### AUD-007 — P2 test infrastructure — PostgreSQL demo proof is not safe on a seeded database

- **Steps:** Migrate/seed the isolated API database, then run `POSTGRES_URL=... npm run demo` against it.
- **Actual:** The proof inserts `master_fn=M1` and fails on the existing primary key. It passes only after creating and migrating a separate empty `erp_proof` database.
- **Expected:** The command refuses a non-empty database with a clear guard or owns an isolated schema/database lifecycle.
- **Backlog:** TASK-147.

### AUD-008 — P3 UX/observability — unlinked My Work routes repeat expected 409s

- **Mode:** API, account without active employee link, all five languages and both viewports.
- **Actual:** My Approvals, My Claims, My Leave, My Receipts and Team Calendar render a useful identity empty state, but each navigation generates repeated 409 requests and browser console errors.
- **Expected:** Resolve identity once and render the empty state without duplicate conflict calls/noisy expected errors.
- **Backlog:** TASK-148.

### AUD-009 — P3 accessibility — user-row icon actions have no accessible name

- **Mode:** API/shared Admin UI, desktop.
- **Actual:** Manage-roles and disable buttons expose only `data-tip`; the accessibility tree reports unnamed buttons.
- **Expected:** Icon controls expose stable `aria-label` names while retaining tooltips.
- **Backlog:** TASK-149.

## Rejected or bounded observations

- The MY fiscal context briefly retained the previous value during an in-place switch,
  but the settled view and a fresh proof show `MYR`; this is not a confirmed defect.
- A stale prototype identity appeared in an early accessibility snapshot while the
  setup/auth overlay was replacing the shell; the settled account menu showed the
  correct user, so it is not a finding.
- The API My Work 409 state is functionally correct and does not leak another employee;
  only its duplicate requests/console noise are tracked.
- The matrix covers the defined routes, roles, languages and viewports, not unbounded
  input combinations or a real external bank/tax/SMTP service.

## Environment retention and review

- Keep Compose project `erp-uat-20260727`, its `pgdata` and document-storage volumes
  running until the report owner confirms review.
- Do not run `docker compose down -v` without explicit authorization.
- The generated test accounts and documents contain only synthetic Acme UAT data.
- Screenshot assets were opened after capture and contain no passwords or tokens.
