# TASK-234 — Hosted title and Receipt upload no-override verification

Date: 2026-09-13, Asia/Singapore (observed during the Pages run after
`2026-09-13T01:15:37Z`). This record covers the authorized public Pages Demo
publication and a fresh hosted browser journey. It does not claim real-provider
OCR, production scanning, human business acceptance or G07.3 completion.

## Scope and expected result

- **Task / gap:** publish the current TASK-234 upload/title candidate, then
  verify the hosted module title and receipt capture without changing source,
  network responses, module/permission rows or database records from the
  browser.
- **Actor / environment:** Codex on local macOS using `playwright-cli` with a
  Chromium session at `https://yapweijun1996.github.io/ERP-System/`; Demo mode,
  Company Owner persona, Company `C-SG`, English, light theme. The browser
  setup-complete flag was used only to continue the seeded Demo after its UI
  reset; no application source, response, module, permission or business-table
  override was used.
- **Published source:** root `main` commit
  `d936a348e50d0b9edf7718ac1eadba1f5a17a4b6`.
- **Pages workflow:** `Deploy GitHub Pages Demo` run `34730030718`, completed
  successfully; `release.json` reports `dataMode=demo`, `fileCount=136`, and
  the same revision.
- **Expected:** the restricted Company Receipts page renders the exact visible
  title `Expenses & Tax unavailable` without literal `&amp;`; the authorized
  My Receipts surface exposes capture/upload controls, accepts a valid image,
  and retains the resulting governed state after refresh.

## Hosted result

### Module title

Using the normal signed-in Demo navigation, `window.navigate('company-receipts')`
rendered the restricted page. The read-only DOM assertion returned:

```json
{
  "route": "company-receipts",
  "title": "Expenses & Tax unavailable",
  "exactTitle": true,
  "visibleEscapedAmp": false,
  "uploadButtons": [],
  "company": "C-SG",
  "user": "admin@acme.co"
}
```

`uploadButtons=[]` is expected for the restricted Company Receipts page; upload
is provided through the governed My Receipts capture flow.

### Receipt upload

The normal My Work → My Receipts screen exposed `Take photo`, `Choose file` and
`Sync all`. The file chooser accepted the repository PNG fixture
`references/ui/aria-erp/uploads/pasted-1782352104602-0.png` (5 KB). The visible
state changed from `Offline draft 1` to `Stored securely 1`; after a browser
reload the same file row remained present with state
`Quarantined · scanner unavailable`, one page and the same 5 KB size. This is
the correct Demo boundary: capture and persistence succeeded, while no hosted
scanner service was available, so extraction/OCR and clean-scan access remain
blocked.

## Verification commands and provenance

| Command / action | Environment / revision | Result |
| --- | --- | --- |
| `git push origin main` | root `main`, `d936a348e50d0b9edf7718ac1eadba1f5a17a4b6` | pushed `976a863..d936a34` |
| `gh run watch 34730030718 --exit-status` | GitHub Actions Pages | success |
| `curl -fsSL https://yapweijun1996.github.io/ERP-System/release.json` | public Pages | HTTP 200; revision/workflow match |
| `playwright-cli -s=hosted-20260913 open …#company-receipts` | hosted Chromium | first-run UI, Demo sign-in and route navigation completed |
| read-only DOM assertion for title | hosted Chromium, `C-SG`, `admin@acme.co` | exact title; no visible `&amp;` |
| My Work → My Receipts → Choose file → Sync all → reload | hosted Chromium, same Company/persona | upload persisted as quarantined stored record |

No secret, provider key, production endpoint, network interception, source
replacement, module/permission mutation or direct database write was used.
The repository worktree retained its pre-existing dirty files and no unmerged
paths.

## Acceptance boundary and next exit

This closes the hosted publication/title/upload visibility gap for the Demo
surface. It does not close G07.3: hosted Demo scanning reports
`scanner unavailable`, and the real provider account/model/region/retention,
production OCR and human Finance/QA Pack/Print acceptance are still absent.
Task and goal counts remain unchanged (`TASK-234 in_progress`, G07 `3/4`,
S5 `5/5`). The next measurable exit is an approved real-provider run with
sanitized usage evidence and an independently recorded business acceptance of
the persisted Pack and artifact.
