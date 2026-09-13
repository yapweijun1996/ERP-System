# TASK-234 fresh candidate CI terminal failure — 2026-09-13

## Evidence identity

- **Observed:** 2026-09-13, GitHub-hosted CI; timestamps below are UTC.
- **Workflow:** [GitHub Actions run 34755628672](https://github.com/yapweijun1996/ERP-System/actions/runs/34755628672)
- **Revision under test:** `a6b2bb7d836d5bd2dfc3914637b80400e97f8c6d`
- **Environment:** hosted `ubuntu-latest`, Node 22, PostgreSQL 16 service, built Demo/PGlite bundle, Playwright Chromium.
- **Actor class:** GitHub Actions CI runner; no business actor or provider account was used.
- **Local worktree boundary:** the run checked out the pushed `main` revision; the later audit retry repair was not part of this run.
- **Safety:** no secrets, provider credentials, production writes, network interception, source override or fixture mutation outside the documented in-memory Demo entitlement fixture.

## Expected result

The validate job should complete all source/generated, database, Demo, i18n, browser, screen, layout, production public-subpath and cleanup gates. The Screen audit should render all 130 registered routes at desktop and mobile and satisfy the declared shared-list layout contract.

## Actual result

All four Vitest shards, source/generated checks, database and Demo gates, the i18n browser matrix/report upload, and desktop/mobile Browser smoke completed successfully. The Screen audit reported all 130 routes rendered without console/page errors, no Northwind/Dana identity leaks, and passed route-maturity and shared-shell checks. Its sole failure was:

```text
LAYOUT [desktop:user-mgmt] transaction-list-v1 root missing
```

The validate job completed with failure at `2026-09-13T13:03:49Z` (21:03:49 Asia/Singapore). Transaction-list, operational-workspace, production public-subpath and cleanup steps were skipped. This keeps hosted CI regression safety open for the candidate revision; it does not establish or close TASK-234 G07.3, real-provider/OCR, production, or human Finance/QA acceptance.

## Repair boundary and local verification

The failure repeats the `desktop:user-mgmt` cold Demo render class seen in [the earlier merged-run evidence](TASK-234-2026-09-13-merged-ci-failure.md). The audit had already waited 30 seconds for a shared-list root, but a transient first navigation/render error can leave the loading/error shell without the list root; waiting alone cannot recover that state. The follow-up repair adds one bounded route re-navigation when the declared list root is still absent, then retains the existing layout assertions and visible failure if the root remains absent.

After the repair, local built-Demo verification passed:

- `AUDIT_VIEWPORT=desktop LIST_LAYOUT_ONLY=1 npm run audit:screens`: 50/50 shared-list routes.
- `npm run audit:screens`: 130/130 routes at desktop and mobile, zero console/page errors, zero identity leaks, all layout and shell contracts passed.
- `npm run lint`: passed.

The repair requires a new hosted CI terminal run before the remote regression-safety gate can be considered closed.

## Acceptance boundary

- **Evidence class:** remote CI terminal failure plus local bounded retry repair.
- **Expected/actual:** recorded above with exact revision, environment, actor class and failure output.
- **Counts:** task, goal-criterion, checkpoint and capability counts unchanged.
- **Next measurable action:** commit and publish the retry repair, then record the next hosted CI terminal result without overrides.
