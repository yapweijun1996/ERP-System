# TASK-234 provider connection-test UI evidence — 2026-09-14

## Identity and scope

- Task / goal: TASK-234 / G07 supporting Demo and contextual-UI repair.
- Date and source revision: 2026-09-14 / `f6f5e43` (`Refresh setup provider cache version`).
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
| Cache refresh | The browser can receive the updated provider-test script | Public HTML serves `screens-setup-wizard.js?v=20260914-provider-test-v2`; service worker is `erp-system-pwa-v271` | Pass |

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
- `curl https://gmb01.xyz/erp/sw.js` — `erp-system-pwa-v271`.

Browser verification used the existing Chrome tab at the public Demo. The wizard was advanced through AI optional (step 6) and stopped there. The browser accessibility tree confirmed the test button, Demo success state and OpenAI no-key guard. No console errors were observed during this verification; older cached i18n fallback warnings remained in the historical browser log and were not produced by the final interaction.

This is supporting UI evidence only. It does not check any G07 criterion or S-checkpoint and does not close TASK-234's separate real-provider/OCR, production, or human-acceptance gates.

