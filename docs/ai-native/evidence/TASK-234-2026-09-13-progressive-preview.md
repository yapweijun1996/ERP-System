# TASK-234 — Progressive selected-receipt preview recheck

Date: 2026-09-13, Asia/Singapore. This is a local Demo/UI evidence record for
the “Review every selected receipt” packet step. It does not promote a G07
criterion, checkpoint, production/provider gate or human acceptance.

## Scope and expected result

- Root revision: `7bdefcc8f65814f2c382f328a1641d3e2222c877` on `main`.
- Source under review: `web/public/assets/screens-company-receipts.js`,
  SHA-256 `68522bc32f6c5ade90e2bccf88938c42288ba7f2ac4bfcb17e39263659acb130`.
- Actor/environment: Codex, local Demo build and Playwright browser fixture; no
  provider credential, production database, deployment, external communication
  or secret was used.
- Working-tree state before this evidence edit: 33 status paths (23 tracked
  dirty, 10 untracked), empty index. Existing unrelated changes were preserved.

Expected: a selected preview initially shows at most 20 rows; the existing
localized Load more action reveals the next bounded batch; a 21-row selection
reaches row 21 with its amount, currency, purpose, receipt/version and original
document facts; selection digests and approval/execution payloads remain owned by
the existing commands; desktop and 375px layouts remain within the viewport.

## Observed result

The source already implements the expected behavior. `assistantPreviewBody()`
slices rows by `assistantSession.previewLimit || 20` and renders the localized
Load more button while rows remain. The handler increases the limit by 20,
rerenders the same result and focuses the first newly exposed row. A new
assistant request resets the limit to 20. No selection, digest, approval or
server-authority code changed in this recheck.

`npm run test:e2e:receipt-assistant` passed. The command rebuilt the Demo bundle
and exercised both 1280×900 desktop and 375×812 mobile viewports. The fixture
asserted 20 initial rows, 21 rows after Load more, the last row’s amount/currency,
purpose, document-version ID and SHA-256, removal of the exhausted action, and
zero horizontal overflow. It also passed cancellation/recovery, scope-change
guard, exact-version evidence inspection, persisted approval/execution and PDF
hash checks, five locales (`en`, `zh`, `ms`, `vi`, `ja`) and light/dark themes
without browser errors.

The build emitted its existing classic-script, missing-static-asset,
PGlite-browser-eval and large-chunk warnings but exited successfully. This run
does not claim a real provider call, production/PostgreSQL evidence, human visual
review or hosted publication.

## Common gates

| Check | Result |
| --- | --- |
| `npm run lint` | Pass, exit 0 |
| `npm run typecheck` | Pass, exit 0 |
| `npm run typecheck:web` | Pass, exit 0 |
| `env -u POSTGRES_URL npm run demo` | Pass, isolated PGlite checks; no PostgreSQL configured |
| `npm run docs:check` | Pass, 92 Markdown files / 817 local links before this evidence file |
| `git diff --check` | Pass |

The packet’s local progressive-preview gap is therefore closed by current source
and regression evidence. TASK-234 remains In Progress because publication,
same-run real-provider evidence and human acceptance remain separate open gates.
