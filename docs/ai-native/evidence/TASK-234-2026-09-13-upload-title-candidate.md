# TASK-234 — Upload and title repair candidate

Date: 2026-09-13, Asia/Singapore. This record covers a reviewable local source
candidate for the TASK-234 contextual workspace. It does not promote G07.3,
publish a Pages release, or provide real-provider or human business acceptance.

## Candidate identity and scope

- Base upload repair: `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4` (`fix: unwrap receipt work context capabilities`).
- Applied title/i18n repairs: `3dbd499` (module access title), `a63588c` (parameterized text), and `0b32164` (Company Receipts locale assertions).
- Candidate tip: `0b321646b2dd913822e2e1c41d10f9a11f520107`; tree: `b5af3452999549098bd0176fa74352f49c10079f`.
- Isolated worktree: `/tmp/erp-task234-candidate-20260912` (removed after verification; the candidate tip remains reproducible).
- Final candidate worktree status: clean after removing temporary dependency symlinks.
- Changed scoped files relative to the upload base: `web/public/assets/app.js`, `web/public/assets/screens-hr-new.js`, `web/public/assets/screens-ops.js`, `web/public/assets/screens-people.js`, and `tests/e2e/company-receipts.spec.mjs`.
- Environment / actor: local Demo/PGlite-compatible build and headless Chromium; Codex actor; synthetic fixtures only.

The candidate combines the previously reviewed My Receipts response-envelope
repair with the current parameterized localized-text repair. The upload change
unwraps `contextResponse.data` before reading capabilities; the title repair
keeps parameter values escaped once while allowing translated ampersands to
render as text. The candidate is scoped for release-owner review and still
requires reconciliation with any newer main-branch release source before
publication.

## Root integration — 2026-09-13

The upload-envelope fix is now committed on the current root branch as
`5e983e9bd88a1d2bb4f0d25695d1a61f2d6a167b` (`Fix My Receipts capability envelope
handling`). The committed diff is limited to `web/public/assets/screens-hr.js`:
the screen now unwraps the adapter's `{data, meta}` response before checking the
server-derived receipt write capability. Existing title/i18n repairs and their
locale assertions are already present in the root history. This closes the local
source handoff for the candidate while leaving release publication and hosted
verification as separate gates.

The post-integration expected result was observed: an authorized Demo employee
can reach the receipt capture path, while Company Receipts access text remains
translated without literal `&amp;` output. The focused E2E passed after a fresh
Demo build; no production database, provider request, external upload or secret
was used.

## Expected and observed result

Expected: an authorized employee can reach the My Receipts upload controls, and
Company Receipts module-access titles and permission messages display translated
characters without literal `&amp;` text. Existing command authorization,
Company/actor derivation, approval and Demo/PostgreSQL contracts remain
unchanged.

Observed: the Company Receipts E2E passed the five locale title assertions,
dynamic `Acme & Sons` permission text, receipt query/filter/pagination paths,
Pack/PDF preview and responsive checks. The Receipt Assistant workspace E2E
passed desktop/mobile state, cancellation/recovery, scope guard, five locales,
both themes and focus/overflow checks.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | Pass, exit 0 |
| `npm run typecheck` | Pass, exit 0 |
| `npm run typecheck:web` | Pass, exit 0 |
| `npm run build:demo` | Pass, exit 0; existing classic-script, PGlite/eval and chunk-size warnings only |
| `npm run demo` | Pass, all PGlite checks |
| `I18N_REPORT_ONLY=1 node scripts/audit-i18n.mjs` | Pass, 1,798 canonical keys / 73 five-language packs |
| `node tests/e2e/company-receipts.spec.mjs` | Pass, focused Company Receipts contract and responsive paths |
| `npm run test:e2e:receipt-assistant` | Pass, assistant workspace desktop/mobile and governance paths |
| `npm run docs:check` | Pass in candidate, 72 Markdown files / 759 local links |
| `git diff --check` | Pass |
| Root integration | Pass, commit `5e983e9`; `git diff --cached --check` and final working-tree diff check pass |
| Final root state | HEAD `c97f47e4f7cf059407d7e67631d41511e59a6b54`; 40 pre-existing dirty paths preserved, no unmerged paths, cached diff empty |
| `LIST_LAYOUT_ONLY=1 node scripts/audit-screens.mjs` | Not completed: the candidate run remained in Chromium route enumeration for 60 seconds after reporting 50 routes; no assertion failure was emitted. Existing root evidence records the same audit passing before this candidate was assembled. |

The first focused E2E attempt needed a temporary `web/node_modules` link in the
isolated worktree; after linking the existing repository installation, the same
command passed. The links were removed and the candidate was read back clean.

## Acceptance boundary and handoff

No provider key, external upload, production database, Pages push/deployment,
real server-provider request, human Pack/Print verdict or production OCR was
used. The registry and GOAL counts are unchanged at 227/240 done, 7/12 AI
workstreams, 31/48 criteria and 41/60 checkpoints; G07.3 remains open. A
release owner must authorize publication of the committed source through the
main-only Pages workflow, then verify hosted My Receipts upload without a
temporary source override. That hosted check still cannot substitute for the
real server/provider and business-acceptance gates.
