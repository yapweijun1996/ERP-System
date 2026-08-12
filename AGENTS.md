# ERP-System repository instructions

## Main project knowledge base

- Main project KBID: `erp-system-project-logic`
- KB UUID resolved from `kb_list`: `ef47bf4b-83e1-42b2-a412-66912d04ea24`
- Use this KB as the primary cross-session project knowledge base for ERP-System
  architecture, Employee, Leave Application, Staff Calendar, Expense Claim and
  related implementation decisions.
- Before technical work, resolve the KBID with `kb_list` and retrieve the relevant
  entries with `kb_search`. Do not treat a semantic hit as proof when it disagrees
  with the current source or tests.
- `docs/PROJECT_LOGIC.md` is the human-readable source-backed mirror of the domain
  logic. When a domain contract changes, update that file and the relevant KB item
  in the same task.

## Source-of-truth boundaries

1. Current code and tests are the implementation truth.
2. `docs/STATUS.md` is the current built/mock/status truth.
3. `docs/SPEC.md` contains binding cross-cutting invariants.
4. `docs/PROJECT_LOGIC.md` explains the current domain contract and points to
   source symbols.
5. The KB is the main agent context and continuity layer; it must remain concise,
   source-backed and dated.

If these layers disagree, verify the source and tests first, then repair the docs
and KB instead of silently choosing an old summary.

## Repository rules

- `src/` is the canonical core. Keep domain commands in `src/modules/`, schemas in
  `src/data/schema/`, and API authorization/tenant derivation in `src/api/` and
  `src/auth/`.
- Demo/PGlite and production/PostgreSQL share one schema and one business-logic
  contract. Do not create a demo-only domain rule.
- Every business query and write is scoped by `masterFn` and `companyFn` from the
  authenticated session/context; never trust client-supplied tenant identifiers.
- Employee, Leave and Expense Claim mutations use the shared transactional command
  layer, optimistic version checks or idempotency keys where defined, and audit or
  append-only evidence where defined. Do not physically delete governed records.
- `web/public/db/erp-system-schema.sql` and `erp-system-migrations.sql` are
  generated files. Regenerate/check them after schema changes; never hand-edit them.
- The frontend under `web/public/assets/` is vanilla JavaScript with the global
  `SCREENS` registry. Preserve script order and Demo/API adapter parity.
- Do not add secrets, provider keys or credential plaintext to source, docs, KB or
  browser bundles.

## Domain entry points

- Employee master/onboarding/account lifecycle:
  `src/data/schema/hr.ts`, `src/modules/hr/employee.ts`,
  `src/modules/hr/staffOnboarding.ts`, `src/modules/hr/employeeAccount.ts`.
- Governed Leave Application and balance ledger:
  `src/data/schema/hr.ts`, `src/modules/hr/leaveApplication.ts`,
  `src/modules/hr/leaveApproval.ts`, `src/modules/hr/leaveApprovalWorkflow.ts`,
  `src/modules/hr/leaveBalance.ts`.
- Staff Calendar and external sync:
  `src/modules/hr/appointment.ts`, `src/modules/hr/calendarSync.ts`,
  `src/modules/hr/teamCalendar.ts`.
- Employee Expense Claim record:
  `src/data/schema/expenses.ts`, `src/modules/expenses/claims.ts`,
  `src/modules/expenses/controls.ts`, `src/modules/expenses/postings.ts`.
- Implemented `Expenses & Tax` v1 core: Company Receipts reuse the governed
  managed-document upload/scan/OCR/version boundary but are a separate Company-owned
  aggregate under the active `masterFn` + `companyFn`. They do not depend on
  `expense_claim`, reimbursement, GL posting or Tax Treatment. Direct domain/API
  commands do not require an Employee, although the current My Receipts picker UI
  still does. Current entry points are `src/data/schema/expenses.ts`,
  `src/modules/expenses/companyReceipt.ts`,
  `src/modules/expenses/companyReceiptPack.ts`,
  `src/api/routes/companyReceipts.ts` and `web/public/assets/screens-company-receipts.js`.
  Treat the Pack permission-downgrade repair and the missing edit/void/date-correction
  UX in `docs/PROJECT_LOGIC.md` and `docs/ERP_EXCELLENCE_REVIEW.md` as open P0 work.
- Project billing Progress Claim is a separate record:
  `src/modules/project/progressClaim.ts` and `project/progress-claims` API
  resources. Do not conflate it with Employee Expense Claims.
- Localization currently provides effective-dated tenant tax-rate lookup, not complete
  `GstEngine`/`SstEngine` mechanics. Until TASK-204 is complete, preserve the
  `[valid_from, valid_to)` requirement, do not call MY SST posting compliant, and do not
  default Malaysia tax to Singapore-style recoverable Input Tax.

## Documentation and verification

- Read `docs/PROJECT_LOGIC.md` for the domain workflow, then follow its source and
  test references before changing behavior.
- For documentation-only work, at minimum run `git diff --check` and inspect the
  rendered Markdown links. For code changes, follow the full verification gates in
  `CLAUDE.md` and report any gate that was not run.
- Preserve unrelated user changes in the worktree. Do not reset, checkout or
  overwrite files outside the requested documentation/knowledge scope.
