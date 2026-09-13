# TASK-237 remote CI screen-audit failure — 2026-09-13

## Scope

- **Task:** TASK-237 / G10.4 release regression gate.
- **Environment:** GitHub Actions pull-request workflow, candidate revision `30bc2d8fa4d32dc201a366ae4fc2f84ec70c0cb5`.
- **Run:** [GitHub Actions run 34743412098](https://github.com/yapweijun1996/ERP-System/actions/runs/34743412098).
- **Job:** `Typecheck, transaction proof, and demo build` (`103688435983`).
- **Expected result:** All configured source, database, Demo and browser audits pass.

## Observed result

The run failed only at `Screen audit (every SCREENS route, zero errors + no leftover prototype data on canonical screens)`. The preceding four Vitest shards, lint, Markdown links, generated i18n, root/web typechecks, Receipt Pilot deterministic and broken-fixture gates, rollout/disable probe, generated schema, drift, permissions, PostgreSQL security and transaction proofs, Demo build, i18n matrix and browser smoke all passed. The screen audit rendered all 130 routes at desktop and mobile without console/page errors and found no identity leaks, then reported one layout failure:

```
LAYOUT [desktop:user-mgmt] transaction-list-v1 root missing
```

The `user-mgmt` screen performs two Demo adapter reads before calling the shared `transactionListPage()` renderer. A fixed 200 ms settle window allowed the audit to inspect the loading shell before that root existed. This was a test-observation race, not an application render error.

## Repair and verification

`scripts/audit-screens.mjs` now waits up to the existing bounded recovery timeout for the declared shared-list marker on every `transaction-list-v1`, `master-detail-register-v1` and `report-list-v1` route. A local desktop list-layout audit then passed all 50 shared-list routes at desktop and mobile with zero errors or layout failures. The remote CI run is retained as a real failed-candidate observation; a subsequent CI run is required to verify the repair on the pushed revision.

No secrets or receipt payloads were recorded.
