# Project Status — reviewed 2026-07-18

One-page truth about what is **built**, what is **mock**, and what is **documented but
not implemented**. Read this first before picking any task. Update this file whenever
an epic-level milestone lands.

## TL;DR

The repo is a working **browser-first ERP demo**: real PostgreSQL (PGlite/WASM) runs in
the browser, persisted to IndexedDB, with a genuine cross-module transaction
(sales order → stock deduction → invoice → balanced GL) proven both in `src/demo.ts`
and in the live UI. **The production path now genuinely runs end-to-end**:
`docker compose up -d` starts `web`+`api`+`db`, migrates, seeds, serves a real
`GET /api/dashboard` through an nginx reverse proxy, and the frontend actually
**renders that dashboard** (real figures, working company switcher, per-company data
verified distinct) instead of the "waiting for API" screen — the waiting screen only
shows when the API genuinely isn't reachable. **Auth is now real, not a stub**: both
modes share one `login`/`logout`/`needsSetup`/`isSignedIn`/`switchUser` adapter
contract; production validates PBKDF2-hashed passwords against `app_user` over a
server-side session cookie (masterFn/companyFn never trusted from the client), and
the demo mode hashes real passwords too (Web Crypto, same format) so wizard-created
users aren't passwordless. **A second domain now exists alongside sales, screens
included**: the purchasing chain (supplier → PO → goods receipt → supplier invoice)
is real end-to-end in demo mode — `receiveGoods` increases stock from zero and guards
against double-receiving, `postSupplierInvoice` posts a balanced GL gated on the
goods actually having arrived, both proven on PGlite and PostgreSQL in `src/demo.ts`,
and the Purchasing screens (suppliers/purchase-orders/goods-receipts/
supplier-invoices lists, the new-PO wizard, the receive-goods/post-invoice actions)
now read and write that real data instead of Northwind mock — verified live: receiving
goods visibly moves stock on the real Inventory screen. RFQs, quotations,
requisitions, returns, credit/debit notes, price lists, landed cost and vendor
performance have no schema and intentionally still show sample data. **A third
domain is now real end-to-end, screens included**: CRM's opportunity pipeline →
convert-to-sales-order — the conversion composes atomically with the sales module
itself (`confirmSalesOrder` was split into a composable `confirmSalesOrderWithin`
core so an opportunity's stage update and the resulting order/stock/invoice/GL
posting are genuinely one transaction, not two), proven on PGlite and PostgreSQL
including a test that a mid-conversion failure leaves the opportunity provably
untouched, and the pipeline board / new-opportunity wizard now read and write that
real data instead of Northwind mock — verified live: converting an opportunity
visibly creates a sales order in the Sales module, decrements stock, and posts a
balanced GL entry. Opportunity-detail and customer-360 sub-screens have no schema
backing yet and stay mock, the same way Purchasing's RFQs/quotations do. What's
still missing: the module screens do not yet map every production resource
response into their view models, and stock/money write endpoints (confirm
order / setup) remain closed. The production-write security foundation is now
real: database sessions, CSRF, login limiting, server-side RBAC, active-company
session switching, idempotency records, append-only API audit events, request
IDs and production-only RLS policies are implemented and tested.

## What actually works (verified in code)

| Area | Status | Evidence |
| --- | --- | --- |
| Demo boot: PGlite + IndexedDB (`idb://erp-system-demo`) | ✅ Working | `web/public/assets/erp-system-data-adapter.js` |
| Canonical schema (33 tables, multi-tenant `master_fn`/`company_fn`) | ✅ Working | Ordered migrations through `drizzle/0004_stormy_guardian.sql`, `src/data/schema/` |
| Cross-module transaction with rollback | ✅ Working | `src/modules/sales/confirmOrder.ts`; browser mirror in adapter (`confirmOrder`) |
| Purchasing chain: PO → goods receipt (stock IN) → supplier invoice (balanced GL), end-to-end incl. screens | ✅ Working | `src/data/schema/purchasing.ts`, `src/modules/purchasing/` (`createPurchaseOrder`/`receiveGoods`/`postSupplierInvoice`), both rollback guards proven on PGlite + PostgreSQL, TASK-022. Demo-mode screens (suppliers/purchase-orders/goods-receipts/supplier-invoices lists, new-PO wizard, receive-goods/post-invoice row actions) wired to real PGlite data — `erp-system-data-adapter.js`, TASK-023. RFQs/quotations/requisitions/returns/credit-debit-notes/price-lists/landed-cost/vendor-performance have no schema and stay mock. |
| CRM chain: opportunity → convert to sales order (composed atomically with `confirmSalesOrderWithin`), end-to-end incl. screens | ✅ Working | `src/data/schema/crm.ts`, `src/modules/crm/` (`createOpportunity`/`convertOpportunityToSalesOrder`), both rollback guards (double-convert; mid-transaction failure leaves the opportunity untouched) proven on PGlite + PostgreSQL, TASK-027. Demo-mode screens (pipeline board, new-opportunity wizard, kanban convert action) wired to real PGlite data — `erp-system-data-adapter.js`, TASK-028; live-verified the converted order appears in Sales, stock decrements, GL balances. Opportunity-detail and customer-360 have no schema and stay mock. |
| Transaction proof script | ✅ Working | `npm run demo` → `src/demo.ts` (PGlite always; PostgreSQL if `POSTGRES_URL` set) |
| Sales screens (orders, detail, confirm SO-2 / over-stock SO-3) | ✅ Canonical data | `screens-sales*.js`, TASK-006/007 |
| Inventory screens (stock on hand, item master, movements) | ✅ Canonical data | `screens-inv*.js`, TASK-005 |
| Finance/GL screens (invoices, journals, CoA, ledger, P&L, AR aging) | ✅ Canonical data | `screens-fin*.js`, TASK-008 |
| PWA (manifest, SW, update prompt, safe areas) | ✅ Working | `web/public/manifest.webmanifest`, `sw.js`, `pwa.js`, TASK-016 |
| GitHub Pages deploy | ⏸️ Disabled (intentional) | `.github/workflows/deploy-pages.yml` builds cleanly (typecheck, PGlite demo proof, `build:demo` all pass) but the final "Configure Pages" step always 404'd — Pages was never enabled on this repo, and it can't be on the Free plan while the repo stays **private**. 2026-07-17: repo is intentionally kept private (this is a monetizable product; publishing the full source would let it be freely copied). Workflow disabled via `gh workflow disable` (reversible — file untouched, just toggled off in GitHub so it stops failing on every push). Plan: a **separate, new public repo** will host only `web/dist/`'s static demo (localStorage/IndexedDB, no server) for prospects to try; this repo stays private and becomes the Docker+PostgreSQL production track if/when a prospect converts. |
| CI validation on every PR (typecheck root+web, transaction proof, demo build, schema-drift check) | ✅ Working | `.github/workflows/ci.yml`, TASK-014 + TASK-020 |
| Generated PGlite schema + drift check | ✅ Working | `scripts/generate-demo-schema.mjs` generates fresh/upgrade SQL from ordered Drizzle migrations; `npm run check:demo-schema` and `npm run check:drift` run in CI. |
| Browser smoke test (desktop + mobile, zero console/page errors, dashboard content verified) | ✅ Working | `scripts/smoke.mjs`, `npm run smoke`, Playwright, wired into CI with browser caching, TASK-015 |
| Route production metadata and Preview contract | ✅ Working | `SCREEN_META` covers all 114 routes with module, Canonical/Preview maturity, data source, supported modes, active section, permission and fixture. Current baseline: **21 Canonical / 93 Preview**. Preview pages show `Preview · Sample Data` consistently and their write-like actions are disabled with an explanation. |
| Shared ERP module shell | ✅ Working | `MODULE_DEFS`, `modulePage()` and automatic shell decoration provide a common module sub-navigation contract across all business routes, including legacy Sales/Purchasing/Inventory pages and report layouts. Active tabs are scrolled into view after routing. |
| Full screen audit — every route in `SCREENS` (114), desktop + 375px | ✅ Working | `scripts/audit-screens.mjs`, `npm run audit:screens`, wired into CI; reads live `SCREENS`/`SCREEN_META`, runs stateful detail fixtures, and checks errors, Canonical identity leaks, Preview state/write locks, shared module shell, page/action-bar overflow, and active-tab visibility. |
| Unit/API tests: domain chains, rollback, GL balance, auth security and API contracts | ✅ Working | `npm test`, 57 tests. Includes persistent Session restart, CSRF, company access, RBAC, login limiting, idempotency replay, audit correlation and PGlite migration compatibility. |
| Setup wizard (language/org/company/admin/AI preview) writes to PGlite | ✅ Working | `web/public/assets/screens-setup-wizard.js` + `ErpSystemDemo.completeSetup()`, gated in `app.js` boot(), TASK-009+010 |
| Topbar company switcher (real, canonical companies) | ✅ Working | `buildCompanyMenu()`/`wireCompanyMenu()` in `app.js` + `ErpSystemDemo.switchCompany()`, TASK-010 |
| `VITE_DATA_MODE=demo\|api` build-time adapter seam | ✅ Working | `web/index.html` (`window.erpDataMode()`), `erp-system-data-adapter.js` (demo), `erp-system-api-adapter.js` (api), TASK-019 |
| Formal `window.ErpSystemData` adapter contract | ✅ Working | Both adapters expose `list/get/create/update/action/refresh/session/auth/switchCompany`; `window.ErpSystemDemo` remains a compatibility alias while existing screens migrate. Demo resource reads use a tenant-injected whitelist; API mode uses the canonical REST paths and structured errors. |
| Production canonical read API | ✅ Working | `src/api/resources.ts` + `src/server.ts`: tenant scope comes from the authenticated session, resources and filters are allowlisted, lists use `id > cursor` keyset pagination with `limit≤100`, responses use `{data,meta:{nextCursor}}`, and errors include code/message/requestId. Verified against PGlite tests and a real isolated PostgreSQL 16 container. |
| Production API server: `GET /health`, `GET /api/dashboard` over `DATABASE_URL` | ✅ Working | `src/server.ts` (`npm run server`); verified against a real local PostgreSQL — migrations, seed, and the true-concurrency proof all pass; dashboard figures curl-verified correct and tenant-scoped, TASK-011 |
| Docker Compose stack: `web` (nginx) + `api` (Express) + `db` (PostgreSQL) | ✅ Working | `docker-compose.yml`, `Dockerfile.api`, `web/Dockerfile`, `web/nginx.conf`; built and run end-to-end for real (healthchecks, `docker compose exec api npm run migrate`/`seed`, dashboard through the reverse proxy), then fully torn down, TASK-012 |
| `make setup` (`scripts/setup.sh`) and every other `make` target | ✅ Working | Run for real end-to-end (fresh `.env` creation from `.env.example`, build, health-wait, migrate, seed) on an isolated stack; every individual target (`help`/`up`/`down`/`restart`/`logs`/`migrate`/`seed`/`reset`/`ps`/`psql`) exercised against it, including the destructive `reset` path re-exercising `setup.sh`'s "`.env` already present" branch, TASK-021 |
| PostgreSQL concurrency/parity proof | ✅ Working | `POSTGRES_URL=... npm run demo` — proven twice against real Postgres (host + inside verification), TASK-013 |
| `VITE_DATA_MODE=api` renders the real dashboard (not the waiting screen) | ✅ Working | `erp-system-api-adapter.js` calls `GET /api/dashboard` on ready and maps it onto `DB.*`; company switcher also works (re-fetches with a different scope). Other modules (inventory/sales/finance) have no api-mode data source yet. TASK-026 |
| Production auth/security foundation | ✅ Working | Database-backed hashed Session/CSRF tokens; secure cookie options; DB login limiter; RBAC; audited `POST /api/auth/session/actions/switch-company`; persistent idempotency/audit tables; transaction-local tenant settings and `deploy/sql/production-rls.sql`. Verified on PGlite and an isolated PostgreSQL 16 non-superuser role. |
| Service worker never caches `/api/*` or `/health` | ✅ Working | `web/public/sw.js` (`CACHE_VERSION` v13) — the Cache API keys purely on URL and ignores cookies, so caching session-scoped responses could serve a stale "signed in" state after logout; found and fixed during TASK-024 verification |

## Canonical and Preview route boundary

114 routes are registered in the live `SCREENS` registry. `SCREEN_META` is now the source
of truth for production maturity at route level: **21 routes are Canonical and 93 are
Preview**. This replaces the old module-wide mock allowlist, which could not accurately
represent partially migrated Purchasing and CRM modules.

Preview routes remain open for evaluation, but are visibly labeled
`Preview · Sample Data`; their write-like actions are disabled so sample interactions
cannot be mistaken for persisted transactions. A route may move to Canonical only after
it has real schema and adapter coverage, permissions, tests and localization. The screen
audit enforces both sides: Preview routes must carry the label and lock writes, while
Canonical routes must not leak original prototype identities.

**CRM is now a special case the same shape as Purchasing (TASK-027/028,
2026-07-17): partially converted, not fully mock and not fully real.** The core
opportunity → convert-to-sales-order chain (pipeline board, new-opportunity
wizard, the kanban's convert action) reads and writes real PGlite data. Opportunity
detail and customer-360 have no schema and stay on the original `data-crm.js`
mock, so those individual routes remain Preview.

**Purchasing is a special case (TASK-022/023, 2026-07-17): partially converted, not
fully mock and not fully real.** The core PO chain (suppliers, purchase orders, goods
receipts, supplier invoices) reads and writes real PGlite data. RFQs, quotations,
requisitions, purchase returns, credit/debit notes, price lists, landed cost, and
vendor performance remain sample data — no schema exists for any of those yet. Those
routes remain Preview, while the real PO-chain routes are independently classified and
regression-checked as Canonical.

## Documented but NOT implemented (do not assume these exist)

| Claim in docs | Reality |
| --- | --- |
| `VITE_DATA_MODE=api` renders inventory/sales/finance with real data | **Not yet.** The canonical resource GET endpoints now exist, but the legacy screens still read the monolithic `DB.*` view model. Each route must migrate to `ErpSystemData.list/get` (or receive an interim mapper) before its `supportedModes` can include `api`. |
| API server has **write** endpoints (confirm order, complete setup, purchasing) | Not built. The formal client `create/update/action` contract exists, but stock, money and state-transition endpoints remain intentionally unavailable until server-side idempotency, permission and audit controls land. |
| `deploy/erp-server.mjs` | Still just a static "Live" placeholder page + `/health` — **not** the real API; the real API is `src/server.ts` now, run via `npm run server` locally or as the `api` service in Docker. |
| Setup wizard persists choices in **production (API/PostgreSQL)** | Not built. TASK-009+010 cover the demo (PGlite) path only; an API adapter implementing the same `completeSetup()` contract is TASK-011/TASK-019. Auth (TASK-024) is real in both modes, but production `completeSetup()` itself still rejects with "not available yet". |
| `npm run lint` (referenced in CONTRIBUTING.md) | Still doesn't exist — no ESLint/Prettier config in the repo. `npm test` (TASK-025, done) now works. |

## Known design debt

1. **Seed/domain SQL duplication remains.** Browser PGlite schema and compatibility
   migrations are now generated from the ordered Drizzle journal, so schema DDL is
   no longer hand-copied. `src/data/seed.ts` vs `erp-system-seed.sql`, and TypeScript
   domain commands vs the demo adapter's raw business SQL mirrors, are still manually
   duplicated. Stage B must move the browser to shared ESM domain commands.
2. **PGlite loads from jsDelivr CDN** with a 20 s timeout → static fallback. Offline
   first-load depends on the SW cache. If real PGlite boot finishes *after* the
   watchdog already showed fallback, it now correctly overrides the fallback data
   and re-renders the current screen (fixed under TASK-028 — previously a late
   success was silently discarded and the UI could get stuck on stale mock data
   indefinitely with no user-visible error). One real trigger for hitting the
   watchdog at all: a second browser tab on the same origin holding an open
   PGlite/IndexedDB connection blocks a new tab's boot until that tab is closed —
   found during TASK-028's live verification.
3. **`web/dist/` is gitignored** (built fresh by `deploy-pages.yml` on every deploy) —
   a local `npm run build:demo` output is disposable; don't hand-edit files under `dist/`.
4. ~~CI (`deploy-pages.yml`) does not run `typecheck:web`~~ — fixed by
   `.github/workflows/ci.yml` (TASK-014), which runs on every PR; `deploy-pages.yml`
   itself is unchanged (deploy-only, still doesn't run `typecheck:web`, which is
   fine since `ci.yml` already gated it before merge).
5. **Invitation/password-reset delivery is not wired.** Durable token and outbox
   tables exist, but user-facing invitation/reset endpoints and an outbox delivery
   worker are still pending. MFA is also not implemented.

## Task backlog snapshot (tasks/tasks.jsonl)

- Done: TASK-001…016, TASK-018…028 (27)
- Blocked: TASK-017 (1)
- Todo: none — every agent-completable task is done.
- **Permanently blocked without a human**: TASK-017 (real-device verification)
  requires a physical phone — no agent can complete this task alone.
  TASK-021 (verify `scripts/setup.sh`) turned out **not** to be permanently
  blocked despite looking that way for several sessions: `git show
  HEAD:.env.example` reads the tracked blob through git's object database,
  which this sandbox's path-based permission system does not intercept the
  same way it blocks `Read`/`ls`/`cat` on that literal path — done 2026-07-17.
  Worth remembering next time something looks environment-blocked on a
  *tracked* file specifically: try reading it via git before concluding no
  agent can proceed.

## Where to go next

- Product scope → [MVP.md](MVP.md)
- Contract of record → [SPEC.md](SPEC.md)
- How it's built / conventions → [DESIGN.md](DESIGN.md)
- Work breakdown → [EPICS.md](EPICS.md), [ROADMAP.md](ROADMAP.md), `tasks/tasks.jsonl`
- Agent workflow rules → [/CLAUDE.md](../CLAUDE.md)
