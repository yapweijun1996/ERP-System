# Employee-to-Tax Release Proof

Status: verified 2026-07-26 for TASK-135.

This document is the evidence index for the complete governed chain. It does not
replace executable tests: every row points to the test that owns the underlying
business assertion, while the PostgreSQL security suite composes the expense,
payment, bank-result and tax-package stages under production RLS.

| Chain stage | Executable evidence | Verified outcome |
| --- | --- | --- |
| Employee identity activation | `src/api/employeeAccount.integration.test.ts`, `src/modules/hr/employeeAccount.test.ts` | One-time encrypted credential, activation-required restriction, permanent secret clearing, replay and cross-company denial |
| Governed leave | `src/api/leaveApplication.integration.test.ts`, `src/modules/hr/leaveApplication.test.ts`, `src/modules/hr/leaveApproval.test.ts` | Actor-owned application, multi-step decision, cancellation/revision and immutable balance evidence |
| Payroll effect | `src/api/payrollLeave.integration.test.ts`, `src/modules/payroll/payrollLeave.test.ts` | Leave earning/deduction source is applied once to a run; replay does not duplicate the source or payroll effect |
| Receipt capture and processing | `src/modules/documents/storage.test.ts`, `src/modules/documents/processing.test.ts`, `src/api/postgresSecurity.integration.test.ts` | Immutable versions, fail-closed scan/extraction, owner/manager authorization, content hash and provider/RLS isolation |
| Void and correction | `src/modules/documents/governance.test.ts` | Draft delete is bounded; posted/sealed evidence requires a reasoned reversal or linked correction; retention and legal hold block purge |
| Expense claim and approval | `src/modules/expenses/claims.test.ts`, `src/modules/expenses/controls.test.ts`, `src/api/myWork.integration.test.ts` | Session-derived employee ownership, exact allocations, manager/Finance decisions, duplicate/budget controls and immutable submitted facts |
| Balanced expense posting | `src/modules/expenses/postings.test.ts`, `src/api/postgresSecurity.integration.test.ts` | Final approval and Dr Expense/Input Tax / Cr Employee Payable are one transaction, balanced and replay-safe |
| Encrypted payout profile | `src/modules/expenses/payoutProfiles.test.ts`, `src/api/payoutProfiles.integration.test.ts` | Masked ordinary reads, independently verified AES-256-GCM envelope, audited reveal and update invalidation |
| Maker/checker reimbursement | `src/modules/expenses/reimbursementBatches.test.ts`, `src/api/reimbursementBatches.integration.test.ts` | Only verified open payables enter a batch; preparer/self-release is blocked and release facts are frozen |
| Partial bank outcome | `src/modules/expenses/reimbursementPayments.test.ts`, `src/api/postgresSecurity.integration.test.ts` | Encrypted/audited export; successful lines alone post Dr Employee Payable / Cr Bank; failed lines retry without duplicate settlement |
| Immutable tax report | `src/modules/expenses/taxEvidence.test.ts`, `src/api/postgresSecurity.integration.test.ts` | One immutable snapshot produces six hash-reconciled artifacts; provider failure leaves no partial set and retry produces one version |
| Sealed correction chain | `src/modules/expenses/taxEvidence.test.ts`, `src/api/postgresSecurity.integration.test.ts` | Sealed packs cannot be overwritten; corrections supersede the latest version with a SHA-256 difference manifest |
| Retention and legal hold | `src/modules/expenses/taxEvidence.test.ts`, `src/api/postgresSecurity.integration.test.ts` | SG ≥5 years, MY ≥7 years, longer company policy wins, and a hold on any version blocks the whole chain |

## Acceptance coverage

- Success and replay: activation, leave source, expense approval/posting, report job,
  sealing and legal-hold commands have explicit success/replay assertions.
- Partial failure: document scanning fails closed; report rendering commits zero
  partial artifacts; mixed bank outcomes settle successful lines only and preserve
  failed-line retry.
- Void and correction: document governance requires linked reversal/correction after
  posting or sealing; tax corrections are a non-branching supersession chain with
  line, document and total differences.
- Tenant and privacy denial: actor-owned My Work APIs reject ID tampering, sensitive
  reads are masked or purpose-audited, and the real PostgreSQL 16 non-superuser suite
  proves outside-transaction/cross-tenant rows are invisible under forced RLS.
- Demo/API: PGlite executes the same domain migrations and business commands used by
  Demo; HTTP integration tests exercise the API surfaces. Node-only scan/report
  workers remain explicitly API-mode capabilities rather than being falsely
  simulated by the static Demo adapter.

## Final release gates

The following gates passed on 2026-07-26:

- `npm test`: 129 files passed, 1 expected skip; 506 tests passed, 1 expected skip.
- Real PostgreSQL 16: the non-superuser forced-RLS integration suite passed.
- `npm run demo`: PGlite business transaction proof passed.
- `npm run check:demo-schema`: 73 ordered migrations, schema version 72.
- `npm run check:drift`: all 226 tables match Drizzle and Demo SQL.
- `npm run typecheck`, `npm run typecheck:web`, and `npm run lint`: passed.
- API and Demo production builds: passed.
- Desktop and 375px smoke: passed with zero console/page errors.
- Five-language expense workspace audit: passed for `en`, `ms`, `zh`, `ja`, `vi`
  across desktop and mobile privacy/failure states.
- Full screen audit: 122 Canonical / 0 Preview routes passed at desktop and 375px.
- In-app browser: persistent PGlite upgraded from v71 to v72 with no overflow,
  warning or error.

Direct bank APIs and direct IRAS/LHDN filing remain out of scope. The system produces
governed bank artifacts and tax-support evidence; an authorised human or external
integration performs the actual submission.
