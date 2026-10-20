# HR/Admin MVP progress

Reviewed: 2026-09-29. Scope and completion criteria are the active user goal.
This is the focused MVP work log; the root `PROGRESS.md` remains the wider ERP
project snapshot.

| Area | Current evidence | State / next action |
| --- | --- | --- |
| Shell and responsive UI | Company profile, Staff, Leave, My Receipts and Company Receipts built-Demo browser journeys passed at desktop and 375/390 px; dated screenshots are linked from `docs/evidence/TASK-252-company-profile.md`, `docs/evidence/TASK-253-staff-directory.md`, `docs/evidence/TASK-254-leave-lifecycle.md` and `docs/evidence/TASK-255-receipts.md` | Scoped local review complete; full ERP route coverage and production UAT remain separate. |
| Company information | `src/modules/admin/companyProfile.ts`, API/Demo adapters and `tests/e2e/company-profile.spec.mjs`; persisted readback and desktop/375px screenshots in `docs/evidence/` | Implemented locally; production deployment/UAT remains separate. |
| Staff listing | `src/modules/hr/employee.ts`, combined directory filters, saved phone edit and accountless employment end; 59→58 persisted browser readback and API/domain guards in `docs/evidence/TASK-253-staff-directory.md` | Implemented locally for listing, edit, status/job-title/department/search and accountless employment end; account-bearing offboarding stays on its existing path. Production UAT remains separate. |
| Leave application | Governed aggregate, balance ledger and approval routes; `tests/e2e/leave-overlap-mvp.spec.mjs` verifies employee submission, overlap error, HR approval, paid leave settlement and employee history; domain/API/calendar regression passed | Implemented locally for the focused lifecycle; production workflow UAT and external calendar delivery remain separate. |
| Receipts | Company Receipt register/Pack and My Receipts upload; 26 domain/API tests, built Demo year plus category-keyword Pack/PDF/Print, clean-evidence confirmation and 375px upload persistence with fully labelled mobile receipt cards in `docs/evidence/TASK-255-receipts.md` | Implemented locally when evidence is scan-clean. Normal Demo uploads persist as Quarantined while the scanner is unavailable; Company confirmation correctly waits for a clean scan. Production scanner/OCR/UAT remain separate. |

Current task: Scoped local MVP verification complete; production validation is tracked separately.
No production environment or production database is in scope.
