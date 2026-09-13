# TASK-202 — Authenticated API concurrent conflicting Pack facts

Date: 2026-09-13, Asia/Singapore. This record covers a local source and PGlite
API-integration regression. It does not claim a production PostgreSQL run, real
provider evidence, deployment or a Finance/QA acceptance verdict.

## Identity and scope

- **Task:** TASK-202, Harden Receipt Pack lifecycle concurrency and internationalization.
- **Selected gap:** the domain command test already covered concurrent differing
  facts, while the authenticated Company Receipts API file only covered
  sequential replay and changed-selection conflict. The HTTP boundary therefore
  lacked a direct concurrent conflict assertion.
- **Expected result:** two authenticated same-scope POST requests with one
  `packKey` and different date selections return exactly one `201` response and
  one `409 company_receipt_pack_key_conflict`; the scoped database contains one
  Pack row.
- **Actor / environment:** Codex on local macOS, `main` at
  `52720f70f5d941ddc31e7722a8637086c1fbe209`, fresh PGlite API fixtures and
  freshly built Demo/API bundles. No production database, provider, deployment,
  alert sink or secret was used. The worktree had 39 dirty paths and no
  unmerged paths at capture; unrelated changes remain preserved.

## Implementation and observed result

The only source change for this increment is one test in
`src/api/companyReceipts.integration.test.ts`. It uploads and confirms two
same-company receipts on different dates, logs in as the Company-authorized
admin, launches two POST requests concurrently with distinct request IDs, and
asserts one `201`, one mapped `409` conflict and one Pack row scoped by
`masterFn` + `companyFn` + `packKey`. The route still derives tenant scope from
the signed-in session and delegates immutable uniqueness/replay to the shared
command layer.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npx vitest run src/api/companyReceipts.integration.test.ts --reporter=dot` | Authenticated API regression passes | 1 file / 9 tests passed |
| `npx vitest run src/modules/expenses/companyReceiptPack.test.ts --reporter=dot` | Domain identical and differing-fact races remain green | 1 file / 6 tests passed in the preceding focused run |
| `npm run test:e2e:company-receipts-api` | Company Receipts API flow remains usable at desktop/mobile bounds | PASS: confirmation, refresh/search/range, Preview/PDF/Print and responsive bounds |
| `env -u POSTGRES_URL npm run demo` | Demo transaction, approval and receipt/Pack proof passes | PASS; PostgreSQL parity was not exercised |
| `npm run build:demo` | Static Demo bundle builds | PASS; existing Vite warnings only |
| `npm run lint` | Zero lint errors and warnings | PASS |
| `npm run typecheck` and `npm run typecheck:web` | Type checks pass | Both PASS |
| `env -u POSTGRES_URL npm run test:postgres -- --reporter=dot` | PostgreSQL target availability is explicit | 4 files / 4 tests skipped because `POSTGRES_URL` is absent |
| GOAL count validator | Registry/dependency/criteria/checkpoint invariants remain valid | 227 done / 6 in progress / 4 todo / 3 blocked; 240 total; 31/48 criteria; 43/60 checkpoints; no dependency-ready Todo |
| `npm run docs:check` | Repository Markdown links remain valid | PASS: 110 Markdown files / 843 local links |
| Root `GOAL.md` / `PROGRESS.md` / `GOAL_PROMPT.md` review | Root links and fragments resolve | PASS: 3 files / 209 local links / 0 missing |
| `git diff --check`, `git diff --cached --check` and conflict-marker scan | Final workspace has no whitespace or merge-marker errors | PASS |

## Acceptance boundary and handoff

This increment closes the local authenticated API regression gap for concurrent
differing Pack facts. It does not change task, GOAL criterion, execution
checkpoint or capability counts. PostgreSQL true-concurrency evidence,
production readable SG/MY sources, real provider evidence, deployment identity
and Finance/QA human Print acceptance remain open and separately classified.

The unblock action is for the release or CI owner to provide an approved
disposable PostgreSQL target or CI run, execute both domain and API concurrent
cases against that target, and record the revision/database result without
retaining credentials.
