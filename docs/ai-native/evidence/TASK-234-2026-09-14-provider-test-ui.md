# TASK-234 provider connection-test UI evidence — 2026-09-14

## Identity and scope

- Task / goal: TASK-234 / G07 supporting Demo and contextual-UI repair.
- Date and source revision: 2026-09-14 / `3d85546` (`Refine setup review module summary`).
- Dirty worktree baseline: the pre-existing untracked `docs/ai-native/evidence/LOCAL-DOCKER-DEMO-2026-09-14.md` was preserved; no unrelated file was staged.
- Environment: public hosted Demo at `https://gmb01.xyz/erp/`, served by the rebuilt local Docker Demo through the authorized tunnel.
- Actor and scope: Codex browser actor, public Demo setup wizard; no business Company write and no Finish action.
- Intended outcome: give every AI provider a clear, explicit connection-test action and add stable spacing between provider fields, actions and status feedback.
- Exclusions: no provider credential was entered; no production provider, server AI configuration, or tenant data was changed.

## Expected versus actual

| Scenario | Expected | Actual | Result |
| --- | --- | --- | --- |
| Demo Gateway selected | Test button is visible; a ready session can be tested without a key | `Test connection` returned `Connection successful.`; the temporary session remained page-scoped | Pass |
| OpenAI selected without a key | Testing is blocked with a clear credential message | `Enter an API key before testing this provider.` | Pass |
| Provider layout | Provider/key fields and test status have consistent vertical spacing | Computed field gap `18px`, action margin `16px`, status min-height `20px` | Pass |
| Cache refresh | The browser can receive the updated provider-test script | Public HTML serves `screens-setup-wizard.js?v=20260914-review-summary-v1`; service worker is `erp-system-pwa-v272` | Pass |
| Review summary with many modules | The Active modules label stays readable while the selection can wrap | Selected module names render as independent chips; the label remains one line on desktop and the row stacks on small screens | Pass |

## Verification

Commands and results:

- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm run typecheck:web` — pass.
- `npm run build:demo` — pass; existing Vite legacy-script, externalized-nodefs and large-chunk warnings only.
- `npm run docs:check` — pass: 139 Markdown files / 905 local links.
- GOAL count validator — pass: 227 done / 13 pending / 240 total; 35/48 criteria; 44/60 checkpoints; no dependency-ready Todo.
- `git diff --check` — pass.
- `curl https://gmb01.xyz/erp/health` — HTTP 200, body `ok`.
- `curl https://gmb01.xyz/erp/sw.js` — `erp-system-pwa-v272`.
- `npm run test:e2e:setup-wizard` — pass for desktop, split-pane, reported-pane, iPhone and small-mobile (375px) viewports.

Browser verification used Chrome at the public Demo. The wizard was advanced through AI optional (step 6) and then Review and finish (step 7), stopping at the visible `Finish setup` button. The browser accessibility tree confirmed the test button, Demo success state and OpenAI no-key guard. With eight modules selected, the Active modules row rendered eight chips, kept the label at one line (`17.55px` height), used a grid row and had zero horizontal overflow. The final browser log had no errors or warnings.

This is supporting UI evidence only. It does not check any G07 criterion or S-checkpoint and does not close TASK-234's separate real-provider/OCR, production, or human-acceptance gates.

## Admin setup spacing and mobile shell verification — 2026-09-15

- Source revision: `40f29c2f0f8ebec30f868f88d66168722a4a5a4c` (`Anchor wizard shell during step changes`).
- Environment: public hosted Demo at `https://gmb01.xyz/erp/`, rebuilt from the local Docker Demo; release manifest reports `dataMode=demo`, `fileCount=134`, and the same revision. The public health route returned `ok`.
- Actor and scope: Codex browser actor using synthetic Demo values only; no provider credential, business record or Finish action was used. The generated password was never recorded.

| Viewport | Expected | Actual | Result |
| --- | --- | --- | --- |
| iPhone 390×844 | Brand bar and footer remain visible; content owns scrolling | Outer wizard scroll `0`, inner step scroll `0`, header `top=39`, footer `bottom=811`, document overflow `0` | Pass |
| Tablet 603×837 | Same fixed shell and field rhythm | Outer wizard scroll `0`, header `top=45`, footer `bottom=798`, document overflow `0` | Pass |
| Desktop 1280×900 | Same spacing without overflow | Outer wizard scroll `0`, header `top=115`, footer `bottom=793`, document overflow `0` | Pass |

Admin form measurements were `10px` after the intro copy, `10px` between all five fields and `12px` before the action row. The visible controls are `Generate secure password`, `Copy credentials` and `Download credentials`. The generator filled matching password and confirmation values and returned `A secure password was generated.`; the focused E2E assertion verifies a 20-character value without persisting or reporting it. Continuing with synthetic username/email values reached Modules, proving the generated credential passes the step validation.

The root cause of the clipped mobile brand bar was the outer wizard retaining a scroll offset when a focused navigation button was replaced during step render. `render()` now resets the outer shell to `scrollTop=0`; the existing `wizStepBody` remains the only scrolling region and preserves its own position for module selection. Public HTML serves `admin-spacing-v3` assets and service worker `erp-system-pwa-v275`. Chrome console errors and warnings were empty during the public check.

Verification: `npm run lint`, `npm run typecheck`, `npm run typecheck:web`, `npm run test:e2e:setup-wizard` (desktop, split-pane, reported-pane, iPhone and small-mobile), `npm run build:demo`, `git diff --check`, public health/release probes, and responsive browser checks all passed. Existing Vite legacy-script, PGlite externalization/eval and large-chunk build warnings remain informational only.
