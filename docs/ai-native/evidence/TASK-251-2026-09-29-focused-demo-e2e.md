# TASK-251 — Focused Demo ERP end-to-end verification

Date: 2026-09-29. Scope: local Demo and built static preview, using isolated browser
contexts and synthetic data. The existing user Demo database was not reset.

## Finding and repair

The module-disabled heading used the static English navigation label before the
localized module label. Company Receipts therefore showed an English module name in
the Malay access message. `moduleBlockedPanel` in
`web/public/assets/app.js` now uses `MODULE_DEFS[mod].labelKey` where available.
The Company Receipts browser test checks the heading in all five supported languages.

The Company Receipts test could connect to an unrelated local service on its fixed
port and incorrectly regard HTTP 200 as a ready ERP preview. It now selects a free
port, checks the ERP page title, and passes Playwright's function timeout in the
correct argument position. The setup test's old `HR / Payroll` command expectation
was updated to the current `Human Resources` label; its policy-save journey closes
the command palette before clicking the settings page.

## Browser evidence

| Journey | Result |
| --- | --- |
| First-run Company creation | Five layout widths (1280, 753, 603, 390, 375 px) passed. The new SG Company retained name, country, SGD currency, GST regime and its selected HR/Expenses & Tax modules. System Settings read back the facts; a date-format policy change survived reload. |
| Employee directory and account | At 1280 and 375 px, a synthetic employee appeared as the sole matching directory row, opened its canonical detail, signed in directly and reached Employee Self Service without console errors or horizontal overflow. The existing account test also passed at 445 and 390 px before the focused additions. |
| Leave | My Leave validation, the HR Directory pending-approval link and the versioned/idempotent approval action passed. |
| My Receipts | The employee uploaded a synthetic local image as an offline draft, synced it, saw the expected scanner-unavailable quarantine, and still saw that status after reload at 1280 and 375 px. |
| Company Receipts | Built-Demo test passed access labels in five languages, mock/API-shape and clean-evidence confirmation paths, query filters, immutable PDF preview/download/print, pagination and responsive checks. |

The Company Receipts confirmation test supplies an isolated scan-clean fixture. It
does not demonstrate that the normal local Demo scanner can clean a newly uploaded
receipt. The normal My Receipts journey correctly quarantines an upload while a
scanner is unavailable. This run does not prove production API, PostgreSQL,
configured Vision scanning or production release behavior.

## Gates

`node tests/e2e/company-receipts.spec.mjs`,
`node tests/e2e/staff-account-immediate.spec.mjs` (focused 1280/375 px additions),
`node tests/e2e/my-leave-validation.spec.mjs`,
`node tests/e2e/leave-approval-action.spec.mjs`,
`node tests/e2e/hr-directory-kpi.spec.mjs`, and
`node tests/e2e/setup-wizard-layout.spec.mjs` passed for the described journeys.
The module/policy extension was rerun with
`SETUP_WIZARD_E2E_MODULE_ONLY=1`. `npm run demo` passed PGlite transaction proofs.
`npm run lint`, `npm run typecheck`, `npm run typecheck:web`,
`npm run build:demo` and `git diff --check` passed. The build printed its existing
classic-script and large-chunk warnings, with no build failure.

## Project continuity

KB-MCP project context `erp-system-project-logic` was checked against current source.
Its Company Receipts boundary matches the implementation: Company-owned records are
separate from Employee My Receipts capture and expense claims. The earlier KB
autonomy pattern (`PROJECT.md`/`STATE.md`/evidence) maps here to the repository's
existing `GOAL.md`, `PROGRESS.md`, task registry and dated evidence files, so this
verification is recorded in those owners without adding duplicate state files.
