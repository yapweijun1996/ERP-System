# TASK-234 — Merged hosted title and Receipt upload no-override verification

Date: 2026-09-13, Asia/Singapore (observed 2026-09-13 18:18–18:22 local).
This record verifies the authorized Pages publication of the merged candidate and
a fresh hosted Demo browser journey. It does not claim real-provider OCR,
production scanning, human business acceptance or G07.3 completion.

## Identity and boundary

- **Task / gap:** verify the merged candidate's hosted module title and normal
  My Receipts upload flow without changing source, network responses,
  module/permission rows or business-table records from the browser.
- **Actor / environment:** Codex on local macOS using `playwright-cli` with a
  fresh Chromium session `hosted-merge-20260913` at
  `https://yapweijun1996.github.io/ERP-System/`; Demo mode, Company Owner
  persona, Company `C-SG`, English, light theme. The normal first-run setup,
  one-click Demo persona and application controls were used; no source,
  response, permission, module or business-table override was used.
- **Published source:** merged `origin/main` revision
  `a67595d5b67d24d6dfcc02b0c04f89c0e6c391ae` (PR #3 merge commit).
- **Pages workflow:** `Deploy GitHub Pages Demo` run `34751369035`, completed
  successfully; `release.json` returned HTTP 200 with the same revision,
  `dataMode=demo`, workflow `34751369035` and `fileCount=136`.
- **Root worktree:** retained its pre-existing dirty/untracked documentation
  and evidence files; no reset, checkout or unrelated overwrite was used.

## Expected and actual results

### Company Receipts title

The normal signed-in navigation rendered one `h1` with exact text
`Expenses & Tax unavailable`; the page body contained no literal `&amp;`.
The read-only browser assertion returned:

```json
{
  "url": "https://yapweijun1996.github.io/ERP-System/#company-receipts",
  "h1": ["Expenses & Tax unavailable"],
  "escapedAmp": false
}
```

### Receipt upload

My Work → My Receipts exposed `Take photo`, `Choose file` and `Sync all`.
The repository PNG fixture
`references/ui/aria-erp/uploads/pasted-1782352104602-0.png` (5,019 bytes)
was selected through the normal file input. The row changed from `Offline draft
1` to `Stored securely 1`; after reload it remained one 5 KB row with state
`Quarantined · scanner unavailable`, one page and the same filename. This is the
expected Demo boundary: capture and persistence are available while extraction
and OCR stay blocked when no scanner service is configured.

The browser console query returned zero errors and zero warnings. No network
interception, source replacement, permission mutation, module mutation or
business-table write was performed by the browser run.

## Verification provenance

| Command / action | Environment / revision | Result |
| --- | --- | --- |
| `gh run view 34751369035 --json status,conclusion,headSha` | GitHub Actions Pages | `success`; `headSha=a67595d…` |
| `curl`/Python GET `https://yapweijun1996.github.io/ERP-System/release.json` | public Pages | HTTP 200; revision/workflow match; Demo; 136 files |
| `playwright-cli -s=hosted-merge-20260913 open …#company-receipts` | hosted Chromium | normal setup, Demo sign-in and route navigation completed |
| read-only DOM assertion | hosted Chromium, C-SG, Avery Tan | exact title; no visible `&amp;` |
| My Work → My Receipts → Choose file → Sync all → reload | hosted Chromium, same Company/persona | upload persisted as quarantined stored record |
| `playwright-cli … console error` | same hosted session | 0 errors, 0 warnings |

## Acceptance boundary and next exit

This closes the merged candidate's hosted Demo publication/title/upload
visibility gap. It does not close G07.3 or TASK-234: scanner availability,
real provider account/model/region/retention, production OCR and human
Finance/QA Pack/Print acceptance remain absent. Task and goal counts are
unchanged. The next measurable exit is an approved real-provider run with
sanitized usage evidence plus independent business acceptance of the persisted
Pack and artifact.
