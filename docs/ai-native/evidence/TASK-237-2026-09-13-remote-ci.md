# TASK-237 remote CI regression evidence — 2026-09-13

## Scope

- **Task:** TASK-237 / G10.4 release regression gate.
- **Environment:** GitHub Actions, pull-request workflow, disposable PostgreSQL 16 and cached Playwright Chromium.
- **Branch:** `codex/receipt-pilot-release-20260913`.
- **Revision:** `a4216346cb550ae4d4885867f206c9dd21658041`.
- **Actor:** Codex service account running the repository workflow.
- **Run:** [GitHub Actions run 34740634873](https://github.com/yapweijun1996/ERP-System/actions/runs/34740634873).
- **Expected result:** The current candidate must pass the evaluator, fail-closed broken-fixture and rollout/disable probes, then pass the repository, database, Demo build, i18n and browser regression gates.

## Observed result

Run `34740634873` completed with conclusion `success` on the candidate revision. All four Vitest shards passed. The combined validation job also passed lint, Markdown links, generated business-i18n, root and web typechecks, deterministic Receipt Pilot evaluation, broken-fixture fail-closed behavior, rollout and emergency-disable probe, generated PGlite/schema-drift/permission checks, PostgreSQL non-superuser security lifecycle proof, PGlite/PostgreSQL transaction and concurrency proof, Demo build, five-language desktop/mobile i18n matrix, browser smoke, full screen audit, transaction-list layout audit, operational-workspace layout audit, production public-subpath contract and cleanup.

The rollout probe rejected a deliberately broken candidate without replacing the active version, accepted a valid candidate, and blocked subsequent rollout after emergency disable. This proves the candidate's CI regression and local release-control behavior for this revision. It does not prove a production rollout, retention window, real provider/OCR execution, approved spend, or human Pack/Print acceptance.

No secrets, provider credentials or raw receipt payloads were recorded. The Demo evaluation report remains a local mode `0600` temporary artifact and is not committed.

## Reproduction

```bash
gh run view 34740634873 --repo yapweijun1996/ERP-System --json status,conclusion,headSha
```

The command returned `status=completed`, `conclusion=success`, and the expected head SHA above. This record is remote-CI evidence and remains distinct from local fixture, Demo, real-provider and production evidence.
