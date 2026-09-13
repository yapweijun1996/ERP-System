# TASK-234 merged CI terminal failure — 2026-09-13

## Evidence identity

- **Observed:** 2026-09-13, GitHub-hosted CI; timestamps below are UTC.
- **Workflow:** [GitHub Actions run 34751368911](https://github.com/yapweijun1996/ERP-System/actions/runs/34751368911)
- **Revision under test:** `a67595d5b67d24d6dfcc02b0c04f89c0e6c391ae` (merged PR #3)
- **Environment:** hosted `ubuntu-latest`, Node 22, PostgreSQL 16 service, built Demo/PGlite bundle, Playwright Chromium.
- **Actor class:** GitHub Actions CI runner; no business actor or provider account was used.
- **Local worktree boundary:** the root worktree was already dirty with unrelated documentation/evidence/task files; CI checked out the merged revision and did not include those local changes.
- **Safety:** no secrets, provider credentials, production writes, network interception, source override or fixture mutation outside the documented in-memory Demo entitlement fixture.

## Expected result

The validate job should complete all source/generated, database, Demo, i18n, browser, screen, layout, production public-subpath and cleanup gates. The Screen audit should render all 130 registered routes at desktop and mobile and satisfy the declared shared-list layout contract.

## Actual result

All four Vitest shards, source/generated checks, database and Demo gates, the i18n browser matrix/report upload, and desktop/mobile Browser smoke completed successfully. The Screen audit also reported 130 routes rendered without console/page errors, no Northwind/Dana identity leaks, and passed route-maturity and shared-shell checks. Its sole failure was:

```text
LAYOUT [desktop:user-mgmt] transaction-list-v1 root missing
```

The Screen audit exited 1 at `2026-09-13T11:23:11.956Z` (19:23:11 Asia/Singapore). The subsequent transaction-list, operational-workspace, production public-subpath and cleanup steps were skipped by the job. This is a remote CI regression-safety failure for the merged revision; it does not establish or close TASK-234 G07.3, real-provider/OCR, production, or human Finance/QA acceptance.

## Reproduction and repair boundary

The local built-Demo audit reproduced the route eventually rendering after the shared list data reads resolved. The audit's previous 10-second recovery budget was too short for a cold, resource-contended hosted runner after the preceding browser suites. The smallest repair in candidate revision `c18378dc74fb6bc63099bfc0651b39fa56ae354f` raises the bounded `RECOVERY_TIMEOUT_MS` in `scripts/audit-screens.mjs` to 30 seconds; timeout still remains a visible failure and no layout assertion is removed. Local desktop shared-list (50/50), default desktop+mobile shared-list (50/50), and full desktop+mobile screen audits (130/130) passed after the repair.

A fresh candidate CI terminal run is still required before this remote regression-safety gate can be considered closed for the repaired revision. The prior successful run `34730030719` for `d936a348` remains historical evidence for that separate revision.

## Acceptance boundary

- **Evidence class:** remote CI terminal failure plus local repair verification.
- **Expected/actual:** recorded above with exact revision, environment, actor class and failure output.
- **Counts:** task, goal-criterion, checkpoint and capability counts unchanged.
- **Next measurable action:** publish the repaired candidate branch, start a fresh candidate CI run, and record its terminal result before updating regression-safety status.
