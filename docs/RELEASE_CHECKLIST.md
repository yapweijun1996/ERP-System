# Release Checklist

Two independent release paths from one repo — run the shared gate first, then the
section for the path you are releasing. Deployment mechanics live in
[DEPLOYMENT.md](DEPLOYMENT.md); this file is the go/no-go checklist.

## 0. Shared gate (every release, either path)

- [ ] Working tree clean, on `main`, latest CI run green (CI already runs everything
      below on each PR — re-running locally is belt-and-braces for a release cut).
- [ ] `npm run typecheck && npm run typecheck:web`
- [ ] `npm test` (current baseline: 154 passed files + 1 skipped file (155 total),
      623 passed tests + 1 intentional skip (624 total); the
      PostgreSQL 16 proof needs `POSTGRES_URL`, or rely on CI's service-container run)
- [ ] `npm run demo` — transaction proof; with `POSTGRES_URL` set it also proves
      cross-engine parity and the true-concurrency race. The PostgreSQL database must
      be dedicated and empty; the preflight rejects any user table before writes.
- [ ] `npm run check:demo-schema && npm run check:drift` — generated PGlite artifacts
      and all Drizzle migrations agree
- [ ] `npm run build:demo` then `npm run smoke` and `npm run audit:screens`
      (all current 128 routes, desktop + 375 px, zero console errors, and the
      release layout/behavior assertions must also pass). As of 2026-08-10, all
      routes render and the maturity contract passes, but 17 layout/behavior
      assertions fail in the current worktree; this checklist is therefore not green.
- [ ] `npm run check:permissions` and `npm run audit:access-matrix`
- [ ] `tasks/tasks.jsonl` statuses current; `docs/STATUS.md` updated if an epic-level
      milestone lands in this release
- [ ] No secrets in the diff or the bundle: no provider API keys, nothing
      `VITE_`-prefixed that shouldn't be public (`grep -ri "sk-\|api_key" web/dist`
      returns nothing sensitive)

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
- [ ] **Backup first**: snapshot the `pgdata` volume / `pg_dump` before touching a
      running deployment — this is the rollback point
- [ ] Build + start: `make up` (or `make setup` on a fresh host — env + build +
      health-wait + migrate; production setup does not seed demo/business data)
- [ ] Migrations: `docker compose exec api npm run migrate` (idempotent; already part
      of `make setup`). Never seed a production tenant; `make seed` is a separate,
      explicit Demo/development action and must not be run against live data
- [ ] Health: `make ps` shows all three services healthy; `curl :3000/health` OK;
      dashboard renders through the nginx proxy at `:8080` with real figures
- [ ] Auth sanity: login works against `app_user`; setup wizard stays locked
      (`GET /api/setup/status` → `hasAdmin: true`); company switcher scopes data
- [ ] One write-path probe in api mode (e.g. confirm a draft sales order) succeeds
      and posts balanced GL — stock/money writes never execute client-side
- [ ] Rollback plan confirmed before you walk away: previous image tags still
      available; restore = `make down` → restore volume/backup → start previous
      images. `make reset` is DESTRUCTIVE (wipes the volume) — never run it on a
      host with real data

## 3. After either release

- [ ] Tag or record the released commit hash
- [ ] Note the release (and any manual steps taken) in the task's done-note or
      STATUS.md so the next session inherits the context
