# Release Checklist

Latest release boundary (2026-09-08): see [TEST_COVERAGE.md](TEST_COVERAGE.md).
Checked entries below retain named historical/local evidence only; rerun required
gates for the selected release revision. TASK-214 found open runtime failures, so
this checklist does not authorize or certify a production release.

Two independent release paths from one repo — run the shared gate first, then the
section for the path you are releasing. Deployment mechanics live in
[DEPLOYMENT.md](DEPLOYMENT.md); this file is the go/no-go checklist.

For the current source-backed action backlog and evidence boundaries, see
[CODEBASE_REVIEW_2026-09-06.md](CODEBASE_REVIEW_2026-09-06.md) and the
[pending-task breakdown](PENDING_TASK_BREAKDOWN_2026-09-06.md).

## 0. Shared gate (every release, either path)

- [ ] Working tree clean, on intended release commit, and latest CI actually executes
      green. Never treat a zero-step infrastructure failure as validation.
- [x] `npm run typecheck && npm run typecheck:web` — root and Web typechecks pass after
      aligning the Demo purchase-requisition adapter with the actor-input command shape.
- [ ] `npm test` — latest TASK-214 attempt stopped without a result. The earlier
      173-file/705-test pass with two skips is historical; rerun the full suite.
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
- [x] `npm run build:demo` — serial build passed on 2026-09-07 after isolating the
      browser-safe connector envelope validator from the server-only `node:crypto` chain;
      the earlier parallel attempt raced on shared `web/dist` output and was not a source
      failure.
- [x] `npm run smoke` — desktop and mobile pass on 2026-09-07. The navigation assertion
      checks visible semantic badges; hidden zero-count badges remain in the DOM.
- [ ] `npm run audit:screens` — TASK-214 rendered 129 routes but failed voucher Retry.
      Focused desktop three-route rerun passed; full recovery gate remains TASK-223.
- [x] `npm run audit:pwa-update` — PWA update lifecycle audit passes; physical-device
      acceptance remains TASK-017 and is not satisfied by emulated 375 px.
- [x] `npm run audit:i18n` — TASK-219 repaired the sales-invoice labels; the current
      built-Demo PGlite run passed 129 routes × 5 languages × desktop/mobile with zero
      blocking findings. Current-HEAD remote CI remains a separate gate.
- [x] `npm run test:e2e:platform-workspace-layout` — 2026-09-07 passed isolated PGlite
      desktop/tablet/mobile Platform workspace, separate Admin/Employee modes, focus and
      overflow checks plus the focused five-language Platform workspace matrix.
- [x] `npm test -- --run src/modules/documents/processing.test.ts src/modules/documents/processingDrivers.test.ts`
      — 2026-09-07 passed 2 files / 19 tests for Vision gateway failures, revoked
      connectors, bounded dead-letter/same-chain manual retry and the no-automatic-local-OCR
      fallback boundary.
- [x] `npm run check:permissions` and `npm run audit:access-matrix` — 2026-09-06 passed
      the permission registry at 315/116/62/5 and the serial 59-route × 13-template
      browser access audit. This is local evidence, not production authorization proof.
- [x] `npm run docs:check` — validates all README/docs Markdown local links before release;
      external URLs remain outside this deterministic gate.
- [x] Local worker telemetry source gate — `src/worker/telemetry.ts` tests pass 3/3 and
      the primary/calendar entry points emit aggregate-only queue snapshots. This proves
      shape/redaction only: bounded non-blocking collection, claim-predicate parity,
      production metrics/alerts, ownership and recovery exercise remain TASK-201.
- [x] `tasks/tasks.jsonl` statuses current: 210 Done / 4 In Progress / 6 Todo / 3 Blocked / 223 Total. Blockers are TASK-017, TASK-193 and TASK-209;
      TASK-203 remains In Progress until a fresh current-HEAD remote CI result, TASK-204 remains In progress until tax-owner production review and TASK-205 remains
      In progress until production Vision configuration and live dead-letter alert/recovery
      evidence is recorded.
- [ ] GitHub Actions actually executes current HEAD with every required gate green. Run
      `34017037310` is a historical remote failure on `timesheet: Projects`; the current
      TASK-219 source passes the full local desktop/mobile matrix, and TASK-203 still needs
      a fresh current-HEAD remote run.
- [x] 2026-08-12 current-worktree secret baseline: the tracked diff and `web/dist`
      contain no known provider/token/private-key signature; high-entropy diff strings
      were classified as document, route, module, DOM/i18n or deterministic-test values.
      `.env.example` contains no such signature and tracked `.env` files are excluded.
      Re-run this check immediately before any release; it is not a substitute for a
      repository-hosted secret scanner or production credential rotation.

## 1. Demo path (static bundle → public showcase)

Source configuration: `deploy-pages.yml` is configured to publish the static Demo
at `https://yapweijun1996.github.io/ERP-System/`. The workflow contains only the
PGlite/IndexedDB Demo bundle; production remains the separate Docker/API/PostgreSQL
track. Remote Actions enablement, repository visibility and the current hosted revision
were not checked in TASK-215.

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
- [ ] Public `release.json` revision matches the intended Pages workflow commit and its
      listed asset SHA-256 values match the fetched files; this is read-only evidence.

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
- [ ] Public `/health` returns `status: ok` with the intended `revision`, and public
      `/release.json` reports the same revision before production availability is claimed.
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
- [ ] Preserve the fetched `/health` and `/release.json` responses with the release
      record; the two revisions must agree with the intended source commit.
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
- [x] Pack downgrade and export authority: current visibility dominates the frozen
      snapshot, so a creator losing `read_company` cannot read or render an old
      company-wide Pack; active-tenant, cross-tenant and revoked-read cases return safe
      denial, preview/export purpose is audited, and the PDF remains private/no-store
      (TASK-196).
- [x] Read-only UI hides create/edit/void; real detail, Missing Date correction, update,
      void and bounded employee-independent eligible-evidence picker behavior pass
      (TASK-197). Governed binary upload/capture remains in My Receipts by explicit v1
      boundary.
- [x] Source/Demo/API evidence covers JPEG/PNG/HEIC/PDF validation, quarantine/OCR
      failure handling and readable multi-page PDF output without losing original
      evidence (`upload.test.ts`, document-processing tests, Pack/API tests and the
      Company Receipts browser flow). This is not production scanner/storage UAT.
- [x] Five languages, 1440 × 900, 390 × 844 and canonical 375 px audits pass with zero
      unexpected console errors or page overflow.
- [x] Pack retention/legal-hold/purge/tombstone lifecycle and Company-calendar presets are
      implemented with local unit/API/Demo and authenticated browser boundary proof. The
      disposable PostgreSQL 16 same-key race is verified in a fresh database. Source-level
      localized Unicode PDF/fonts, conflict convergence and Decimal-safe amount formatting
      are implemented and unit-tested.
- [ ] TASK-202 production download/Print/release and authenticated P0 UAT evidence are
      still required before this release gate is closed.
- [ ] Authenticated production scanner/storage/receipt UAT is recorded separately from
      disposable fixtures and the reset checkpoint.

## 5. EPIC-065 Platform Bootstrap and reset gate

The checked items below are the dated TASK-192 deployment/reset checkpoint. Current
source is migration 0103/schema version 103; use TASK-195 and TASK-204/206–209 before
treating this gate as a current release approval.

- [x] Source/API focused proof: empty bootstrap, concurrent winner, setup status stages,
      independent platform cookies, Master/Company idempotency, Master Admin negative
      permissions and Company Owner MAC denial.
- [x] Dated TASK-192 migration/generated-artifact proof: migration 0098, PGlite schema
      version 98,
      `check:demo-schema`, `check:drift`, permission registry, root/Web typecheck, lint
      and API/Demo builds pass.
- [x] Push the scoped commits; source CI run `31570902479` passed all four Vitest shards.
      The docs-only push run `31573438483` was blocked before startup by GitHub Actions
      account billing, which is recorded rather than treated as a test pass.
- [x] Dated TASK-192 apply 0098/RLS checkpoint verified existing data remained usable,
      health was 200 and public bootstrap rejected non-empty data; this is not current
      migration-0099 deployment or public availability proof.
- [x] Create UTC PostgreSQL custom dumps, validate `pg_restore --list`, perform an
      isolated restore rehearsal, archive document storage and retain the prior backup.
- [x] Stop Compose, delete only `erp-system_pgdata` and `erp-system_document_storage`,
      recreate/migrate/RLS with no seed, verify empty tables/storage/schema/RLS and leave
      the site on Create Platform Superadmin without creating a real account.
- [x] Record final reset evidence in TASK-192/STATUS/DEPLOYMENT/PROJECT_LOGIC and the
      existing KB item; leave TASK-193 blocked while SMTP is unset.
- [x] TASK-195 source/deployment boundary: API and worker services use explicit
      non-superuser/non-BYPASSRLS roles, the profiled migrator uses the bootstrap owner,
      and current Platform bootstrap → Master → Company plus cross-tenant denial passes
      under PostgreSQL 16 FORCE RLS. Run `deploy/verify-runtime-roles.sh` on the target;
      this does not claim a current production revision.
- [x] TASK-206 hidden actor/session boundary: disposable PostgreSQL non-superuser proof
      covers target-context RLS provisioning, non-login/no-session actor behavior, tenant
      user/role/simulation/Employee-workspace exclusion, scope switch, Return and parent
      revoke. This does not claim migration 0099 production deployment.
- [x] `npm run test:e2e:platform-workspace-layout` and
      `npm run test:e2e:platform-workspace-demo-autofill` pass locally for the current
      source commit (`d44dfb4`); current-HEAD remote CI and deployment evidence remain
      separate release gates.
- [ ] Support Grant/Simulation policy, Platform MFA and recent sensitive-action step-up
      satisfy TASK-198 before privileged production use.
