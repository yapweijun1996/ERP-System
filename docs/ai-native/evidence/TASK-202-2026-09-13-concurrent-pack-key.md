# TASK-202 — Concurrent Company Receipt Pack key convergence

Date: 2026-09-13, Asia/Singapore. This record covers a local source and PGlite
fixture regression for the governed Company Receipt Pack command. It does not
claim a production PostgreSQL run, a real provider, a deployment, or a Finance
and QA acceptance verdict.

## Identity and scope

- **Task:** TASK-202, Receipt Pack lifecycle, export and production acceptance.
- **Selected acceptance gap:** the Pack command already used a scoped composite
  uniqueness boundary and conflict replay, but the domain regression did not
  exercise two concurrent identical `packKey` calls directly.
- **Expected result:** two same-scope calls with identical facts converge on one
  immutable Pack snapshot; exactly one call creates it and the other replays it.
  The replay must return the same source hash, rows and totals, and the scoped
  database must contain one Pack row. A changed fact for the same key remains a
  deterministic conflict in the existing API regression.
- **Actor / environment:** Codex on local macOS, `main` at
  `52720f70f5d941ddc31e7722a8637086c1fbe209`, PGlite fixtures and the local
  Demo build. No production database, provider, deployment, alert sink or
  secret was used. The worktree had 36 dirty paths and no unmerged paths at
  capture; those unrelated changes remain preserved.

## Implementation and observed result

The only source change is a focused test in
`src/modules/expenses/companyReceiptPack.test.ts`:

- create one clean, scoped SGD receipt;
- launch two `withTenantTransaction` calls through `Promise.all` with the same
  `packKey`, date range and locale;
- assert one `replayed: false` result and one `replayed: true` result;
- assert matching row facts, totals and `sourceSha256`; and
- assert one Pack row under the expected Master and Company scope.

The production command remains the source of truth: the composite
`masterFn + companyFn + packKey` uniqueness constraint, `onConflictDoNothing`
insert and fact-matched replay path are unchanged.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npx vitest run src/modules/expenses/companyReceiptPack.test.ts --reporter=dot` | Pack domain regression passes | 1 file / 5 tests passed |
| `npx vitest run src/api/companyReceipts.integration.test.ts --reporter=dot` | Authenticated API replay and conflict behavior stays compatible | 1 file / 8 tests passed |
| `npm run test:e2e:company-receipts-api` | Built API Company Receipts flow remains usable at desktop/mobile bounds | PASS: authenticated confirmation, refresh/search/range, Preview/PDF/Print and responsive bounds |
| `env -u POSTGRES_URL npm run demo` | Demo transaction, approval and receipt/Pack proof passes | PASS; command reports no `POSTGRES_URL`, so PostgreSQL parity was not exercised |
| `npm run build:demo` | Static Demo bundle builds | PASS; existing Vite warnings only |
| `npm run lint` | Zero lint errors and warnings | PASS |
| `npm run typecheck` and `npm run typecheck:web` | Type checks pass | Both PASS |
| `env -u POSTGRES_URL npm run test:postgres -- --reporter=dot` | PostgreSQL suite is explicit about target availability | 4 files / 4 tests skipped because `POSTGRES_URL` is absent; no PostgreSQL claim is made |
| `npm run docs:check` | Repository Markdown links remain valid | PASS: 108 Markdown files / 839 local links |
| Root `GOAL.md` / `PROGRESS.md` / `GOAL_PROMPT.md` review | Root links and fragments resolve | PASS: 3 files / 204 local links / 0 missing |
| `git diff --check`, `git diff --cached --check` and conflict-marker scan | Final workspace has no whitespace or merge-marker errors | PASS |

## Acceptance boundary and handoff

This increment closes the local direct-regression evidence gap for identical
Pack-key convergence. It does not change task, GOAL criterion, execution
checkpoint or capability counts. PostgreSQL true-concurrency evidence,
production readable SG/MY sources, real provider evidence, deployment identity
and Finance/QA human Print acceptance remain open and separately classified.

The unblock action for the remaining concurrency boundary is for the release or
CI owner to provide an approved disposable PostgreSQL target (or a CI run that
exposes it), then run this focused regression against that target and record the
revision and database evidence without retaining credentials.
