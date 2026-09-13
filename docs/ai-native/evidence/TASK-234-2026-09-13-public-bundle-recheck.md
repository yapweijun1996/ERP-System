# TASK-234 — Public Pages bundle recheck

Date: 2026-09-13, Asia/Singapore (observed at `2026-09-12T23:40:39Z`).
This is a read-only publication and source-identity record. It does not claim
Pages deployment, real-provider OCR, production data, human acceptance or a
change to the G07 counts.

## Scope and expected result

- **Task / gap:** TASK-234 publication of the current My Receipts upload and
  module-title repairs.
- **Actor / environment:** Codex on local macOS; public Pages origin
  `https://yapweijun1996.github.io/ERP-System/`; no credentials, uploads,
  production writes or external communication were used.
- **Local source:** root `main` HEAD
  `52720f70f5d941ddc31e7722a8637086c1fbe209`; title repair commit
  `751fa273ce66368ec8495cf30284bb15874bf62f`; My Receipts envelope repair
  commit `5e983e9bd88a1d2bb4f0d25695d1a61f2d6a167b`.
- **Expected:** the public release manifest identifies the reviewed candidate,
  `assets/app.js` contains the current escaped module-title implementation,
  and `assets/screens-hr.js` unwraps the `{data, meta}` work-context response
  before reading `capabilities.receipts`.

## Read-only result

`release.json` returned HTTP 200, SHA-256
`6a6d2f97b27acc7373beb233e97d9b496204ec8fa19adb904634c0db944413fb`, with:

```json
{
  "repository": "yapweijun1996/ERP-System",
  "revision": "976a863eabcb8f1499308a64dac646146ed44b6e",
  "workflowRunId": "34689661151",
  "builtAt": "2026-09-12T10:55:40.348Z",
  "dataMode": "demo",
  "fileCount": 136
}
```

The deployed revision is older than the current root and does not contain the
reviewed source repairs:

- Public `assets/app.js` is 101,035 bytes with SHA-256
  `883f4fb8abfcf1ebc14ef57959d4c4988e1c9fb0a04bcee478a0fb13f77de96e`.
  Its `moduleBlockedPanel` still emits
  `` `${t("access.moduleUnavailable",{module:r})}` `` and the current
  `const title=esc(...replace('{module}', label))` marker is absent.
- Public `assets/screens-hr.js` is 328,632 bytes with SHA-256
  `9205f2e5750dcad976bd70fe03d175d49845823890f946e0f032cb7132075b57`.
  The My Receipts path reads `d.capabilities.receipts` directly and has zero
  `contextResponse.data` occurrences.
- Public `assets/erp.css` is 54,624 bytes with SHA-256
  `83e400b8f662f2ccc28d74203a756a663f30b8e05f0ef845332e368abf8a6a18` and
  retains the wizard scroll/sticky rules. This confirms that the layout fix is
  present in the public bundle, while the application and capability fixes are
  from an earlier source set.

For comparison, the current local source hashes are `579f8d5bd8f4ef51ff03a940a2a4a15421118801e0137c61007088131ad0b5e5`
(`app.js`) and `dbbae4918eb0e73c254f6e6fcc4fcc4fb5f0591007c0c4409541065ff25ab5b4`
(`screens-hr.js`), and contain the reviewed markers. The separate production
ingress health endpoint `https://gmb01.xyz/erp/health` returned `status=ok`
for revision `03487b13ce838407d97cd00697bd2b54b4a7c918`; that health fact does
not identify or publish the Pages bundle.

## Acceptance boundary and next exit

This recheck confirms a publication gap with immutable release evidence. It
does not prove that a visible public title currently renders a literal
`&amp;`; a browser DOM assertion remains part of the post-publication check.
TASK-234 remains **In Progress** with the local title/upload repairs verified
and the public no-override journey open.

The next measurable exit is for the release owner to publish the reviewed
candidate through the main-only Pages workflow, then run a fresh no-override
browser check for the localized module title and authorized My Receipts upload
controls. Real-provider, production OCR and business Print acceptance remain
separate gates.

Repository state at capture: 34 preserved dirty paths, empty index and no
unmerged paths. No reset, merge, deployment or secret was used.

## Remote/public alignment recheck — 2026-09-13

At `2026-09-13T00:49:29Z`, a read-only `git fetch --prune origin` confirmed
that `origin/main` is `976a863eabcb8f1499308a64dac646146ed44b6e`, exactly the
revision reported by the public `release.json`. The current local `main` is
`56ee920e7c6e71e73c88278d4b67fece8c7e6452`; its source contains the reviewed
title and My Receipts capability repairs, while the public assets do not.
The expected handoff is therefore an authorized publication of the reviewed
candidate followed by the no-override browser check. No push, deployment,
production write, credential or external notification was performed. The root
worktree remained unmerged with 37 preserved dirty paths.
