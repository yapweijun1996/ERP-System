# TASK-202 — Hosted Demo Receipt Pack readability and export evidence

Date: 2026-09-11, Asia/Singapore. This is a follow-on Demo evidence record for
the remaining Receipt Pack release/UAT gap. TASK-202 remains In Progress. It does
not promote Demo evidence to production or replace Finance owner acceptance.

## Identity and scope

- Task / goal: TASK-202 / inherited Receipt Pack lifecycle and export acceptance (supports the G05 pilot evidence boundary).
- Source and worktree: root `a4b7982bcf10ac71d709740af80dc2e79991e1c5`, `main`, with the
  pre-existing dirty worktree preserved. The browser served the existing Hosted Demo
  bundle (served manifest `3e93249e34ff607fc693c1ad7b72e020df25825c`); no source
  release, push or deployment occurred in this run.
- Environment: Hosted Demo at `https://yapweijun1996.github.io/ERP-System/`, native
  Codex in-app browser, Demo data mode. This is a fixture/Demo environment, not
  PostgreSQL production, a real OCR provider, CI or a physical device.
- Actor and Company: existing synthetic `Siti Aminah · Finance Preparer`,
  `M1/C-SG` / `Acme Singapore`. No additional role, tenant or provider credential
  was created.
- Authorization: the user explicitly authorized Demo endpoint use and delegated
  OCR/receipt review to Codex, with no manual action required. The source is labelled
  synthetic and its GST inconsistency is not treated as tax compliance evidence.

Expected: a readable source should produce one exact Company Receipt Pack, and the
authorized browser should expose the same immutable PDF for preview/download/Print.
Production readable-source replacement and human visual/business acceptance remain
separate required gates.

## Source and Codex OCR review

The locally retained source image was opened and read by Codex. It is the same
synthetic source used by the Hosted Demo journey:

| Field | Observed value |
| --- | --- |
| File | `task234-public-synthetic-receipt.png` |
| Bytes / dimensions | 67,453 / 720 × 1080 PNG |
| Source SHA-256 | `4cb3d1be0e46bcd2ceffe1c5d36657fafdd6d507a975580dc5026ccd418ba96e` |
| Merchant / receipt | Coffee Demo Pte Ltd / DEMO-234-0911 |
| Date / currency | 2026-09-11 / SGD |
| Displayed lines | Cappuccino 8.50; avocado toast 18.00; service charge 3.30; GST line 3.00 |
| Total / purpose | 32.80 / Team coffee meeting |

The four displayed line values add to 32.80. The image's displayed `GST 9%` is
not 9% of the preceding 29.80 subtotal; the record remains a synthetic review
fixture and no tax posting or compliance result is claimed.

## Observed Demo journey and artifact

1. The hosted Company Receipts page showed exactly one Ready row for the source:
   Coffee Demo Pte Ltd, DEMO-234-0911, 2026-09-11, Meals, S$32.80, SGD.
2. Date From and Date To were both set to `2026-09-11` and Apply was used. The
   review dialog selected one evidence version and showed `SGD 32.8000 · 1`, the
   date filters and the source file.
3. The user-authorized confirmation created one persisted Demo Pack. The page
   survived the refresh/reload check with the same Pack available in the scoped
   Company Receipts history.
4. The retained authorized PDF was independently checked with `pdfinfo` and
   `pdftotext -layout`. It is a two-page A4 landscape PDF whose extracted register
   contains the merchant, receipt number, date, purpose, uploader and `32.8000 SGD`.
   Page 2 retains the original-evidence rendering/identity content.
5. The PDF control was invoked from the hosted page after the date range was
   applied. The Print control was also invoked. The in-app browser does not expose
   a popup/download event for these programmatic blob actions, so a newly opened
   print window cannot be independently observed here; this is recorded as Not
   run for human visual Print acceptance rather than inferred as a pass.

| Persisted/export postcondition | Actual |
| --- | --- |
| Pack scope | One receipt, one source document, `SGD 32.8000` |
| Pack source digest | `13b3f7657a5215782b1c0b9724800dbf6d741b9ba175625eeefa8dcc568b4f2c` |
| PDF bytes / pages | 14,183,221 / 2 A4 pages |
| PDF SHA-256 | `c3fffc9c5654acd90f176e82db76b48ffc6a2129a761269c1e8ed2dfc6175c81` |
| Text read-back | Company Receipt Pack; 2026-09-11 to 2026-09-11; Coffee Demo Pte Ltd; DEMO-234-0911; 32.8000 SGD |
| Local review files | [Pack PDF](/Users/yapweijun/.codex/visualizations/2026/09/10/01a08d71-90cb-70c0-b937-77aeac6d30f5/erp-demo-review/pack-1.pdf), [source image](/Users/yapweijun/.codex/visualizations/2026/09/10/01a08d71-90cb-70c0-b937-77aeac6d30f5/erp-demo-review/source-receipt.png) |

The local review files are outside the repository and are evidence artifacts only;
they contain no credentials or provider payloads.

## Acceptance delta and limits

| TASK-202 evidence slice | Result | Boundary |
| --- | --- | --- |
| Readable source identity and Codex OCR values | Pass in Hosted Demo | Synthetic source; not production OCR/provider evidence |
| Exact Demo Pack selection, persisted totals and source digest | Pass in Hosted Demo | Same Company/actor scope; no production release claim |
| PDF byte/hash/page/text read-back | Pass | Independent local artifact inspection; renderer revision can change artifact hash |
| Browser PDF action | Pass for control invocation | In-app browser did not expose the programmatic download event |
| Human visual Print acceptance | Not run | Requires a reviewable released production artifact/window and Finance/QA verdict |
| Production readable SG/MY source replacement | Not run | Current production evidence still uses tiny synthetic sources |

This record strengthens the Demo side of the gap only. TASK-202 stays In Progress;
the next measurable exit is a released production Pack made from readable SG/MY
receipts, followed by an identified Finance/QA reviewer recording the rendered or
downloaded PDF and Print verdict.

## Commands and browser evidence

| Command / action | Environment | Result |
| --- | --- | --- |
| `sha256sum`, `file`, `pdfinfo` on retained source/PDF | Local evidence files | Source PNG 720×1080; PDF 14,183,221 bytes, 2 pages; hashes above |
| `pdftotext -layout .../pack-1.pdf -` | Local evidence file | Register text read-back contains the expected receipt and total |
| Hosted Demo date filter, Pack confirmation, PDF and Print controls | Hosted Demo / Codex IAB | One scoped Pack persisted; PDF/Print controls invoked; popup/download observation limited by tool |
| User authorization and provider boundary | Hosted Demo | No real provider account, key, model, spend or production mutation used |
| GOAL count validator; `npm run docs:check`; `git diff --check` | Root documentation state | PASS; 240 registry rows (226/6/5/3), 27/48 criteria, 36/60 checkpoints; docs checker 76 Markdown files / 781 local links |

No task registry status, GOAL criterion or execution checkpoint is promoted by this
Demo-only record. Existing candidate TASK-236 evidence and unrelated dirty worktree
changes remain untouched.

## API Print artifact boundary — 2026-09-11T18:08:36Z

- **Actor / revision / state:** Codex root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the 233-path dirty worktree and
  separate candidate/release worktrees remain preserved.
- **Expected:** an authenticated Company Receipt Pack `action=print` request must
  return the same governed PDF artifact boundary as export, with an inline
  disposition, private no-store caching, bounded hash headers and a `pdf_print`
  audit event. The source and tenant scope must remain unchanged.
- **Actual:** the isolated PGlite API fixture created one SG Pack and the print
  endpoint returned HTTP 200 `application/pdf`, `Content-Disposition: inline`,
  private no-store caching, SHA-256/source-SHA-256 headers, the original-evidence
  export purpose and a `%PDF` body prefix. The persisted audit row recorded
  `pdf_print` under `M1/C-SG` with company snapshot/current visibility.
- **Verification:** `npm test -- --run src/api/companyReceipts.integration.test.ts`
  with a bounded single-worker, 8 GiB heap and 300-second test/hook timeout passed
  **1 file / 8 tests**; the new print case passed independently in **1/1**. The
  test reads only the first PDF stream chunk and cancels the remainder, so it
  verifies the HTTP artifact boundary without retaining the large fixture body.
  No production request, provider credential, deployment or business data was used.
- **Acceptance delta:** Pack download/print response and audit semantics are now
  directly covered in the local API contract. Production readable SG/MY source
  replacement and human Finance/QA Print acceptance remain open; TASK-202 stays
  `in_progress`.

## Final documentation gate recount — 2026-09-11T18:11:54Z

- **Actor / revision / state:** Codex root `main` at HEAD
  `a4b7982bcf10ac71d709740af80dc2e79991e1c5`; the 233-path dirty worktree and
  separate candidate/release worktrees remain preserved.
- **Actual:** the exact GOAL count/dependency validator passed with registry
  `226 done / 6 in_progress / 5 todo / 3 blocked` (240 total), 27/48 goal
  criteria, 36/60 execution checkpoints, and no dependency-ready Todo.
  `npm run docs:check` passed with 79 Markdown files / 795 local links; the
  root Markdown/link review reported `8 199 0`; `git diff --check` passed.
- **Acceptance boundary:** this recount verifies documentation consistency only;
  it does not promote TASK-202 or alter registry, criterion, checkpoint or task
  status counts. Production readable SG/MY source replacement and human
  Finance/QA Print acceptance remain open.

The project KB item `24435a44-ca84-4794-a242-3d10bae8a7ab` and KB description were
updated and read back with the TASK-202 Demo boundary, current root counts and
production/human-review limits. No registry, GOAL checkbox or execution packet was
changed.
