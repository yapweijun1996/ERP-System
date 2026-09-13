# TASK-225 setup wizard scroll and persistent navigation recheck — 2026-09-13

## Scope

- **Task:** TASK-225, fit the first-run Language step while keeping longer setup
  steps reachable.
- **Revision:** `7bdefcc8f65814f2c382f328a1641d3e2222c877` (`main`).
- **Source:** `web/public/assets/erp.css` SHA-256
  `83e400b8f662f2ccc28d74203a756a663f30b8e05f0ef845332e368abf8a6a18`.
- **Environment:** local macOS Demo build and Vite preview; Playwright Chromium;
  no API, PostgreSQL, provider, deployment or external notification.
- **Actor:** Codex, 2026-09-13 Asia/Singapore.
- **Worktree:** the root checkout was already dirty with 34 status paths before
  this evidence append; the index was empty and unrelated worktrees were left
  untouched. This file is a new untracked evidence artifact.

## Expected result

The Language step should fit on one page at the supported desktop, split-pane and
phone sizes without document or panel overflow. On longer steps, only
`#wizStepBody` should scroll; the brand bar, progress rail and Back/Continue
savebar must remain visible, the panel itself must not scroll, and a focused final
control must be brought into the content viewport.

## Verification

Command:

```text
npm run test:e2e:setup-wizard
```

The command rebuilt the static Demo and ran
`tests/e2e/setup-wizard-layout.spec.mjs`. It passed at all five configured
viewports:

- desktop 1280x900
- split-pane 753x837
- reported-pane 603x837
- iPhone 390x844
- small-mobile 375x812

The test also exercised the long Module Activation step at 1280x900, 603x837,
390x844 and 603x420. Each run proved positive body scroll range, zero panel and
document horizontal overflow, zero panel scroll, stable header/footer positions,
and visibility of the focused final input inside the scrolling body. The compact
Language step retained all five language cards, Continue and the seven-marker
single-row progress rail.

## Result and boundary

The existing layout implementation is source-complete for this local acceptance
slice: the wizard panel clips its decoration, `#wizStepBody` owns vertical
scrolling, and the navigation regions remain outside that scroll container. No
CSS or JavaScript source change was required in this recheck, so registry,
criterion and checkpoint counts remain unchanged. The build emitted the existing
classic-script, missing-static-asset, PGlite externalization/eval and large-chunk
warnings but exited successfully. This record is local Demo evidence only; it
does not establish physical-device, hosted or production acceptance.
