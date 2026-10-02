# TASK-253 Staff directory local verification

Date: 2026-09-29. Target: local built Demo/PGlite and local API test server.
The seeded Company has fictional employee records. No production employee or
database was changed.

## Result

The Staff directory combines its existing search and Department chips with
Current/Former employment status and Job title filters. Former staff remain
discoverable. The Headcount KPI counts only current staff while the title badge
reflects the filtered result set. Empty filter results offer a clear action.

HR can end employment for an active employee without a login account. The
shared command requires a reason and current `updatedAt`, rejects account
holders, and reassigns active direct reports to a current employee outside
the reporting subtree. The employee row and Leave history remain; an audit
event records the reason and handoff. Employees with a login account continue
through account offboarding, which revokes sessions and transfers ownership.

The real-browser test `tests/e2e/staff-directory-mvp.spec.mjs` used the built
Demo's 59-person fictional roster. It combined department, job title, status
and search; verified the empty state and clear action; edited a staff phone
number with PGlite readback; rejected a short employment-end reason; ended an
accountless employee; read the PGlite employee and audit rows; then reloaded
and found the same former employee. Headcount became 58. The 375 px page had
no root horizontal overflow and the browser reported zero page/console errors.

## Visual evidence

- Before: [desktop](TASK-253-staff-before-desktop.png), [375 px](TASK-253-staff-before-mobile.png).
- Codex CLI round 1: [rendered visual proposal](../../ui/TASK-253-staff-proposal.png), [SVG](../../ui/TASK-253-staff-proposal.svg), [notes](../../ui/TASK-253-staff-proposal.md). The proposal illustrates an optional mobile filter sheet; the shipped page keeps two visible labelled selects so status and job title are directly discoverable.
- After: [filtered desktop](TASK-253-staff-after-desktop.png), [375 px](TASK-253-staff-after-mobile.png), [empty filter](TASK-253-staff-empty-filter.png).

## Verification boundary

- `src/modules/hr/employeeEnd.test.ts` and
  `src/api/employeeUpdate.integration.test.ts`: 6 tests passed, including
  cross-Company, permission, account-owner, stale and reporting-cycle guards.
- Repository lint, root/web typechecks, PGlite Demo proof, build, generated
  schema/RLS check, documentation links and diff check are recorded in
  `docs/STATUS.md` after the final local run.
- This is local Demo and API-source evidence. A production PostgreSQL migration,
  hosted login/UAT and client offboarding policy review are separate.
