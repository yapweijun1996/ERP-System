# Platform workspace mobile header — production release

Date: 2026-09-24

## Change

Commit `201cde537186f1fb46de0d97cad932c6f6469794` tightens the Platform workspace
header on mobile. Scrolling compacts the brand identity, preserves the page title,
Sign out and selected tenant summary, and ellipsizes long Platform user names without
horizontal overflow. The scroll thresholds use hysteresis to avoid flicker.

## Release

- `./deploy/release.sh` rebuilt and force-recreated only `api`, `web` and
  `calendar-worker` in `erp-system-production-fresh`.
- The current app configuration was compared with the running API/worker environment
  without printing secret values. A temporary link to the permission-restricted
  environment file was removed after the release; no credential was copied into the
  repository or logs.
- PostgreSQL container
  `fd2f5352ccfe6c97e243a79c862c79a7d577e69f0603a7c6efa156f25889faf6` remained
  healthy with the same identity. No migration, seed, database restart or volume
  operation ran.

## Verification

- `npm run test:e2e:platform-workspace-layout` — passed before release, including
  compact-header behavior, long-name ellipsis, no-overflow checks, selector access,
  scroll hysteresis and desktop layout matrix.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:web`, `npm run demo` and
  `npm run build:demo` — passed.
- The production API build completed successfully.
- `./deploy/release.sh` — Web-to-API health check passed; API, Web and calendar worker
  are running, and PostgreSQL remains healthy.
- `npm run verify:release -- http://127.0.0.1:18791/erp
  --expected-revision 201cde537186f1fb46de0d97cad932c6f6469794` — passed root,
  health, setup status, manifest, revision, final URL and all 126 asset hash checks.
- `npm run verify:release -- https://gmb01.xyz/erp
  --expected-revision 201cde537186f1fb46de0d97cad932c6f6469794` — passed the same
  checks, including all 126 public asset hashes.

Vite emitted the existing classic-script and large-chunk warnings; build and release
completed successfully.
