# Release Checklist

Two independent release paths from one repo — run the shared gate first, then the
section for the path you are releasing. Deployment mechanics live in
[DEPLOYMENT.md](DEPLOYMENT.md); this file is the go/no-go checklist.

## 0. Shared gate (every release, either path)

- [ ] Working tree clean, on intended release commit, and latest CI actually executes
      green. Never treat a zero-step infrastructure failure as validation.
- [x] `npm run typecheck && npm run typecheck:web` — root and Web typechecks pass after
      aligning the Demo purchase-requisition adapter with the actor-input command shape.
- [ ] `npm test` — current HEAD collects 170 files / 666 tests but TASK-194 did not run
      the full collection. The 168-file/663-test result is a dated earlier checkpoint.
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
- [ ] `npm run audit:screens` — current source is 129 Canonical / 0 Preview. TASK-183 has
      dated 129-route evidence; install Chromium and rerun HEAD before release.
- [x] `npm run audit:pwa-update` — PWA update lifecycle audit passes; physical-device
      acceptance remains TASK-017 and is not satisfied by emulated 375 px.
- [ ] `npm run audit:i18n` — static resources pass at 1,545 keys / 72 packs; rerun the
      full 129 × 5 × 2 browser matrix for current HEAD.
- [ ] `npm run check:permissions` and `npm run audit:access-matrix` — permission registry
      passes at 314/116/62/5. Current source inventory is 59 routes × 13 active templates;
      rerun the serial browser access audit before release.
- [x] `tasks/tasks.jsonl` statuses current: 192 Done / 0 In progress / 10 Todo / 3
      Blocked / 205 Total. Blockers are TASK-017, TASK-193 and TASK-203.
- [ ] GitHub Actions actually executes current HEAD. Run `31603746668` started zero jobs
      due account billing/spending; TASK-203 is not a green CI result.
- [x] 2026-08-12 current-worktree secret baseline: the tracked diff and `web/dist`
      contain no known provider/token/private-key signature; high-entropy diff strings
      were classified as document, route, module, DOM/i18n or deterministic-test values.
      `.env.example` contains no such signature and tracked `.env` files are excluded.
      Re-run this check immediately before any release; it is not a substitute for a
      repository-hosted secret scanner or production credential rotation.

## 1. Demo path (static bundle → public showcase)

Current reality: this public repo publishes the static Demo through `deploy-pages.yml`
at `https://yapweijun1996.github.io/ERP-System/`. The workflow contains only the
PGlite/IndexedDB Demo bundle; production remains the separate Docker/API/PostgreSQL
track.

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
- [ ] Pages artifact contains `web/dist/` only — no `.env*`, production API endpoint,
      database connection string or provider credential

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
- [ ] Current health: TASK-192 recorded healthy Compose/public probes, but TASK-194 public
      `/health` and setup probes returned 502. TASK-199 must restore and reverify.
- [x] Auth/setup sanity at the TASK-192 checkpoint: pre-reset counts remained usable,
      legacy setup returned 410 and non-empty public bootstrap returned 409; after reset
      `GET /api/setup/status` returned `requiresPlatformBootstrap: true` with no
      Master/Company/tenant admin and the Platform registration page was visible.
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

## 4. Expenses & Tax v1 release and hardening gate

TASK-181 evidence now covers immutable complete-result Pack snapshots, mixed-currency
PDF composition and dedicated Demo-browser Preview/download/Print. TASK-182 entitlement
parity is complete. TASK-183 proves the confirmation UI and actual PGlite clean-evidence
persistence with a test-worker scan completion, plus authenticated confirmation-through-
Print browser journeys at desktop and 375px in both same-origin API/PGlite and a newly
created disposable PostgreSQL 16 database. The 168-file/663-test result is dated.
TASK-192 later deployed through 0098 and reset production; no authenticated production
receipt UAT is claimed.

- [x] TASK-177–183 are done; STATUS and KB state implementation rather than intent.
- [x] Company Receipts capture/confirm/save/refresh/search/range/preview/PDF/Print pass
      in Demo preview and PostgreSQL/API mode, including every matching pagination page.
- [ ] Pack downgrade and export authority: a creator losing `read_company` cannot read or
      render an old company-wide Pack; cross-tenant/revoked-read cases pass (TASK-196).
- [ ] Read-only UI hides create/edit/void; real detail, Missing Date correction, update,
      void and bounded Employee-independent-or-explicit picker behavior pass (TASK-197).
- [ ] JPEG/PNG/HEIC/PDF validation, quarantine/OCR failure and readable multi-page PDF
      output pass without losing the original.
- [x] Five languages, 1440 × 900, 390 × 844 and canonical 375 px audits pass with zero
      unexpected console errors or page overflow.
- [ ] Unicode/localized PDF, Decimal-safe amount display, Company-calendar presets,
      concurrent packKey and Pack retention/legal-hold lifecycle pass (TASK-202).
- [ ] Authenticated production scanner/storage/receipt UAT is recorded separately from
      disposable fixtures and the reset checkpoint.

## 5. EPIC-065 Platform Bootstrap and reset gate

- [x] Source/API focused proof: empty bootstrap, concurrent winner, setup status stages,
      independent platform cookies, Master/Company idempotency, Master Admin negative
      permissions and Company Owner MAC denial.
- [x] Migration/generated-artifact proof: migration 0098, PGlite schema version 98,
      `check:demo-schema`, `check:drift`, permission registry, root/Web typecheck, lint
      and API/Demo builds pass.
- [x] Push the scoped commits; source CI run `31570902479` passed all four Vitest shards.
      The docs-only push run `31573438483` was blocked before startup by GitHub Actions
      account billing, which is recorded rather than treated as a test pass.
- [x] Apply 0098/RLS and verify existing data remains usable, health is 200 and public
      bootstrap rejects non-empty data.
- [x] Create UTC PostgreSQL custom dumps, validate `pg_restore --list`, perform an
      isolated restore rehearsal, archive document storage and retain the prior backup.
- [x] Stop Compose, delete only `erp-system_pgdata` and `erp-system_document_storage`,
      recreate/migrate/RLS with no seed, verify empty tables/storage/schema/RLS and leave
      the site on Create Platform Superadmin without creating a real account.
- [x] Record final reset evidence in TASK-192/STATUS/DEPLOYMENT/PROJECT_LOGIC and the
      existing KB item; leave TASK-193 blocked while SMTP is unset.
- [ ] Runtime API/worker roles are explicit non-superuser/non-BYPASSRLS, and current
      Platform bootstrap → Master → Company succeeds under FORCE RLS (TASK-195).
- [ ] `npm run test:e2e:platform-workspace-layout` and
      `npm run test:e2e:platform-workspace-demo-autofill` pass for the release commit.
- [ ] Support Grant/Simulation policy, Platform MFA and recent sensitive-action step-up
      satisfy TASK-198 before privileged production use.
