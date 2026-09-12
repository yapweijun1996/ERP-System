# TASK-202 — Receipt Pack print artifact contract

Date: 2026-09-13, Asia/Singapore. This record covers a local source/API and
PGlite-fixture increment for TASK-202. It does not claim a production readable
receipt, a real provider, a deployment, or Finance/QA human Print acceptance.

## Identity and scope

- **Task:** TASK-202, Receipt Pack lifecycle, export and production acceptance.
- **Selected gap:** the governed Pack PDF route had download coverage, but its
  `action=print` response and audit contract were not directly asserted in the
  current Company Receipts API regression.
- **Expected result:** an authenticated Print request for a frozen Company Pack
  returns the same governed PDF bytes as export with `inline` disposition,
  `private, no-store` caching, bounded artifact/source hashes and the export
  access purpose; the audit row records `pdf_print` under the session-derived
  Master/Company scope.
- **Actor / environment:** Codex on local macOS, root `main`, isolated PGlite
  API fixtures and a fresh static Demo build; no production database, provider,
  deployment, external alert or secret was used.
- **Baseline:** unrelated tracked and untracked worktree changes remain
  preserved. Before the focused commit the index was empty and there were no
  unmerged paths.

## Implementation and observed result

Commit `179961be6f974b096a9d0ccf9b225b143e8f8239` (`Cover Receipt Pack print
artifact contract`) contains exactly one test addition:

- `src/api/companyReceipts.integration.test.ts` creates a scoped Pack, calls
  `GET /api/company-receipts/packs/:packId/pdf?action=print`, checks HTTP 200,
  PDF content, inline disposition, private caching, artifact/source SHA-256
  headers, the export access purpose and a `%PDF` stream prefix, then verifies
  the matching `pdf_print` audit payload.

The existing route and domain commands remain the source of truth. The test
reads only the first response chunk and cancels the reader, so it does not retain
the large fixture body. No Pack lifecycle, approval, scan, tenant or generated
schema rule changed.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npm test -- --run src/api/companyReceipts.integration.test.ts --reporter=dot` | Candidate API regression passes | 1 file / 8 tests passed before commit |
| `npm test -- --run src/api/companyReceipts.integration.test.ts src/modules/expenses/companyReceipt.test.ts src/modules/expenses/companyReceiptPack.test.ts src/modules/expenses/companyReceiptPackPdf.test.ts --reporter=dot` | Pack, PDF, domain and API behavior remain compatible | 4 files / 23 tests passed after commit |
| `npm run lint` | No lint errors or warnings | Exit 0 |
| `npm run typecheck` and `npm run typecheck:web` | Type checks pass | Both exit 0 |
| `npm run demo` | Demo/PGlite transaction, approval, stock and GL proof passes | Exit 0; no `POSTGRES_URL` configured, so PostgreSQL parity was not exercised |
| `npm run build:demo` | Static Demo bundle builds | Exit 0; existing Vite external/eval and chunk-size warnings only |
| `node tests/e2e/company-receipts.spec.mjs` | Company Receipts browser contract, PDF controls and responsive facts pass | PASS after fresh Demo build; no browser console/page errors reported |
| `npm run docs:check` | Documentation links pass before this record | 90 Markdown files / 813 local links |
| `git diff --check` and `git diff --cached --check` | No whitespace errors | Exit 0 |

The browser E2E is Demo/fixture evidence. It exercises the visible PDF and Print
controls but does not replace the inherited requirement for a reviewable
production artifact and Finance/QA visual verdict.

## Acceptance boundary

This increment directly closes the local API contract gap for Print response
headers, artifact identity and audit attribution. TASK-202 remains
**In Progress**. The remaining acceptance requires:

1. **Release owner:** publish and identify the authorized production revision
   containing the current Pack route, with the exact deployed revision recorded.
2. **Business owner / Finance and QA:** use readable SG/MY receipts, inspect the
   selected contents and rendered/downloaded PDF, and record a human Print
   verdict in the released environment.
3. **OCR/provider and release operators:** record any real scan/provider and
   production storage evidence separately; the current production stack's
   synthetic or manually-clean fixture is not real-provider proof.

The unblock action is to provide the approved release revision and readable
source records, then have the named Finance/QA reviewer inspect the resulting
PDF/Print flow and record the verdict. No task, GOAL criterion or execution
checkpoint count changes from this local contract evidence.

## Current handoff

- **Source revision:** `179961be6f974b096a9d0ccf9b225b143e8f8239` on `main`.
- **Repository state at evidence creation:** 32 dirty paths remain, no
  unmerged paths exist, and the index is empty. Existing documentation,
  registry, evidence, receipt and test changes were not included in this focused
  commit.
- **Branch relation:** `main` was 24 commits ahead of `origin/main`; no push was
  attempted.
- **Evidence classification:** local source and PGlite API/fixture checks pass;
  Demo build and browser checks pass; no PostgreSQL target, production readable
  source, real provider, deployment or human Print verdict was used.
- **Next measurable action:** release owner publishes the exact Pack revision,
  then Finance/QA records readable-source selection and a rendered/downloaded
  production PDF/Print verdict with revision and artifact hashes.
