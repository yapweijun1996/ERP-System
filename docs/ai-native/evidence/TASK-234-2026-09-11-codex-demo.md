# TASK-234 — Codex-reviewed Demo receipt and upload repair

Date: 2026-09-11, Asia/Singapore. Checkpoints: supporting S4 upload repair and S5
Demo receipt-to-Pack execution. TASK-234 remains In Progress; no criterion or
checkpoint count is promoted by a repeated or narrower run.

## Authorization and scope

The user explicitly selected the existing Demo endpoint and delegated OCR/receipt
review to Codex: “just use the demo endpoint and ai ocr done by you will do no
need my action at all”. This removes the need for another user-operated review
step in this Demo run. It does not turn a static Demo into the server provider,
production scanner, tax compliance or real business-owner acceptance evidence.
No separate provider key/account was requested or used. Gateway cost/underlying
provider identity are unavailable, not zero or inferred.

Expected: visually read a readable synthetic source, upload and confirm it using
existing commands, call the actual Demo gateway, explicitly approve the exact
selection, create one Pack and verify its PDF/receipt identity after reload.
Actual: all these Demo outcomes were observed. The upload UI defect discovered
at the start was repaired locally; the hosted test used a temporary equivalent
screen override, removed by reload. No source release was deployed in this turn.

## Source and environment identity

- Root HEAD: `a4b7982bcf10ac71d709740af80dc2e79991e1c5`, `main`, existing dirty tracked/untracked work preserved. This is not an immutable tested release.
- Changed screen: `web/public/assets/screens-hr.js`, SHA-256 `dbbae4918eb0e73c254f6e6fcc4fcc4fb5f0591007c0c4409541065ff25ab5b4`.
- Added regression: `src/myReceiptsScreen.test.ts`, SHA-256 `8594c1b4670d8fca9c4b1c7eac4f2a290b28ca9eecf618ee9b50abc3bd7d59ec`.
- Hosted origin: `https://yapweijun1996.github.io/ERP-System/`, native Codex in-app browser. The manifest read during outcome verification reported `3e93249e34ff607fc693c1ad7b72e020df25825c`, workflow `34539106963`, Demo mode, 136 files. It identifies the served manifest at read time, not an independently hash-verified snapshot of every asset loaded earlier in this session.
- Hosted actor: existing synthetic Siti Aminah / Finance Preparer, user 10, `M1/C-SG`.
- Local built-source UI: loopback `http://127.0.0.1:4390/`, existing Avery Tan showcase actor, 1280px and 375px. No source override on the local build. Local server stopped after verification.
- Neither environment is production or disposable PostgreSQL. No remote CI run was triggered or claimed.

## Root cause and smallest repair

`ErpSystemData.my.context()` returns `{data, meta}` in both adapters.
`myWorkContextOrIdentityPage` preserves that envelope. My Receipts read
`context.capabilities`, so even `{data:{capabilities:{receipts:{writable:true}}}}`
hid Take photo, Choose file and Sync controls. Before the fix, live inspection
reported writable=true but zero rendered file inputs, for an existing employee.

The screen now unwraps `contextResponse.data`, matching My Leave's established
pattern. A missing capability still fails closed. No permission grant, scanner,
module rule, API contract or upload domain command changed. A UI capability is
only a display decision; the existing command rechecks authority at execution.

The new regression executes the actual screen source in a VM: writable=true
shows capture/upload, false or absent writable hides them, and an unrelated
top-level capability cannot override the data envelope. After correcting two
harness-only localization stubs, all three assertions failed on the old screen
for the expected envelope defect, then passed on the repair.

## Fixture boundaries and OCR review

The fresh static Demo disables Expenses & Tax and has no malware scanner. As in
`tests/e2e/company-receipts.spec.mjs`, only the local hosted-browser fixture
`M1/C-SG` module allocation was enabled, and only the uploaded synthetic version's
scan row was marked `clean` with scanner `codex-demo-fixture`. This is test setup,
not evidence of Platform provisioning or a real clean scan. No role permissions
were added. These fixture rows and the generated receipt/Pack remain in that
browser's Demo database. Temporary screen/projection overrides were removed.

Source: existing `task234-public-synthetic-receipt.png`, 67,453 bytes,
SHA-256 `4cb3d1be0e46bcd2ceffe1c5d36657fafdd6d507a975580dc5026ccd418ba96e`.
Codex read the image directly and later opened the same hash-verified original
inside the assistant. It explicitly says synthetic, not a real business receipt.

| Field | Visually read source / confirmed value |
| --- | --- |
| Merchant | Coffee Demo Pte Ltd |
| Date / currency | 2026-09-11 / SGD |
| Receipt number | DEMO-234-0911 |
| Lines | Cappuccino 8.50; avocado toast 18.00; service charge 3.30; GST line 3.00 |
| Total | 32.80; arithmetic sum of the four displayed lines agrees |
| Purpose | Team coffee meeting; saved with a synthetic Demo review label |

The displayed “GST 9%” amount is not 9% of the preceding 29.80 subtotal. This
source inconsistency was recorded in receipt notes; no tax compliance or posting
was asserted, and original evidence bytes were preserved. The extraction was
Codex visual reading, not execution of the ERP OCR worker or the gateway OCR API.

## Observed journey and persisted result

1. Existing Demo Finance Preparer selected the source through Choose file, saved
   an offline draft and clicked Sync; the governed upload stored document/version 1.
2. The eligible-evidence picker selected that exact version. Codex entered the
   image-derived fields and saved Company Receipt 1 through the normal form.
3. The assistant sent `Coffee` with explicit 2026-09-11 date boundaries. Actual
   browser-origin gateway responses were session 201 and responses 200, with 204
   CORS preflights. No gateway transport was stubbed; no token/body was logged.
   Only the search request went to the Demo gateway; receipt image bytes stayed local.
4. The waiting preview contained exactly one selected receipt, SGD 32.8000,
   document/version 1/1 and the original source hash. Codex opened the original
   image and supplied an explicit reason identifying the user-authorized AI review.
5. Approve exact Pack used the shared persisted intent/Pack commands. The assistant
   showed succeeded only after readback and artifact verification, Pack ID 1.
6. Preview Pack produced a PDF blob. The in-app iframe appeared blank; the exact
   blob was saved without modification and independently rendered with Poppler.
   Both pages were visually checked: readable register, matching merchant/date/
   receipt number/amount, and complete original receipt image on page 2.
7. Reload removed the temporary screen override and reopened the persisted Demo
   database. Authorized list/get/download returned one original Pack; the independent
   download hash matched the pre-reload blob exactly. No second Pack was created.

| Persisted postcondition | Actual |
| --- | --- |
| Pack / receipt / source documents | Pack 1; one receipt row; one source document |
| Approval intent | ID 1, approved; reason explicitly records Codex's delegated Demo review |
| Pack source SHA-256 | `13b3f7657a5215782b1c0b9724800dbf6d741b9ba175625eeefa8dcc568b4f2c` |
| PDF artifact SHA-256 | `c3fffc9c5654acd90f176e82db76b48ffc6a2129a761269c1e8ed2dfc6175c81` |
| PDF bytes / pages | 14,183,221 / 2 |
| Reload / authorized download | Same Pack ID/count, same PDF SHA-256 |

Durable local review artifacts (not repository source or production storage):
[Pack PDF](/Users/yapweijun/.codex/visualizations/2026/09/10/01a08d71-90cb-70c0-b937-77aeac6d30f5/erp-demo-review/pack-1.pdf),
[source image](/Users/yapweijun/.codex/visualizations/2026/09/10/01a08d71-90cb-70c0-b937-77aeac6d30f5/erp-demo-review/source-receipt.png),
[sanitized persisted result](/Users/yapweijun/.codex/visualizations/2026/09/10/01a08d71-90cb-70c0-b937-77aeac6d30f5/erp-demo-review/persisted-evidence.json).

## Verification and remaining limits

- `npm test -- src/myReceiptsScreen.test.ts`: 3/3 pass after old-source failure.
- `npm run lint`: exit 0, no errors/warnings.
- `npm run typecheck` and `npm run typecheck:web`: exit 0.
- `env -u POSTGRES_URL npm run demo`: exit 0; isolated PGlite transactional proof only.
- `npm run build:demo`: exit 0; existing classic-script/CSS/PGlite-eval/large-chunk warnings remain distinct from clean lint.
- Actual local build at 1280px/375px: upload controls visible, no horizontal page overflow; at 375px, Choose file -> draft -> Sync stored one quarantined file. The scanner remained unavailable, as expected.
- A local read-only capability projection fixture hid all three upload actions and the file input; original adapter restored afterward. Unit tests cover false/absent capabilities and misleading top-level fields.
- No application error-level browser console entries in either inspected tab. Two preview command attempts served the wrong root/404 and were stopped; the verified preview used Vite from `web/` on port 4390. A selector mismatch and minified-source override mismatch were inspection/tool setup issues, resolved without another Pack or provider request.
- PDF inspection: `pdfinfo`, `pdftotext -layout`, `pdftoppm -r 90 -png`; 2 pages, readable matching register and full source. The blank in-app preview remains a browser-specific delivery limitation, not a successful inline viewing claim.
- No full Vitest suite, PostgreSQL, physical device, complete locale/theme matrix, remote CI or production release rerun. Those historical evidence classes are not promoted by this targeted repair.
- The project KB connector recovered in the continuation: `kb_list` resolved
  `erp-system-project-logic` to `ef47bf4b-83e1-42b2-a412-66912d04ea24`, and the
  source-backed continuation item was updated and read back successfully. The KB
  remains continuity context; current source, tests and STATUS/SPEC docs remain
  authoritative.

## Upload repair release candidate

To make the repair independently reviewable without touching the dirty root
worktree, a detached candidate was created from the current public Demo source:

- Parent: `ae7a3cfabde0e03a704d943dc1d99cc3bb672e2a`.
- Candidate: `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4`;
  `web/public/assets/screens-hr.js` SHA-256 remains
  `dbbae4918eb0e73c254f6e6fcc4fcc4fb5f0591007c0c4409541065ff25ab5b4`.
- Candidate build: Demo mode, 134 files; `assets/screens-hr.js` is 328,644
  bytes with SHA-256 `46d817791a27f4e5dd27479d0e4c33b92d41e1661f9ee53894ce6418fb95e5bc`.
- Candidate gates: lint, root/web typechecks, PGlite `npm run demo`,
  `npm run build:demo`, `npm run docs:check` (72 Markdown files / 759 links)
  and `git diff --check` all passed. Build warnings are the existing classic
  script, PGlite browser-eval and chunk-size warnings.
- Fresh candidate browser setup rendered Take photo, Choose file and Sync all
  from the real built screen after sign-in; no screen override was installed.

The candidate is a local detached release ref only. It was not pushed, deployed
to Pages, or used to alter production. Current public hosting is a later
Pages revision (`3e93249e34ff607fc693c1ad7b72e020df25825c`) that still serves
the pre-repair My Receipts bundle. A release owner must authorize the external
push before this exact candidate can be published and rechecked.

Final targeted regression and documentation gate results are appended after completion.

Final checks: `npm test -- src/myReceiptsScreen.test.ts src/data/demoReceiptAssistant.test.ts src/api/receiptAssistant.integration.test.ts` passed **3 files / 25 tests**. `npm run docs:check` passed **75 Markdown files / 780 local links**; GOAL's count/dependency/fingerprint validator and `git diff --check` passed. Root Markdown render/link/fragment validation passed **3 files / 78 local links / 8 tables**. A SHA-256 comparison against the pre-edit inventory confirmed all pre-existing unrelated files were preserved. Counts remain **226/240 Done, 6/12 AI, 27/48 criteria, 36/60 checkpoints**.

## Candidate recheck — 2026-09-11T01:47:11Z

- **Candidate / state:** detached commit `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4`,
  parent `ae7a3cfabde0e03a704d943dc1d99cc3bb672e2a`; temporary review worktree was
  clean and removed after verification. The existing durable-workflow worktree
  `task-236-docs-final` at `103e4ef` was inspected separately and left untouched.
- **Scope review:** the candidate changes only
  `web/public/assets/screens-hr.js` (7 lines changed). It unwraps the
  `{data, meta}` work-context response before reading
  `data.capabilities.receipts.writable`; absent or false capability still hides
  the three upload controls.
- **Verification:** candidate lint, root/web typechecks, PGlite Demo, Demo build,
  `docs:check` (72 Markdown files / 759 links), `git diff --check`, and a temporary
  copy of the capability-envelope test (1 file / 3 tests) all passed. The temporary
  test file and shared dependency symlink were removed; the candidate remained clean.
  The Demo build emitted existing classic-script, missing-static-asset,
  browser-eval and large-chunk warnings, but exited successfully.
- **Boundary:** this is local candidate evidence only. No push, Pages deployment,
  production mutation, remote CI result or real-provider/OCR acceptance is claimed.

## Public Pages candidate recheck — 2026-09-11T02:39:29Z

The public Demo was rechecked read-only after the user-authorized Demo run. This
does not require or imply a provider key, production write, external push or
deployment approval.

- `https://yapweijun1996.github.io/ERP-System/release.json` returned HTTP 200 with
  revision `3e93249e34ff607fc693c1ad7b72e020df25825c`, workflow `34539106963`,
  `dataMode=demo`, `builtAt=2026-09-10T22:47:57.924Z` and 136 manifest files.
- A bounded read-only verifier fetched every manifest entry and matched byte count
  and SHA-256: 136 checked, 135 served application assets plus `.nojekyll`, zero
  failures. The served `assets/screens-hr.js` is 328,632 bytes with manifest hash
  `9205f2e5750dcad976bd70fe03d175d49845823890f946e0f032cb7132075b57`; no API
  key, `sk-` token or credential string was present.
- In a fresh public browser Demo setup, the actor was switched to Siti Aminah /
  Finance Preparer and `#my-receipts` was reloaded. The page showed the empty
  receipt state but no `Take photo`, `Choose file`, `Sync all` or file input.
- The served bundle still evaluates the context as `d.capabilities...` after
  `myWorkContextOrIdentityPage`, while the verified local repair reads
  `contextResponse.data.capabilities...`. The public workflow therefore serves
  the pre-repair screen; this is a reproducible hosted gap, not a permission
  denial or a successful upload result.

The public revision is the durable-workflow branch currently published by Pages,
not detached candidate `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4`. The candidate
repair remains locally verified and unpushed. This recheck adds no task,
criterion or checkpoint count: it changes the next measurable action from a
generic hosted verification to release-owner authorization to publish the exact
repair, followed by the same fresh-browser upload check without an override.

## Current public and local candidate recheck — 2026-09-11T10:02:20Z

- **Actor / state:** Codex performed a read-only public check from root `main` at
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5` (226 pre-existing dirty paths).
  The repair candidate `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4` remains local and
  unpushed; the separate `task-236-docs-final` worktree is clean at `103e4ef`.
- **Expected:** the published My Receipts screen should unwrap the `{data, meta}`
  work-context response and render `Take photo`, `Choose file` and `Sync all` for
  the writable Demo context; the canonical local source should pass the same
  behavior on desktop and mobile.
- **Actual public:** `release.json` returned revision
  `3e93249e34ff607fc693c1ad7b72e020df25825c`, workflow `34539106963`, Demo mode
  and 136 files. A fresh Chromium session at 1440px, with no source override,
  entered My Receipts for `M1/C-SG`; it showed zero camera controls, zero file
  inputs and zero capture buttons, with no console or page errors. The served
  bundle still reads `d.capabilities` instead of `contextResponse.data.capabilities`.
- **Actual local:** `npm test -- --run src/myReceiptsScreen.test.ts --reporter=dot`
  passed 1 file / 3 tests. `node tests/e2e/company-receipts.spec.mjs` passed the
  actual Demo clean-evidence flow, PDF immutability checks, pagination and both
  1440px desktop and 390px mobile responsive paths. Existing `npm run demo` and
  `npm run build:demo` gates also passed for the candidate.
- **Documentation gates:** after this record, `npm run docs:check` passed 79
  Markdown files / 792 local links; the exact GOAL count/dependency/fingerprint
  validator passed with 240 tasks (226 done, 6 in progress, 5 todo, 3 blocked),
  27/48 criteria, 36/60 checkpoints and no dependency-ready Todo; root
  `GOAL.md` / `PROGRESS.md` / `GOAL_PROMPT.md` link and fragment review passed
  114 local links; `git diff --check` passed.
- **Boundary / next exit:** local Demo and Codex OCR/receipt/PDF review are
  authorized without user action or provider keys, but the hosted gap remains.
  No push, Pages deployment, production write or real-provider acceptance was
  attempted. The exact missing resource is release-owner authorization; the
  measurable unblock is to publish this candidate and repeat the fresh hosted
  upload check without an override.

## Local OCR parity readback — 2026-09-11T14:08:43Z

This is a read-only recheck of the same Demo source artifact, not a new receipt
run or a new capability claim.

- Revision/state: root `main` at `a4b7982bcf10ac71d709740af80dc2e79991e1c5`, with the existing 232 dirty paths preserved.
- Environment/actor: local Codex workspace; the prior Demo synthetic receipt artifact and its recorded `M1/C-SG` Finance Preparer context.
- Input: `source-receipt.png`, 67,453 bytes, SHA-256 `4cb3d1be0e46bcd2ceffe1c5d36657fafdd6d507a975580dc5026ccd418ba96e`.
- Command: `tesseract source-receipt.png stdout`.
- Expected: OCR output matches the previously recorded Codex visual reading without exposing credentials or changing persisted Demo state.
- Actual: OCR returned `Coffee Demo Pte Ltd`, `DEMO-234-0911`, `2026-09-11`, `SGD`, Cappuccino `8.50`, Avocado toast `18.00`, service charge `3.30`, GST line `3.00`, total `32.80`, and purpose `team coffee meeting`; the synthetic-fixture disclaimer was also preserved.
- Result: expected parity observed. No image was sent to a provider, no Demo/API/production write occurred, and no task, criterion, checkpoint or count changed.

## Candidate-to-root source equality audit — 2026-09-11T14:15:00Z

- Expected: the reviewed detached upload-repair candidate must be compared with the current root source before any rebuild or integration; a byte-identical source needs no second cherry-pick.
- Actual: candidate commit `02f28fe5a3aaa69b1d6f63c09cf00a1415a8dca4` and root `main` revision `a4b7982bcf10ac71d709740af80dc2e79991e1c5` have byte-identical `web/public/assets/screens-hr.js` (`cmp` exit 0). The file contains the `{data, meta}` capability-envelope unwrap and the existing positive/negative capability guard.
- State: root remains dirty with 232 existing paths; the candidate remains a separate detached ref and the public Pages revision remains `3e93249e34ff607fc693c1ad7b72e020df25825c`.
- Result: no rebuild, cherry-pick, merge, push or deployment was performed. This confirms the next action is release-owner authorization followed by exact candidate publication and a no-override Hosted upload check; no task, criterion, checkpoint or count changed.
