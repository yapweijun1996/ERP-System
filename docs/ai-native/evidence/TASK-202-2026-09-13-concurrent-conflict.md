# TASK-202 — Concurrent conflicting Pack-key facts

Date: 2026-09-13, Asia/Singapore. This record covers a local source and PGlite
fixture regression for the governed Company Receipt Pack command. It does not
claim a production PostgreSQL run, real provider evidence, deployment or a
Finance/QA acceptance verdict.

## Identity and scope

- **Task:** TASK-202, Receipt Pack lifecycle, export and production acceptance.
- **Selected gap:** the API already rejected a changed selection on a sequential
  retry, and the preceding domain test covered concurrent identical facts. A
  direct concurrent differing-facts assertion was still missing.
- **Expected result:** two same-scope requests with the same `packKey` but
  different date selections produce exactly one immutable Pack and one
  deterministic `company_receipt_pack_key_conflict` error with HTTP status 409.
  No second Pack row may be written.
- **Actor / environment:** Codex on local macOS, `main` at
  `52720f70f5d941ddc31e7722a8637086c1fbe209`, PGlite fixtures and freshly built
  Demo/API bundles. No production database, provider, deployment, alert sink or
  secret was used. The worktree had 37 dirty paths and no unmerged paths at
  capture; unrelated changes remain preserved.

## Implementation and observed result

The only source change is a second focused test in
`src/modules/expenses/companyReceiptPack.test.ts`. It creates two clean receipts
on different dates, launches two `createCompanyReceiptPackWithin` calls through
`withTenantTransaction` and `Promise.allSettled` using one `packKey`, then asserts
one fulfilled create, one rejected 409 conflict and one scoped Pack row. The
production composite uniqueness and fact-matched replay logic is unchanged.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npx vitest run src/modules/expenses/companyReceiptPack.test.ts --reporter=dot` | Pack domain regression passes | 1 file / 6 tests passed |
| `npx vitest run src/api/companyReceipts.integration.test.ts --reporter=dot` | Existing authenticated replay and changed-fact 409 contract remains covered | 1 file / 8 tests passed in the preceding unchanged-API verification |
| `npm run test:e2e:company-receipts-api` | Authenticated Company Receipts API flow remains usable at desktop/mobile bounds | PASS: confirmation, refresh/search/range, Preview/PDF/Print and responsive bounds |
| `env -u POSTGRES_URL npm run demo` | Demo transaction, approval and receipt/Pack proof passes | PASS; no `POSTGRES_URL`, so PostgreSQL parity was not exercised |
| `npm run build:demo` | Static Demo bundle builds | PASS; existing Vite warnings only |
| `npm run lint` | Zero lint errors and warnings | PASS |
| `npm run typecheck` and `npm run typecheck:web` | Type checks pass | Both PASS |
| `env -u POSTGRES_URL npm run test:postgres -- --reporter=dot` | PostgreSQL target availability is explicit | 4 files / 4 tests skipped because `POSTGRES_URL` is absent |
| GOAL count validator | Registry/dependency/criteria/checkpoint invariants remain valid | 227 done / 6 in progress / 4 todo / 3 blocked; 240 total; 31/48 criteria; 43/60 checkpoints; no dependency-ready Todo |
| `npm run docs:check` | Repository Markdown links remain valid | PASS: 109 Markdown files / 841 local links |
| Root `GOAL.md` / `PROGRESS.md` / `GOAL_PROMPT.md` review | Root links and fragments resolve | PASS: 3 files / 206 local links / 0 missing |
| `git diff --check`, `git diff --cached --check` and conflict-marker scan | Final workspace has no whitespace or merge-marker errors | PASS |

## Acceptance boundary and handoff

This increment closes the local direct-regression gap for concurrent differing
Pack facts. It does not change task, GOAL criterion, execution checkpoint or
capability counts. PostgreSQL true-concurrency evidence, production readable
SG/MY sources, real provider evidence, deployment identity and Finance/QA human
Print acceptance remain open and separately classified.

The unblock action is for the release or CI owner to provide an approved
disposable PostgreSQL target or CI run, execute the two concurrent cases against
that target, and record the revision/database result without retaining
credentials.
