# TASK-202 — Receipt Pack browser Print dispatch

Date: 2026-09-13, Asia/Singapore. This record covers a local built-Demo
browser regression for Receipt Pack Print dispatch. It does not claim a
production release, readable SG/MY source, or human visual Print acceptance.

## Identity and scope

- Task: TASK-202, inherited Receipt Pack production-acceptance task.
- Environment: local Vite built-Demo preview with Playwright Chromium and the
  existing mock/API-shaped Company Receipts fixture.
- Actor and tenant: seeded `admin@acme.co`; `M1` / `C-SG` only.
- Viewports: 1440x900 desktop and 390x844 responsive follow-up (the existing
  flow also checks the 375px API browser path).
- Intended outcome: clicking Print must request the `print` PDF action and open
  the generated blob URL in a protected `_blank` window with `noopener`.
- Exclusions: no production origin, provider credential, external calendar,
  database mutation, or human printer review.

## Observed result

The existing `company-receipts.spec.mjs` harness now records the `window.open`
arguments instead of discarding them. After the real page click, the test
observed the `print` adapter action and a `blob:` URL opened with `_blank` and
`noopener`. The desktop and responsive overflow assertions remained passing.

This closes the local UI dispatch gap between the Print button and the
generated immutable PDF artifact. It does not replace the required production
download/Print and Finance/QA visual acceptance.

## Verification and provenance

- `node tests/e2e/company-receipts.spec.mjs` — **pass**: mock/API-shape,
  Demo clean-evidence, query filters, PDF preview/download/print, pagination and
  responsive facts.
- `npm run lint` — pass.
- `npm run typecheck` and `npm run typecheck:web` — pass.
- `env -u POSTGRES_URL npm run demo` — pass; local PGlite only.
- `npm run build:demo` — pass; existing Vite classic-script, missing static
  asset, browser-external/eval and large-chunk warnings remain non-fatal.
- `npm run docs:check` — pass: 99 Markdown files / 824 local links.
- `git diff --check` and conflict-marker scan — pass.
- Source revision under test: `fa8781b16df0e61871074da2ccfdbe3dcef178a5`
  plus the isolated E2E diff recorded in this file.
- Existing unrelated dirty paths were preserved and not staged.

## Acceptance boundary

This is local source/fixture/Demo evidence for the Print-dispatch portion of
TASK-202. Registry status and GOAL counters remain unchanged. Production
readable source, release identity, downloaded/printed artifact review and
Finance/QA acceptance remain open.
