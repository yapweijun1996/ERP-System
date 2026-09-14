# Local and public background-style release evidence — 2026-09-15

## Scope

- **Actor:** Codex
- **Application revision:** `82f3054` (`Add selectable setup background styles`)
- **Environment:** local Docker Demo (`erp-system-demo-1`, port `8081`) and the public Demo proxy at [`https://gmb01.xyz/erp/`](https://gmb01.xyz/erp/)
- **Worktree:** `main`, 15 commits ahead of `origin/main`; the only remaining untracked file is the unrelated pre-existing `docs/ai-native/evidence/LOCAL-DOCKER-DEMO-2026-09-14.md`.
- **Data boundary:** browser-local Demo UI only. No production PostgreSQL data, tenant rows, API credentials or provider keys were changed.

## Expected result

The first Language screen should provide a compact, accessible chooser for the fixed background styles. Choosing a style should apply it immediately to sign-in, setup and the current workspace, remain usable at supported desktop/tablet/mobile widths, and be available later from Settings.

## Actual result

- Four fixed styles are available: Aurora, Mist, Paper and Night sky.
- Each option is an accessible radio control with a localized label/description; the selection updates the document background without re-rendering the wizard or losing scroll/focus.
- The seven-step setup rail remains unchanged. The chooser is part of the Language step so existing setup contracts and Finish protection are preserved.
- Settings exposes the same browser-local preference. The preference is not persisted to the company or employee database.
- `npm run test:e2e:setup-wizard` passed all five configured viewports (desktop, split-pane, reported-pane, iPhone and small-mobile), including the four-option/selection assertions.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:web`, `npm run demo`, `npm run build:demo` and `npm run docs:check` passed. `git diff --check` passed.
- Local Docker health returned `ok`; public `https://gmb01.xyz/erp/health` returned `ok`.
- Public `release.json` reports revision `82f3054`; the public HTML contains the `background-picker-v1` asset versions and the public Service Worker reports `erp-system-pwa-v276`.

## Remaining boundary

Company-wide defaults for all employees and authenticated per-employee overrides are **not** claimed as complete. The current schema and API do not define an authorized background-preference contract for `company`/`app_user`, and adding one requires an owner-approved cross-tenant design plus Demo/PGlite/PostgreSQL parity. The unblock owner is the ERP platform/data-architecture and backend role: define the scoped fields/routes, permission rules, migration and fallback precedence, then add source-backed tests before enabling server persistence.

The setup flow was not completed and the Finish setup action was not clicked.

## Source and test references

- [`docs/SETUP_WIZARD.md`](../../SETUP_WIZARD.md)
- [`docs/PROJECT_LOGIC.md`](../../PROJECT_LOGIC.md)
- [`docs/STATUS.md`](../../STATUS.md)
- [`tests/e2e/setup-wizard-layout.spec.mjs`](../../../tests/e2e/setup-wizard-layout.spec.mjs)
