# TASK-234 — Governed HEIC original inspection and download

Date: 2026-09-13, Asia/Singapore. This record covers a local Demo/browser
increment for the contextual Receipt Assistant workspace. It does not claim a
production provider, deployment, human acceptance or physical-device result.

## Identity and selected gap

- **Task:** TASK-234, G07 contextual ERP workspace; related TASK-202 original-evidence semantics.
- **Expected result:** after the assistant cites a HEIC/HEIF receipt, the normal
  tenant/version/hash checks succeed, the browser does not pretend to decode the
  file as an image, and the user receives a governed-original explanation plus a
  download that preserves the original file name.
- **Actor and environment:** Codex on local macOS, `main`, static Demo/Vite
  preview with Playwright Chromium and isolated PGlite/API fixtures.
- **Authorization boundary:** the user-authorized Demo endpoint and Codex OCR/
  receipt/PDF review only. No provider key, production database, external write,
  Pages publication or human business acceptance was used.

## Implementation

Commit `335aa9c172a12f54f8a321f5c5d0cc36286832ae` (`Support governed HEIC
evidence downloads`) updates `web/public/assets/screens-company-receipts.js`:

1. The assistant evidence reader accepts `image/heic` and `image/heif` after
   matching the returned receipt version, document identity, version number and
   SHA-256, with the existing 20 MB bound.
2. PDF, PNG, JPEG and WebP continue to use their existing inline preview.
   HEIC/HEIF uses a download-only callout, so an unsupported browser cannot show a
   false image preview.
3. Object URLs and the preserved original file name are cleared/revoked on a new
   inspection, a new assistant run and modal close.
4. English, Malay, Simplified Chinese, Japanese and Vietnamese resources carry
   the new explanation and download labels.

No receipt/Pack command, approval state, document access permission, tenant
derivation, stored source bytes or PDF renderer rule changed.

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| `npm run build:demo && node tests/e2e/company-receipts.spec.mjs` | Build and Company Receipts browser contract pass | Exit 0; HEIC scenario confirms one download link, zero image tags, the governed-original explanation and `receipt.heic` filename; existing title, Pack/PDF/Print, pagination and responsive checks also pass |
| `npm run test:e2e:receipt-assistant` | Existing assistant workspace remains compatible | Exit 0; desktop/mobile, cancellation/recovery, scope guard, five locales, two themes, focus and overflow checks pass |
| `npm test -- --run src/api/companyReceipts.integration.test.ts src/modules/expenses/companyReceiptPackPdf.test.ts src/modules/documents/upload.test.ts --reporter=dot` | Server Pack, PDF and upload contracts remain compatible | 3 files / 20 tests passed |
| `npm run lint` | JavaScript and TypeScript lint is clean | Exit 0 |
| `npm run typecheck` and Demo build typecheck | Backend and Web types remain valid | Exit 0 |
| `npm run demo` | PGlite Demo parity smoke remains green | Exit 0; all Demo checks passed; no PostgreSQL URL was supplied |
| `I18N_ROUTES=company-receipts I18N_ROUTE_TIMEOUT_MS=8000 I18N_PAGE_BOOT_TIMEOUT_MS=15000 I18N_BOOT_TIMEOUT_MS=20000 npm run audit:i18n` | Changed route has no locale or mobile overflow regressions | Exit 0; 1 route × 5 languages × desktop/375px mobile; all matrix cases passed |
| `npm run docs:check` | Repository Markdown links remain valid | Pass: 95 Markdown files / 820 local links |
| Root Markdown/link/fragment review | GOAL, PROGRESS and GOAL_PROMPT links/fragments resolve | Pass: 3 files / 187 local links / 0 missing |
| `git diff --check` | Evidence and source have no whitespace errors | Pass |
| KB add/read-back | Evidence is persisted in `erp-system-project-logic` | Item `d7669d54-475b-40c9-8020-fee2518a9d61` committed and read back with revision, source path and production/provider flags |

The browser fixture computes the HEIC content hash in the page, returns it from
the adapter, and exercises the same detail/content sequence used by the real
adapter. The fixture never grants approval or creates a Pack; this verifies the
inspection boundary independently of the governed execution path.

## Acceptance delta and remaining gap

This closes the local HEIC inspection/download usability gap for G07.2/G07.4 and
strengthens TASK-202's explicit unsupported-original behavior. Counts remain
unchanged: no task, GOAL criterion or execution checkpoint is promoted by a
local fixture result. The remaining TASK-234 gates are release-owner publication
and hosted no-override verification, an approved real provider/account/data
policy, and the separate production/business-owner acceptance. TASK-202 still
requires readable SG/MY source records and a Finance/QA visual Print verdict.

## Handoff

- **Source revision:** `335aa9c172a12f54f8a321f5c5d0cc36286832ae`.
- **Verification scope:** local-source-demo-browser; no production or real-provider claim.
- **Next measurable action:** release owner publishes this exact candidate and
  repeats the hosted upload/evidence inspection without a screen override; then
  the named Finance/QA reviewer records a production rendered/downloaded Pack
  verdict for readable SG/MY sources.
