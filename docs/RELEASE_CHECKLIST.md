# Release Checklist

Two independent release paths from one repo — run the shared gate first, then the
section for the path you are releasing. Deployment mechanics live in
[DEPLOYMENT.md](DEPLOYMENT.md); this file is the go/no-go checklist.

## 0. Shared gate (every release, either path)

- [ ] Working tree clean, on `main`, latest CI run green (CI already runs everything
      below on each PR — re-running locally is belt-and-braces for a release cut).
- [x] `npm run typecheck && npm run typecheck:web` — root and Web typechecks pass after
      aligning the Demo purchase-requisition adapter with the actor-input command shape.
- [x] `npm test` — the 2026-08-12 current-worktree full run passes 168 files plus 1
      skipped file (663 passed, 1 skipped tests) in 1304.96 seconds. Expected malformed
      JSON and failed-locale test diagnostics were emitted by their negative-path tests.
- [x] `npm run demo` — PGlite transaction proof passed on 2026-08-10. A dedicated,
      disposable PostgreSQL 16 database also passed `POSTGRES_URL=... npm run demo`,
      including cross-engine parity and the true-concurrency race. The preflight
      rejects any user table before writes; the temporary database was removed after
      verification.
- [x] `npm run test:postgres` — the non-superuser PostgreSQL security/integration suite
      passed against the same disposable PostgreSQL 16 proof database on 2026-08-10.
      This is disposable-environment evidence, not target-production deployment proof.
- [x] `npm run check:demo-schema && npm run check:drift` — passed on 2026-08-10;
      generated PGlite artifacts and all Drizzle migrations agree
- [x] `npm run build:demo` — serial build passed on 2026-08-10; a parallel attempt raced
      on the shared `web/dist` output and is not a source failure.
- [x] `npm run smoke` — desktop and mobile pass on 2026-08-10. The navigation assertion
      checks visible semantic badges; hidden zero-count badges remain in the DOM.
- [x] `npm run audit:screens` — all current 128 routes at desktop + 375 px, zero
      console errors, 128 Canonical / 0 Preview, and no route, maturity, active-tab,
      layout or action contract failures in the 2026-08-10 run.
- [x] `npm run audit:pwa-update` — PWA update lifecycle audit passes; physical-device
      acceptance remains TASK-017 and is not satisfied by emulated 375 px.
- [x] `npm run audit:i18n` — the current canonical resources contain 1,545 keys / 72
      local five-language packs; the full desktop matrix and targeted desktop/mobile
      post-fix route checks pass. The latest CI validate job could not start because of
      GitHub Actions account billing.
- [x] `npm run check:permissions` and `npm run audit:access-matrix` — the permission
      registry check passes (314 codes; 116 resources; 62 actions; 5 updates), and the
      serial access-matrix audit passes (58 canonical route contracts × 12 role
      templates; 128 registered screens fail closed). The first parallel build attempt
      raced on shared `web/dist`; serial execution is the release evidence.
- [x] `tasks/tasks.jsonl` statuses current: TASK-189–192 are done and TASK-017/TASK-193
      are blocked. The task index plus `docs/STATUS.md` record the deployment, backup,
      reset and missing-SMTP evidence; the CI billing limitation is explicit.
- [x] 2026-08-12 current-worktree secret baseline: the tracked diff and `web/dist`
      contain no known provider/token/private-key signature; high-entropy diff strings
      were classified as document, route, module, DOM/i18n or deterministic-test values.
      `.env.example` contains no such signature and tracked `.env` files are excluded.
      Re-run this check immediately before any release; it is not a substitute for a
      repository-hosted secret scanner or production credential rotation.

## 1. Demo path (static bundle → public showcase)

Current reality: this repo is **private** and `deploy-pages.yml` is intentionally
disabled (see STATUS.md — the demo will ship from a separate public repo that
contains only the built `web/dist/`). Until that repo exists, a "demo release" means
producing and verifying a distributable `web/dist/`.

- [ ] `web/public/sw.js` `CACHE_VERSION` bumped **if** any precached asset was
      added/removed/renamed this release (stale-SW symptom: reused tabs serve old JS)
- [ ] `npm run build:demo` output boots in a **fresh browser profile** (empty
      IndexedDB): setup wizard appears, completing it seeds and lands on the
      dashboard, `window.ErpSystemData.mode` is `pglite` (not `fallback`)
- [ ] Upgrade path: a profile holding the **previous** release's IndexedDB boots the
      new bundle and migrates (console shows `upgraded persistent PGlite schema`),
      no reset required
- [ ] PWA update prompt appears on the reused profile and "Update now" reloads onto
      the new version
- [ ] Spot-check at 375 px on at least dashboard + one Canonical write flow
- [ ] If publishing to the public demo repo: copy `web/dist/` only — no source, no
      `.env*`, no docs beyond what's intended to be public

## 2. Production path (Docker Compose)

- [ ] `.env` prepared from `.env.example` on the target host (never committed);
      DB credentials are not defaults
- [x] **Backup first**: snapshot the `pgdata` volume / `pg_dump` before touching a
      running deployment — the pre-deploy and post-deploy dumps are the rollback points
- [x] Build + start: `./deploy/release.sh` rebuilt and replaced only the application
      containers; PostgreSQL was preserved for the pre-reset verification.
- [x] Migrations: `CONFIRM_DATABASE_CHANGE=YES ./deploy/migrate.sh` applied all committed
      migrations through 0098; production RLS was re-applied and no production seed was
      run.
- [x] TASK-175 cutover: backup first, migration 0089, Owner/legacy-assignment
      invariants and application-only release were verified on the target Compose DB.
- [x] Health: Compose services are healthy; local and public `/health` return 200 and the
      public root returns 200.
- [x] Auth/setup sanity: pre-reset counts remained usable, legacy setup returned 410 and
      non-empty public bootstrap returned 409; after reset `GET /api/setup/status` returns
      `requiresPlatformBootstrap: true` with no Master/Company/tenant admin and the
      Platform registration page is visible.
- [ ] One write-path probe in api mode (e.g. confirm a draft sales order) succeeds
      and posts balanced GL — stock/money writes never execute client-side
- [ ] Rollback plan confirmed before you walk away: previous image tags still
      available; restore = `make down` → restore volume/backup → start previous
      images. `make reset` is DESTRUCTIVE (wipes the volume) — never run it on a
      host with real data

## 3. After either release

- [ ] Tag or record the released commit hash
- [x] Note the release (and manual backup/migration/RLS steps) in the task done-note,
      `STATUS.md` and `DEPLOYMENT.md` so the next session inherits the context

## 4. Expenses & Tax v1 release gate (planned)

TASK-181 evidence now covers immutable complete-result Pack snapshots, mixed-currency
PDF composition and dedicated Demo-browser Preview/download/Print. TASK-182 entitlement
parity is complete. TASK-183 proves the confirmation UI and actual PGlite clean-evidence
persistence with a test-worker scan completion, plus authenticated confirmation-through-
Print browser journeys at desktop and 375px in both same-origin API/PGlite and a newly
created disposable PostgreSQL 16 database. The 2026-08-12 serial Vitest gate passes 168
files / 663 tests with one expected skip in 959.19 seconds. This verification does not
authorize production deployment.

- [x] TASK-177–183 are done; STATUS and KB state implementation rather than intent.
- [x] Company Receipts capture/confirm/save/refresh/search/range/preview/PDF/Print pass
      in Demo preview and PostgreSQL/API mode, including every matching pagination page.
- [ ] Cross-tenant, own/company scope, disabled module, unauthorized export, stale
      version, duplicate hash, Missing Date and mixed-currency cases fail safely.
- [ ] JPEG/PNG/HEIC/PDF validation, quarantine/OCR failure and readable multi-page PDF
      output pass without losing the original.
- [x] Five languages, 1440 × 900, 390 × 844 and canonical 375 px audits pass with zero
      unexpected console errors or page overflow.
- [ ] Deployment is reported separately and occurs only after explicit authorization;
      completion of TASK-176 documentation is not a production release.

## 5. EPIC-065 Platform Bootstrap and reset gate

- [x] Source/API focused proof: empty bootstrap, concurrent winner, setup status stages,
      independent platform cookies, Master/Company idempotency, Master Admin negative
      permissions and Company Owner MAC denial.
- [x] Migration/generated-artifact proof: migration 0098, PGlite schema version 98,
      `check:demo-schema`, `check:drift`, permission registry, root/Web typecheck, lint
      and API/Demo builds pass.
- [x] Push the scoped commits; all four Vitest CI shards passed. The validate job was
      blocked before startup by GitHub Actions account billing, which is recorded rather
      than treated as a test pass.
- [x] Apply 0098/RLS and verify existing data remains usable, health is 200 and public
      bootstrap rejects non-empty data.
- [x] Create UTC PostgreSQL custom dumps, validate `pg_restore --list`, perform an
      isolated restore rehearsal, archive document storage and retain the prior backup.
- [x] Stop Compose, delete only `erp-system_pgdata` and `erp-system_document_storage`,
      recreate/migrate/RLS with no seed, verify empty tables/storage/schema/RLS and leave
      the site on Create Platform Superadmin without creating a real account.
- [x] Record final reset evidence in TASK-192/STATUS/DEPLOYMENT/PROJECT_LOGIC and the
      existing KB item; leave TASK-193 blocked while SMTP is unset.
