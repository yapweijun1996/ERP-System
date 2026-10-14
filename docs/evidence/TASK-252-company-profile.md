# TASK-252 Company profile local verification

Date: 2026-09-29. Target: local development Demo at `127.0.0.1:5174`.
No production database, release or hosted Company was changed.

## Result

The active Company's System Settings now show an editable legal profile:
name, registration number, tax number, address and optional raster logo.
Country, currency, tax regime and Company identifier remain read-only.
The save path uses the same scoped, versioned and audited domain command in
Demo and API mode. The logo is limited to PNG/JPEG/WebP at 256 KiB and its bytes
are omitted from audit details.

The real-browser run in `tests/e2e/company-profile.spec.mjs` passed on both
the Vite development server and the final static build preview. It completed the
first-run wizard, signed in as the Demo Company admin, edited the profile,
checked invalid SVG and oversized file feedback, uploaded a PNG, saved,
verified the PGlite row and overview response, reloaded and verified the saved
profile, then checked the 375 px view and editor. It also exercised the
required-name error and cleared the logo, verifying a second persisted version.
The browser reported zero page/console errors and no horizontal overflow at
375 px. Synthetic Demo authentication does not establish production security.

## Visual evidence

- Before: [desktop](TASK-252-company-profile-before-desktop.png), [375 px](TASK-252-company-profile-before-mobile.png).
- Codex CLI visual proposal: [SVG](../../ui/TASK-252-company-profile-proposal.svg), [proposal notes](../../ui/TASK-252-company-profile-proposal.md).
- After: [desktop view](TASK-252-company-profile-after-desktop.png), [desktop editor](TASK-252-company-profile-edit-desktop.png), [375 px view](TASK-252-company-profile-after-mobile.png), [375 px editor](TASK-252-company-profile-edit-mobile.png).

## Verification boundary

- `src/modules/admin/companyProfile.test.ts` and
  `src/api/controlPlane.integration.test.ts`: 5 tests passed, including stale
  version, tenant-spoof rejection, read/edit permission and replay.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:web`, `npm run demo`,
  `npm run build:demo`, `npm run check:production-rls` and `git diff --check`
  passed. The build retained existing classic-script and chunk-size warnings.
- Generated migration `drizzle/0118_lucky_randall.sql` and Demo SQL are local
  artifacts. A disposable PostgreSQL migration test and authenticated
  production UAT are separate from this Demo proof.
