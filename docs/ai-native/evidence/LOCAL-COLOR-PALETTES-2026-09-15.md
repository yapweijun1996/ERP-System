# Local and public colour-palette release evidence — 2026-09-15

## Scope

- **Actor:** Codex
- **Application revision:** `5dcc15b` (`Add setup color palette preferences`)
- **Environment:** local Docker Demo (`erp-system-demo-1`, port `8081`) and the public Demo proxy at [`https://gmb01.xyz/erp/`](https://gmb01.xyz/erp/)
- **Worktree:** `main`, 16 commits ahead of `origin/main`; the only remaining untracked file is the unrelated pre-existing `docs/ai-native/evidence/LOCAL-DOCKER-DEMO-2026-09-14.md`.
- **Data boundary:** browser-local presentation preferences only. No production PostgreSQL data, tenant rows, API credentials or provider keys were changed.

## Expected result

The setup Language screen should offer a compact, accessible colour-palette chooser next to the existing background-style chooser. A selected palette should update the accent, action and focus tokens across light and dark themes, remain available in Settings, and preserve the existing seven-step wizard and Finish protection.

## Actual result

- Six fixed palettes are available: Aria Blue, Royal Purple, Ruby Red, Sunflower Amber, Forest Green and Ocean Teal.
- Each option is an accessible radio control. Selecting Royal Purple in the five-viewport E2E updates `data-palette`, the computed `--accent` token and `aria-checked`, then the test restores Aria Blue.
- Palette tokens include accent, action, hover, tint, soft and border values; light/dark values are selected from the active theme. Existing device-local accent swatches remain a custom fallback for Settings.
- The same palette catalog is rendered by Settings, and legacy palette names are normalized for existing browser preferences.
- The seven-step rail remains unchanged and Finish setup was not clicked.
- `npm run test:e2e:setup-wizard` passed desktop, split-pane, reported-pane, iPhone and small-mobile viewports.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:web`, `npm run demo` and `npm run build:demo` passed. `git diff --check` and the GOAL count validator passed.
- Docker rebuild completed with the palette code. `erp-system-demo-1` is healthy and `http://127.0.0.1:8081/health` returned `ok`.
- Public `https://gmb01.xyz/erp/health` returned `ok`; public `release.json` reports revision `5dcc15b`; public HTML contains `color-palette-v1`; public `sw.js` reports `erp-system-pwa-v277`.

## Remaining boundary

Palette and background selections remain browser-local presentation preferences. Company-wide defaults and authenticated per-employee overrides are **not** claimed as complete because the current schema/API do not define an authorized preference contract. The unblock owner is the ERP platform/data-architecture and backend role: define scoped fields/routes, permission rules, migration, fallback precedence and Demo/PGlite/PostgreSQL parity before server persistence is enabled.

## Source and test references

- [`docs/SETUP_WIZARD.md`](../../SETUP_WIZARD.md)
- [`docs/PROJECT_LOGIC.md`](../../PROJECT_LOGIC.md)
- [`docs/STATUS.md`](../../STATUS.md)
- [`tests/e2e/setup-wizard-layout.spec.mjs`](../../../tests/e2e/setup-wizard-layout.spec.mjs)
