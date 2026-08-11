# ERP user acceptance testing

This manual is the reusable end-user acceptance checklist for Aria ERP. It tests the
product through the same browser and HTTP boundaries used by real users; domain or SQL
checks supplement the journey but do not replace it.

## Rules of engagement

- Record the commit SHA, date/time zone, browser version, data mode, company, role,
  language and viewport before testing.
- Use isolated origins and databases. Never reuse production data, an existing Docker
  Compose project or a developer's default IndexedDB origin.
- Provision ordinary users through the product UI first. If that is impossible, record
  the capability gap before using an official seed or API fixture.
- Do not use Company Owner as evidence for an ordinary role; its explicit tenant-wide
  administration bundle is intentionally not representative of ordinary roles.
- For each failure capture the request ID, console/network result and the ERP invariant
  that was violated. P0–P2 findings require a screenshot.
- External SMTP, bank and tax submissions remain Blocked unless a real approved test
  endpoint is in scope. A simulated or local export is not an external-service pass.

Current release note (2026-08-10): the live screen registry contains 128 Canonical /
0 Preview routes. `npm run audit:screens` renders every route at desktop and mobile
without console/page errors and passes the layout/behavior contracts. The full i18n
audit passes 1,533 canonical keys / 69 local packs across 128 routes × 5 languages ×
2 viewports; desktop/mobile smoke and the PWA update audit pass. Production migration,
RLS re-application and application release were verified through the existing Compose /
Cloudflare target. TASK-017 remains the physical-device blocker.

## Baseline and environment checklist

- [ ] Working tree and baseline SHA recorded.
- [ ] `npm run lint`, `npm run typecheck`, `npm run typecheck:web` recorded.
- [ ] `npm test`, focused reruns, `npm run demo`, `npm run check:demo-schema`,
      `npm run check:drift`, both builds, smoke and screen/i18n audits recorded.
- [ ] Demo uses a fresh origin and fresh IndexedDB; first-run setup is completed once.
- [ ] API Compose project, ports and volumes are unique; migration, seed and health pass.
- [ ] PostgreSQL proof and RLS integration test run against a dedicated proof database.
- [ ] No credential, token, bank account or private evidence is present in artifacts.

Recommended isolated endpoints are a Demo preview on `127.0.0.1:44173` and a named
Compose project with non-default Web/API/PostgreSQL ports. Store any environment file
outside version control and do not remove its volumes until the report owner confirms.

## Role matrix

For every role verify visible navigation, a permitted read, a permitted write, a direct
URL, a direct API denial and sensitive-data minimisation.

- [ ] Company Owner/Admin: tenant control, users, roles, modules, audit and company switch.
- [ ] Viewer: permitted read-only modules; write controls absent; write APIs return 403.
- [ ] Pure Employee: only My Work and allowed settings; identity derives from the linked
      employee, never from a client-selected employee ID.
- [ ] Manager: reporting line, team calendar and assigned approvals only; private reason
      and unrelated employee facts remain hidden.
- [ ] Finance preparer: prepare allowed, release denied.
- [ ] Finance checker: release allowed only for another maker and never own claims.
- [ ] Multi-role user: union of explicit permissions without a broad default fallback.
- [ ] SG and MY assignment: only assigned companies appear and cross-company calls fail.

## Business journeys

### Identity and control plane

- [ ] First-run language → organization → company → admin → optional AI → finish.
- [ ] Sign in, sign out, activation, reset, disable/offboard and session restart.
- [ ] Create roles, assign multiple roles, change modules and inspect the audit trail.
- [ ] Switch SG/MY company and fiscal period; currency and GST/SST context change together.
- [ ] Repeat with invalid credentials, expired token, disabled user and unassigned company.

### Lead to cash

- [ ] Lead/opportunity → quotation → approval → sales order → delivery → invoice/GL → receipt.
- [ ] Return plus credit/debit note; credit-limit denial and insufficient-stock rollback.
- [ ] Duplicate confirmation, stale version and replay use one order/invoice/stock/GL effect.

### Procure to pay

- [ ] Requisition/RFQ/quote → PO approval → receipt → AP invoice → payment.
- [ ] Purchase return, supplier debit/credit note and landed-cost allocation.
- [ ] Reject early/duplicate invoice, duplicate receipt, overpayment and locked-period posting.

### Inventory to production

- [ ] Product, adjustment, transfer, pick/pack, lot/serial and stock movement trace.
- [ ] Quality receipt/inspection/NCR disposition and release.
- [ ] MRP/work order → release → issue → report output → complete.
- [ ] Insufficient stock and concurrent issue preserve quantity and one movement only.

### Record to report

- [ ] Manual journal → post → reverse; debits equal credits at every posted state.
- [ ] Period lock, bank reconciliation, budget approval and reporting/export permission.
- [ ] Asset depreciation and project receipt/AP costs reach the expected GL accounts once.

### Employee to tax

- [ ] Employee record → login account → activation → linked employee context.
- [ ] Leave draft → submit → manager approval/rejection → Payroll trace.
- [ ] Receipt → claim → manager/Finance decision → balanced posting.
- [ ] Verified payout → maker batch → independent checker → partial bank outcome.
- [ ] Tax evidence snapshot/artifacts → seal → correction/retention/legal hold.
- [ ] Exercise insufficient balance, private-reason redaction, duplicate evidence,
      self-approval, maker-checker conflict and payment replay.

### Service, integration and administration

- [ ] Service contract/ticket assignment and resolution.
- [ ] Notifications and personal activity are actor scoped.
- [ ] Customer import validation/run and sanitized delivery log.
- [ ] User/role/module changes create bounded audit events.

## Route, language and responsive matrix

- [ ] Every route in live `SCREENS` renders in Demo and API modes.
- [ ] Each route renders in `en`, `ms`, `zh`, `ja`, `vi` at 1280×800 and 375×812.
- [ ] No blank screen, uncaught error, horizontal page overflow, raw key or identity marker.
- [ ] Every non-English locale completes at least one create/update/Void journey.
- [ ] Keyboard focus, accessible names, dialog close and mobile action access are checked.
- [ ] A physical phone remains separate acceptance evidence; automation cannot clear it.

## Finding template

```text
ID / category / severity:
Mode / role / company / language / viewport:
Preconditions:
Steps:
Expected:
Actual:
Console / network / request ID:
ERP invariant:
Evidence:
Related specification and backlog task:
```

## Completion criteria

Every checklist item is Pass, Fail or Blocked; every observation is classified as a
reproducible defect, ERP capability gap, UX improvement or hypothesis. Demo/API
differences have an explicit conclusion, P0–P2 evidence opens a remediation task, and
the report records any environment intentionally left running.

## EPIC-059 focused acceptance

- Create a Staff draft without a password, activate with one password, then prove the
  employee, user, membership, roles, leave opening and audit either all exist or all
  roll back.
- Link an existing organization username into a second company and prove no duplicate
  identity or cross-company permission appears.
- Exercise all 12 templates, multi-role union and self/team/department/company scopes;
  verify unowned rows, hidden controls and direct API requests fail closed.
- Enable and disable company modules in dependency order and verify background APIs
  deny disabled modules while Admin remains recoverable.
- Verify Demo manifest/hash/counts, balanced GL, paired stock, 12 real sessions and a
  repeat load; record first-load and common-page performance.
- Preflight CSV and XLSX good/warning/error/replay/oversize cases, prove atomic rollback,
  complete the nine setup stages and confirm employee login is blocked until audited
  Go Live.

## TASK-158 executed acceptance — 2026-07-28

This execution supplements the reusable unchecked template above. It records what was
actually exercised on `codex/interactive-uat-round-1`; exact steps, findings and
screenshots are in `docs/audits/INTERACTIVE_END_USER_AUDIT_2026-07-28.md`.

- [x] Fresh Demo first run, neutral secure boot, sign-in/sign-out and setup collision
      recovery.
- [x] Staff creation, `Employee + Viewer` assignment, temporary-password login,
      forced first-login activation and permanent-password re-login.
- [x] Viewer/Employee self-service leave draft and submission; Manager privacy-redacted
      queue and approval to final `approved` state.
- [x] Buyer PO creation and canonical Pending Approval; Production work-order creation,
      release and BOM availability; Warehouse invalid/locked/valid adjustment paths.
- [x] Finance preparer/checker boundary, maker-checker actions, SG/MY AP settlement and
      closed-period zero-effect rollback.
- [x] Service persona Finance 403 plus ticket create → assign → resolve → detail readback.
- [x] Twelve-persona navigation, quick-create, company, dashboard and direct-URL denial
      matrix, including company membership and sensitive-control minimisation.
- [x] Forty populated transaction-list routes open a native detail or governed preview;
      all 29 declared details pass desktop and 375px page-contract checks.
- [x] Lint, dual typecheck/build, schema/pack/drift checks, smoke, 531 tests, 124-route
      desktop/375px audit and 124 × five-language × two-viewport audit.
- [x] Team Calendar: Company Owner company scope, manager hierarchy scope, privacy-redacted
      detail, July/August Demo v15 cases and desktop/375px month/list layouts.
- [x] PWA v210 update lifecycle: first install is silent, Later suppresses only the
      same worker version, a newer worker still prompts, and Update now reloads once.
- [ ] Physical-phone acceptance — Blocked by TASK-017; no emulator claim substitutes
      for a real device.

## Expenses & Tax v1 — Company Receipts (planned)

Current TASK-179 evidence: explicit own/company list/detail authorization is covered in
domain/API tests; the Demo/API route uses bounded cursor reads; and a dedicated
1440×900 / 390×844 browser test verifies the eight required desktop fields, labelled
mobile cards, load-more pagination and no page overflow. The checklist remains open
because module entitlement, Receipt Pack and full persisted journey proof belong to
TASK-181–183. TASK-180 search/date/Missing Date browser proof now passes.

- [ ] Open `Expenses & Tax → Company Receipts` only when module entitlement and an
      effective receipt capability allow it; direct URL/API attempts otherwise deny.
- [ ] Capture or upload JPEG, PNG, HEIC/HEIF and PDF; verify 20 MB/20-page, MIME/magic,
      duplicate and quarantine failures preserve safe existing records.
- [ ] Review OCR suggestions, manually correct merchant/number/date/amount/currency/
      category/purpose/notes and save even when safe OCR fails.
- [ ] Refresh or re-login and find the receipt in the authorised own/company register;
      another company and an own-only user cannot read it.
- [ ] Search and filter with This Month, Last Month, This Quarter, This Year and Custom;
      verify inclusive same-day boundaries and explicit From > To/empty states.
- [ ] Confirm Missing Date receipts are actionable in the register but excluded with a
      warning from a date-range package.
- [ ] Preview/export all matching pages in chronological order; verify image and
      multi-page PDF readability and currency-separated totals.
- [ ] Print A4 output without sidebar, controls or application chrome on desktop and
      mobile; export/print failure must not mutate receipt records.

This checklist is not evidence of implementation. TASK-183 may check these boxes only
after both adapters, authorization and browser proof pass.

## Planned Platform Module Entitlement acceptance (EPIC-064)

The earlier Company Owner module-control checks remain a current-regression checklist,
not the approved future authority. TASK-188 may replace them only after TASK-185–187
land and the following pass:

- [ ] Platform Superadmin signs in through the separate platform realm, sees all
      authorised Masters/Companies and previews Master, Company and effective module state.
- [ ] Platform Superadmin enables/disables Master entitlement and Company allocation;
      expected-version conflict, CSRF, cross-Master target and audit assertions pass.
- [ ] Company Owner, Company Admin, normal user and stale `admin.modules.manage` grants
      cannot list or mutate entitlement; the tenant MAC screen/onboarding selector is absent.
- [ ] Master OFF + Company allocated denies; Master ON + Company not allocated denies;
      both ON + permission/scope/workflow allowed succeeds. Missing/unknown state denies.
- [ ] Master disable does not overwrite Company allocation, and re-enable restores the
      previous distribution. Migration preserves every Company's effective state.
- [ ] New Company setup receives the platform-defined Master default allocation without
      a tenant choice.
- [ ] Disabled modules are absent from sidebar/mobile/search/quick actions and reject
      direct route, list/detail/create/update/action, notification and worker paths.
- [ ] Platform Superadmin explicitly simulates any active user only inside the selected
      Master/Company. Navigation and writes exactly match that user, platform permissions
      do not widen access, a persistent banner appears, and return/revoke/expiry works.
- [ ] Every simulated write records target `actorUserId` and real
      `platformPrincipalId`; simulated tenant context cannot mutate MAC.
- [ ] Platform password session expires within one hour, cannot be remembered and is
      rate-limited. Absence of MFA remains a recorded release risk rather than a pass.

This section is planned acceptance, not evidence. The current 4-file/15-test focused
suite proves only the pre-cutover Company module/platform support behavior.
