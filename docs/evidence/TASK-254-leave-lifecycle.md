# TASK-254 Leave lifecycle local verification

Date: 2026-09-29. Target: local built Demo/PGlite and local API test server.
The browser used the fictional seeded employee and HR operator. No production
employee, leave balance or database was changed.

## Finding and correction

Two same-day governed leave drafts could both be submitted as Pending. The
submit command reserved available days but did not check an employee's other
pending or approved dates. `src/modules/hr/leaveApplication.test.ts` reproduced
the defect before the fix.

The shared command now locks the employee, rejects overlapping pending/approved
dates with `leave_dates_overlap` (409), and permits an AM plus PM half day on
one date. Final approval checks approved overlaps again, including legacy
records. Rejected attempts retain the original Draft or Pending state and do
not create a second reservation or decision.

## Real browser result

`tests/e2e/leave-overlap-mvp.spec.mjs` used the real Demo adapter and PGlite.
The employee created and submitted the first one-day request, then created a
second request for the same date. Submission displayed the overlap error and
the second row remained Draft. The HR operator approved the first request;
PGlite showed Approved and one paid-leave `use` entry. Switching back to the
employee showed the Approved event in the application's history. Desktop and
375 px browser views had zero console/page errors; the mobile dialog remained
inside the viewport and the page had no root horizontal overflow.

[Desktop overlap error](TASK-254-leave-overlap-desktop.png) ·
[375 px dialog](TASK-254-leave-overlap-mobile.png).

## Verification boundary

Five focused Leave domain/API/calendar test files passed 18 tests. Lint,
root/web typechecks, PGlite Demo proof and built Demo passed after the repair.
These checks cover local source and Demo behavior. Production workflow UAT,
hosted release, PostgreSQL concurrency and external calendar delivery are
separate verification gates.
