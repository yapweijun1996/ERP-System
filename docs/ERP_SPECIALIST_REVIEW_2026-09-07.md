# ERP Specialist End-to-End Review — 2026-09-07

Follow-up registration: F01–F08 map respectively to TASK-216–223. TASK-215 reconciles
the full documentation set and [module coverage matrix](TEST_COVERAGE.md); it does
not repair these runtime findings or change the original audit results.

Task: TASK-214. Source baseline: `243af56`. Scope: local built Demo, current
source/documentation, and official SG/MY market references. This review does not
certify production readiness or fix runtime defects. Product direction is recorded
in [ERP_QUALITY_BASELINE.md](ERP_QUALITY_BASELINE.md).

Follow-up status: TASK-216 through TASK-220 are now complete on the subsequent local worktree.
The compact
seed and showcase pack v16 carry governed SG/MY tax snapshots, the untouched historical
SG approval row has an idempotent upgrade repair, and fresh/upgraded shared-command
proof completes exactly one balanced supplier invoice. The original F01 reproduction
below remains the historical audit observation; production tax-owner approval and
deployment evidence remain separate.

TASK-217 fixes the historical F02 date-only arithmetic defect: shared
`addCalendarDays` now owns sales invoice term calculation, focused SG/MY-relevant
month/year and leap-day tests pass, and the built Demo `#sales-invoices` route rendered
without console errors. TASK-218 now owns the same route's presentation facts: the
selected fiscal period is inclusive on `invoiceDate`, overdue is based on outstanding
balance and the active business date, and raw posting status is preserved separately
from display aging. Mixed-fixture tests and a built-Demo KPI/filter/browser check pass.
The original F02/F03 reproductions below are retained as dated baseline observations.

TASK-219 closes the historical F04 translation finding locally: sales-invoice
`Outstanding` and `Due date` now use canonical locale keys in all five packs, the live
locale E2E passes on desktop/mobile with route/filter and focused-draft retention, and
the specialist seven-route matrix plus the full built-Demo PGlite audit pass at 129 routes
× 5 languages × 2 viewports with zero blocking findings. The audit allowlist also classifies
locale-generated dates such as `Sept` as dynamic business values. The original F04 row and
reproduction below remain historical baseline observations; current-HEAD remote CI is not
claimed.

TASK-220 closes the historical F05 contrast finding locally: `--accent-action` and
`--accent-action-hover` now separate white-text filled controls from accent text/chart
color. Primary buttons, PWA Install and related filled states use the action token; PWA
disabled buttons expose the same visible disabled treatment as shared buttons. The focused
E2E passes light/dark × desktop/mobile with computed normal/hover contrast of 5.567:1 and
6.947:1, visible 2px focus outlines, zero browser errors and no mobile horizontal overflow.
Four screenshots from those combinations were visually inspected and removed after the
check. The original F05 row below remains a historical baseline observation; charts, print
output, physical devices and exhaustive palette certification remain separate evidence.

## Executive assessment

The Demo runs and the shared transaction layer has meaningful accounting and rollback
proof. Historical seeded-procurement, date-only and invoice-aging observations are now
repaired locally under TASK-216–220; procurement/mobile/recovery gaps remain.
Prioritize those business-facing gaps before treating 129 rendered routes as a complete
ERP experience.

Production release, SG/MY statutory integration, physical devices, realistic capacity
and safe multi-tab/draft upgrades still require separate evidence. Existing PWA
updates are automatically detected and explicitly accepted, not forced silently.

## Environment and evidence boundaries

- Built `web/dist/` with `npm run build:demo`; reused this repository's Vite preview
  at `http://127.0.0.1:4173/`. HTTP 200. No production database or deployment changed.
- Chrome DevTools MCP ran against visible Chrome in an isolated browser profile.
  Completed the first-run wizard using its fictional defaults and signed in as the
  offered Company Owner persona. Verified actual `DB.erpSystem.dataMode = pglite`.
- Browser timezone: `Asia/Singapore`. Mobile checks used actual emulated CSS width
  375, height 812, touch enabled. Native window resize alone stopped at 500px and
  was not counted as the 375px evidence. Desktop audit used 1280×800.
- The manual browser database contains this audit's SO-2 confirmation and approved/
  received PO fixture. These mutations affect only the isolated local Demo profile.
- Existing Playwright scripts supplied additional automated evidence. They are not
  Chrome DevTools MCP runs. Several scripts inject adapter fixtures and therefore
  do not prove a complete authenticated production/API workflow.

## Executed checks

| Check | Current result | What it proves / limitation |
| --- | --- | --- |
| `npm run build:demo` | Pass | Current static bundle and web typecheck. Classic-script, browser-external, eval and large-chunk warnings remain. |
| First-run setup → Demo sign-in → Home | Pass via Chrome DevTools MCP | Real UI and PGlite bootstrap, not a pre-set login flag. |
| SO-2 → Confirm order → invoice/stock/GL | Pass | Draft became Closed; widgets 110→105 and gadgets 97→94. `INV-SO-2` has 3 GL legs, debit=credit=119.90. Posted order exposes no Confirm action. |
| SO-3 insufficient stock | Pass rejection | UI reported product 2 had 94 versus required 120. `INV-SO-3` count remained 0 before/after; broader rollback proof is in `npm run demo`. |
| PO-APP-2026-0001 → approve with reason → receive → invoice | Blocked at invoice | Approval saved the actor/reason; receipt changed PO to received. Invoice rejection and missing tax snapshot are detailed in F01. |
| `npm run demo` | Pass | PGlite sales/stock/GL, duplicate/stock rollback, purchasing/returns/landed-cost, CRM, SG/MY payroll and re-post rejection. PostgreSQL parity/concurrency was not run. |
| `npm run audit:screens` | Failed one recovery assertion | All 129 routes rendered at desktop and mobile with no console/page errors and shared shell/maturity checks passing. Desktop payment-voucher Retry did not recover within the harness budget. |
| `AUDIT_VIEWPORT=desktop POSTING_DETAIL_ONLY=1 npm run audit:screens` | Pass | Focused 3-route desktop rerun including payment-voucher recovery. The script's generic final desktop/mobile wording must not be read as a mobile rerun. |
| `npm run audit:pwa-update` | Pass | v263 audit-b deferred once; audit-c activated once. Does not cover real-device, dirty-form or multi-tab upgrade compatibility. |
| Seven routes × five languages × desktop/mobile | Historical TASK-214 failure; TASK-219 follow-up passes | Original `Outstanding` and `Due date` finding on sales-invoices in ms/zh/ja/vi; no other reported matrix issues. See F04 and the TASK-219 follow-up above. |
| Filled-action contrast E2E | Pass: 2 themes × 2 viewports × normal/hover/focus/disabled | Computed normal/hover contrast 5.567:1 / 6.947:1; zero browser errors and no mobile horizontal overflow. Focused palette evidence only. See F05 and the TASK-220 follow-up above. |
| Manual 375px light/dark/Chinese and approval dialog | Mixed | Zero document overflow on sampled routes; readable structure and usable decision dialog. Touch/zoom/status usability and recovery remain open. |
| Optional `npm test` full regression | Incomplete, stopped | No final result after about 10 minutes while another independent Vitest run was active. Stopped only this audit's process/workers to bound contention. No current full-suite pass or application failure is inferred. |

Reproduce the bounded i18n matrix:

```bash
I18N_ROUTES=dashboard,sales-orders,sales-invoices,purchase-orders,my-leave,company-receipts,staff-calendar \
I18N_REQUIRE_PGLITE=1 npm run audit:i18n
```

Root lint/typecheck, authenticated API/real PostgreSQL E2E, production probes,
external provider calls, real phone tests and full accessibility compliance were
not rerun. Runtime source was not modified; documentation checks are recorded in
TASK-214 on completion. Historical passing tests in STATUS remain dated evidence.

## Reproduced issues and required improvements

- **F01 — P1 — Seeded procurement cannot finish invoicing.** Fresh Demo:
  approve `PO-APP-2026-0001`, then Purchase Orders → row actions → Receive goods →
  Post supplier invoice. Actual error: `Purchase order tax classification is not
  governed for this Company`. Scoped browser SQL confirms `tax_classification =
  unclassified`, recoverability `0.0000`, and zero supplier invoices for this PO.
  The direct seed insert in [seed.ts](../src/data/seed.ts) around 1184–1193 omits
  the new snapshot fields; [purchasing schema](../src/data/schema/purchasing.ts)
  defaults them to unclassified/zero; [postSupplierInvoiceWithin](../src/modules/purchasing/postSupplierInvoice.ts)
  correctly fails closed. **Impact:** the advertised approval-to-AP showcase stops
  after inventory has been received. **Acceptance:** align fictional seed snapshots
  with the governed tax contract, exercise fresh and existing Demo upgrade paths,
  then invoice exactly once with balanced 381.50 GL. Preserve rejection of genuinely
  unclassified production records. Related hardening: TASK-204.

- **F02 — P1 — Sales invoice due dates shift one day in SG timezone.**
  `salesDueDate('2026-06-28')` returns `2026-07-27` in Asia/Singapore although the
  current function adds 30 calendar days, which should produce July 28.
  [screens-sales-hub.js](../web/public/assets/screens-sales-hub.js) around 75–80
  constructs local midnight, then serializes UTC and truncates the date.
  **Impact:** early due/aging labels in both SG and MY local-time workflows.
  **Acceptance:** use a date-only contract and business-owned payment terms; test
  SG, MY, UTC, month/year boundaries and leap days without altering monetary facts.

- **F03 — P1 — Sales invoice KPIs do not represent their labels.** In FY2026/P06,
  two unpaid 2024 invoices plus newly posted SO-2 displayed `Overdue S$0` and
  `Posted this period 3`. [screens-sales-hub.js](../web/public/assets/screens-sales-hub.js)
  around 187 and 264–283 maps every unpaid invoice to Posted; [screens-sales-list.js](../web/public/assets/screens-sales-list.js)
  around 185–199 checks only the literal Overdue status and counts all non-draft,
  non-cancelled invoices without a period predicate. **Impact:** collection and
  period reporting decisions can be wrong despite balanced GL. **Acceptance:**
  define one aging/as-of and fiscal-period contract, reconcile cards/filters/details
  to it, and test mixed past/future/paid/unpaid records. Do not repair this by
  changing stored posting status to a display-only aging category.

- **F04 — P2 — Sales invoice i18n is incomplete.** Live Chinese screenshot retains
  `OUTSTANDING`; the existing audit independently reports `Outstanding` and
  `Due date` in ms/zh/ja/vi at both viewports. **Acceptance:** correct the owned
  translation mappings and pass the same seven-route matrix, preserving active
  route/filter/draft state. Do not merely allowlist the missing translations.

- **F05 — P2 — Dark primary-action text fails the normal-text contrast target.**
  The enabled PWA Install button computes to white `#ffffff` on `#0a84ff`,
  12.5px/650 text, contrast 3.647:1. [erp.css](../web/public/assets/erp.css) defines
  the dark accent; [pwa.css](../web/public/assets/pwa.css) applies the action styling.
  **Acceptance:** distinguish accent-text and filled-action tokens, verify >=4.5:1
  normal text in both themes, then inspect primary/hover/focus/disabled states and
  charts. This is one verified pair, not an exhaustive palette certification.
  **Follow-up:** TASK-220 now passes the focused primary/PWA action checks; the
  reproduction above remains historical, and the remaining chart/print/device boundaries
  are not silently certified by this fix.

- **F06 — P2 — Procurement next actions and wording need a coherent workflow.**
  Goods Receipts → `Receive approved PO` routes to the PO list; opening the approved
  PO returns to approval detail without a receive action. Receiving/invoicing live
  in the row menu at the far edge of a wide mobile table. The receipt introduction
  promises partial receiving and QC, while rows explicitly say `Not modeled` and
  [doReceiveGoods](../web/public/assets/screens-purchasing-lists.js) automatically
  chooses the first warehouse and today's date for a full receipt.
  **Acceptance:** offer the next authorized action on the document, accurately
  describe implemented scope, and let the operator review warehouse/date/quantity
  where the business contract supports them. This is a usability/capability
  improvement; partial receiving is not claimed as a newly broken feature.

- **F07 — P2 — Mobile accessibility and business language need focused follow-up.**
  Top-bar controls measure 34px and filter chips about 30px high at 375px; improve
  touch comfort toward a 44px product target without presenting it as a blanket
  WCAG failure. `web/index.html` disallows user zoom; device behavior/200% zoom
  still needs testing. PO approval displays raw `pending_approval`/`open` status.
  **Acceptance:** accessible localized status names, practical touch areas, zoom
  and keyboard checks, and stable focus/close paths with the virtual keyboard open.

- **F08 — P2 — Recovery audit is timing-sensitive.** The 129-route run failed the
  payment-voucher Retry assertion; a fresh focused desktop run passed. The loop in
  [audit-screens.mjs](../scripts/audit-screens.mjs) around 4470 allows 20×100ms after
  Retry. **Classification:** unresolved test/recovery timing risk, not a confirmed
  persistent application failure. **Acceptance:** repeat on a controlled host,
  measure actual recovery, synchronize with the documented domain milestone and
  agreed budget, and retain genuine timeout/error failures rather than hiding them.

## Performance observations, not capacity certification

- `web/dist/` is approximately 41 MiB. Build output includes ~10.09 MB PGlite WASM,
  ~6.29 MB data, ~16.44 MB CJK font and ~3.04 MB Demo runtime JS. Request deferral,
  cache behavior, compression and optional font/PDF paths should be profiled before
  deciding which split reduces first-use cost.
- One warm MCP route sample at 375px: Home 12ms, Sales Orders 782ms, Purchase Orders
  2239ms, My Leave 220ms, Staff Calendar 200ms. These measure awaited route handling,
  not full interactive readiness, p95 or production API latency. Host was shared
  with other tests; do not use these numbers as a product SLA.
- A warm navigation entry reported DOMContentLoaded ~289ms and load ~290ms while
  ERP readiness occurred separately. Resource timing reported ~40.4 MB decoded
  resources and zero transfer bytes, consistent with cache/SW effects; zero does
  not prove a zero-download first visit.
- **Recommended gate:** measure cold/warm readiness and input latency on a named
  low-end phone/network, large list/report datasets, then production p95/error rate
  and query/worker/connection budgets. Avoid substituting sample-Demo timing for
  100–800 GB capacity evidence (TASK-201).

## Market, agents, production and upgrade backlog

- **SG/MY:** retain separate GST/SST and recoverability contracts and tax-owner
  sign-off (TASK-204). InvoiceNow, MyInvois, GST F5 and SST-02 remain target scope
  in [LOCALIZATION.md](LOCALIZATION.md). Official IRAS/HASiL references are in the
  quality baseline; sandbox submission, rejection/correction/cancellation, status
  reconciliation and idempotent retry are needed before marketing integrations as
  compliant. A displayed rate or balanced journal does not supply that evidence.
- **AR/AP workflow breadth:** [bankReceipt.ts](../src/modules/finance/bankReceipt.ts)
  accepts a posted Project Progress Claim in full; [paymentVoucher.ts](../src/modules/finance/paymentVoucher.ts)
  settles the selected supplier invoice's remaining balance. Ordinary sales
  receipt allocation, partial payments and installments need an explicit product
  contract and tests. These are known scope limits, not regressions.
- **AI Agent friendliness:** current APIs provide tenant/session authorization,
  bounded cursor resources and required idempotency for relevant actions. No
  dedicated generated Agent/MCP/OpenAPI action catalogue was established by this
  review. Add machine-readable contracts, least-privilege actor identity,
  structured recoverable errors and confirmed postconditions; prove revoked access,
  cross-company denial and same-key timeout retry without bypassing human approval.
- **Production release:** TASK-199/203/209 still need deployed revision/health and
  current remote CI/release evidence. Historical 502/billing incidents were not
  reprobed today. Runtime-role and disposable PostgreSQL proof under TASK-195 exist;
  do not relabel those completed source repairs as missing implementation.
- **Scale/operations:** cursor limits and worker telemetry are foundations. Load,
  alerts, backup restore/RPO/RTO and deployment sizing remain TASK-201 evidence.
  Default PostgreSQL bytea shares attachments through the database. The optional
  `DOCUMENT_STORAGE_FS_ROOT` backend is single-node and needs shared durable storage
  before horizontal API/worker expansion.
- **Automatic client updates:** current PWA checks for updates and asks the user to
  activate. Add two-tab/unsaved-form/in-flight-request/offline/rollback acceptance
  plus API/schema compatibility and staged rollout. Do not silently reload an ERP
  document or replay a financial mutation. Physical-device proof remains TASK-017.
- **Knowledge integrity:** old August KB items still surfaced superseded runtime-role,
  receipt-UX, migration and CI claims. Update current summaries with dates while
  preserving historical evidence as historical. The Demo guide's CDN/fixed-user
  descriptions also required correction.

## Visual evidence

These are local fictional Demo screenshots. The dark screenshot was captured just
after live locale/theme switching; it does not by itself prove bottom-bar paint or
focus stability, which requires a settled-state check.

- [375px invoices, light](review-assets/2026-09-07/invoices-mobile-light.png)
- [375px invoices, dark/Chinese](review-assets/2026-09-07/invoices-mobile-dark-zh.png)
- [375px purchase approval dialog](review-assets/2026-09-07/purchase-approval-mobile.png)

## Recommended order

1. Repair F01–F03 with contract-level regressions and fresh Demo walkthroughs.
2. Close F04–F07 with five-language, light/dark and device-focused UI checks; stabilize F08.
3. Extend the AR/AP completion and Agent contracts according to approved business scope.
4. Close current CI, production/security/tax-owner/restore/scale and client-upgrade
   gates before claiming production readiness. Keep evidence dated and reproducible.

## Knowledge synchronization

Main KB: `erp-system-project-logic` (`ef47bf4b-83e1-42b2-a412-66912d04ea24`).
Quality baseline item: `09e0f35d-03bd-4094-b177-7ce3df5cd361`.
Audit findings item: `14aee39e-77ff-4e2c-925f-cde90ecc6667`.
The current deployment, EPIC-066 and landmine summaries were updated while marking
old August incidents as historical. These records report findings, not completed fixes.
