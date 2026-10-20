# TASK-255 Receipts local verification

Date: 2026-09-29. Target: local built Demo/PGlite and local API test server.
The tests used synthetic images and fictional Company data. No production
receipt, customer document or database was changed.

## Journeys

| Journey | Evidence | Result |
| --- | --- | --- |
| Employee My Receipts | `tests/e2e/staff-account-immediate.spec.mjs` at 375 px | File capture created an offline draft, Sync all persisted the document, and reload retained `Quarantined · scanner unavailable`. The mobile file/state card shows full labelled values without internal or root overflow. No browser errors. |
| Company receipt confirmation | `tests/e2e/company-receipts.spec.mjs` | An actual Demo adapter flow confirmed a synthetic scan-clean evidence fixture; ordinary unclean/quarantined evidence remained ineligible. |
| Register query and yearly Pack | Same built browser test | The current-year preset (`2026-01-01` through `2026-12-31`) and `Travel` category keyword reached the Company-scoped query and immutable Pack request. PDF preview, download and Print routes completed. Desktop and 390 px controls were labelled, touch-sized and free of root overflow. |
| Domain and API | `companyReceipt.test.ts`, `companyReceiptPack.test.ts`, `companyReceiptPackPdf.test.ts`, `companyReceipts.integration.test.ts` | 26 tests passed, including evidence ownership, date/category search, immutable Pack data/PDF and authorization. |

Mobile screenshots: [My Receipts](TASK-255-my-receipts-mobile.png) and
[Company Receipts](TASK-255-company-receipts-mobile.png).

## Operational limit

The default Demo has no active scanner. A newly uploaded My Receipt is stored
but quarantined, so it cannot yet become a confirmed Company Receipt. The
scan-clean fixture tests the downstream confirmation/report path without
weakening the clean-scan requirement. Production scanner/OCR readiness, hosted
release and client UAT require their own evidence.
