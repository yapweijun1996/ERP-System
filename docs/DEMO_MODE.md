# Demo Mode (PGlite + IndexedDB)

The demo is the version deployed to GitHub Pages. It has **no backend server** — the
database runs entirely in the browser.

## 1. How it works

```
Frontend UI → shared business logic → Drizzle → PGlite (Postgres WASM) → IndexedDB
```

- [PGlite](https://pglite.dev) is real PostgreSQL compiled to WebAssembly (~3 MB gzipped).
- It persists to the browser's **IndexedDB**, so data survives page reloads.
- On first load, the app **seeds mock data** (sample products, customers, orders) so the
  ERP looks alive immediately.

Because PGlite is PostgreSQL-compatible, a fresh Demo replays the same **ordered Drizzle
migration chain** as production and uses the same repository/domain SQL wherever the
browser can support it. Production separately applies FORCE RLS and owns real
multi-user locks, server sessions and workers; those guarantees are not simulated by a
single-user browser database.

The demo frontend must be static-hosting friendly. It cannot rely on a Node server,
server rewrites, cookies from a backend, or production-only secrets. It should use mock
or sample data only.

### Current Aria bridge (Phase 2 — PGlite-backed)

The cloned Aria ERP frontend is a classic-script app. `web/public/assets/erp-system-data-adapter.js`
now boots the CANONICAL demo database in PGlite (persisted to IndexedDB at
`idb://erp-system-demo`) and reads all screen data back with async SQL:

```
web/public/db/erp-system-schema.sql    (generated replay of all ordered Drizzle migrations)
src/data/seed.ts's seedDemo() runs directly (no SQL mirror — TASK-034)
web/public/db/erp-system-demo-txn.sql  (SQL form of the src/demo.ts SO-1 chain)
        │  exec on first boot (or after reset)
        ▼
PGlite (idb://erp-system-demo) -> async SQL reads -> Aria DB object -> screens
```

`app.js` defers UI boot until `window.ErpSystemDemoReady` resolves. If the PGlite
WASM (loaded from CDN) is unreachable — e.g. fully offline — the adapter falls back
to a static payload carrying the SAME canonical values, and `DB.erpSystem.dataMode`
records `'fallback'` instead of `'pglite'`.

## 2. Build & run

```bash
npm run build:demo     # VITE_DATA_MODE=demo → web/dist/
npm run preview        # serve web/dist locally
```

The build inlines the demo data adapter and the seed dataset. No `DATABASE_URL`, no API.
The demo also ships as an installable PWA shell; see [PWA.md](PWA.md).

## 3. Mock data

- Canonical seed lives in `src/data/seed.ts` and the Drizzle schema under
  `src/data/schema/`.
- The Aria bridge executes the generated SQL copies under `web/public/db/` in PGlite
  and maps async query results into the Aria `DB` contract.
- Seeded once per browser (guarded by the presence of the `master` row in PGlite).
- Settings → Demo data → "Reset demo data" drops the schema and reseeds on reload.
- Keep the dataset **small** — a few hundred to a few thousand rows. The demo proves the
  UI and flows, not scale.
- UI layout may use temporary mock data while a page is being built, but completed demo
  pages should read through the PGlite data adapter so demo behavior matches production
  schema and transactions.

### Curated HR starter roster

The compact canonical seed creates 18 fictional employee master records: 12 for Acme
Singapore and 6 for Acme Malaysia. Farah Wong and Amirul Rashid are the two reporting
roots; the remaining rows include department, job title, start date, salary, employment
type and manager relationships. Only the existing Demo personas have login accounts;
the additional roster uses `demo.example.test` addresses and cannot be used to sign in.

The roster is loaded only when a Demo database is first created (or after **Settings →
Demo data → Reset demo data**). An existing browser IndexedDB database is intentionally
not reseeded automatically, because reseeding would overwrite the user's Demo work.
Fresh Demo databases then load the separate enterprise showcase pack, which adds its
larger deterministic employee population for list, permissions and reporting demos.

## 4. What the demo is NOT

| Misconception | Reality |
| --- | --- |
| "IndexedDB is the ERP database" | No. IndexedDB holds *demo mock data only*. Production is PostgreSQL. |
| "It can handle the client's 800 GB" | No. Browser storage is capped (hundreds of MB realistically). The 800 GB lives in production PostgreSQL. |
| "Demo performance reflects production" | No. Never benchmark scale against the demo. See [SCALABILITY.md](SCALABILITY.md#9-what-the-demo-must-not-inherit). |
| "Demo data is shared between users" | No. Each visitor has their own IndexedDB; nothing is sent to a server. |

## 5. Known limits

- **Storage quota:** IndexedDB is subject to per-origin browser quotas. Keep seed data
  small; the demo is a showcase, not a data store.
- **Single user:** no concurrency, no real auth — the demo user is a fixed sample account.
- **No server-only transactions:** flows that require server guarantees in production
  (advisory locks) run as ordinary client transactions in the demo. Correct for one user;
  not a multi-user guarantee.
- **PGlite feature coverage:** confirm any extension/function the schema needs is
  supported by the PGlite build (e.g. `pgvector` is supported; verify niche functions).
  If a required feature is missing, that query path needs a demo-specific fallback. This
  is the gating check noted in [ARCHITECTURE.md](ARCHITECTURE.md#3-why-pglite-not-dexie).

## 6. Why this is safe to make public

The demo bundle contains **only mock data** and client code. No credentials, no
connection strings, no customer data ever reach `web/dist/`. The production API and database
are a completely separate deploy target.

## 7. GitHub Pages acceptance

Before publishing the demo:

- `web/dist/` is generated by the demo build.
- asset paths work under the GitHub Pages base path.
- client routing works on refresh, either through hash routing or a `404.html` SPA
  fallback.
- PGlite initializes from a static origin and persists to IndexedDB.
- the user can reset the demo data without a server.

## Enterprise showcase pack

Fresh Demo databases load the generated `erp-system-showcase-v1.sql` after the small
regression seed. The browser verifies the manifest SHA-256 and commits the whole pack
in one transaction. Manifest version 15 is fixed to 2026-07-27 and makes all 12 real
permission personas self-contained in the enterprise pack: Company Owner is assigned to
both legal entities with explicit tenant administration access, while Viewer and the ten
department personas exercise their actual company roles. The pack also contains
SG/MY legal entities and 10,436 linked activity/inventory/GL/leave/payroll/procure-to-pay records,
including manager reporting lines, governed annual-leave openings and reservations,
one real pending sales-order approval per company, pending/approved/rejected leave and
draft/posted/cancelled payroll cases. Existing
IndexedDB is preserved unless the user explicitly confirms the irreversible upgrade
or reset. The pack and production seed protections are specified in
[EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md](EMPLOYEE_ACCESS_DEMO_AND_ONBOARDING.md).

Version 6 is self-healing for historical Demo databases: it idempotently supplies
missing SG/MY default work calendars, confirmed calendar versions, Annual/Medical/
Unpaid types and confirmed policy versions before it creates leave ledger openings.
It therefore does not assume that an older IndexedDB was originally created from the
current regression seed.

Version 9 keeps the historical SO-2 confirm-success and SO-3 insufficient-stock
rollback teaching drafts outside the approval queue. Dashboard and approval inbox
rows are derived only from real pending approval/request tables; the pack supplies
separate `DEMO-SO-APP-SG-0001` and `DEMO-SO-APP-MY-0001` maker-checker cases, each
with sufficient opening stock in the exact fulfilment warehouse.

Version 15 adds 24 deterministic SG/MY leave cases across July and early August,
including approved, pending, rejected, cancelled, multi-day and overlapping coverage
examples. Earlier controlled Demo leave rows are upgraded in place so a historical
IndexedDB converges on the same fixed business-date calendar as a fresh installation.
Company Owner receives company-wide privacy-redacted calendar scope; managers remain
restricted to direct reports or an explicitly granted reporting tree.

## Expenses & Tax v1 parity

TASK-177–179 add `company_receipt`, exact-hash confirmation and explicit own/company
read rules to the shared Drizzle/PGlite and PostgreSQL contract and implement the same
transactional domain commands behind `/api/company-receipts`.
Focused PGlite domain/API/capture tests and a disposable non-superuser PostgreSQL RLS lifecycle
test prove the backend foundation in both database modes. Existing Demo My Receipts
provides camera/file IndexedDB drafts, crop/rotate/compress, retry and refresh persistence
through the shared validation/storage contract. The Demo adapter now evaluates the
same permission keys and performs the same bounded `afterId` Company Receipt query as
API mode; both drive the five-language responsive register. TASK-181 adds the same
migration-0093 snapshot contract in PGlite and PostgreSQL/API modes: complete ready/
dated selection, stable-key replay, creator scope, exact currency totals, governed
document reads and one PDF renderer. Tax Evidence package generation remains a separate
claim flow even though both now reuse the evidence-PDF primitive.

TASK-180 keeps search/date predicates query-side in both adapters. TASK-182 now applies
the same `expenses_tax` Master-entitlement-plus-Company-allocation fail-closed gate to
Demo/PGlite and API-facing route behavior. TASK-183 is complete: the register can
select the signed-in uploader's stored evidence, read its confirmation context and call
the shared Demo/PGlite create command. A brand-new static Demo upload is deliberately
`scanner unavailable`, so it cannot self-confirm; browser proof simulates the external
worker recording a clean scan before testing confirmation. TASK-183 also drives the
API bundle through authenticated confirmation, persistence, query, Pack and 375px checks
with an isolated same-origin PGlite API fixture. It also passes the same authenticated
browser journey against a newly created disposable local PostgreSQL 16 database. PGlite
evidence remains distinct from PostgreSQL evidence; neither fixture is deployment proof.
TASK-192 later deployed the application and migrations through 0098, then reset the
target to first-run state; no authenticated production Company Receipt UAT is claimed.
Browser PGlite proof
must run through `npm run build:demo` plus preview so IndexedDB/WASM persistence is real;
static fallback rows or a dev-server fallback cannot satisfy capture, refresh, range,
preview or export acceptance.

Current gaps are deliberately outside TASK-183's Done claim: the confirmation button is
not capability-hidden, the picker is bounded to the first 100 My Receipts rows and still
requires Employee Self Service, and there is no Company Receipt detail/edit/void or real
Missing Date correction UI. Pack read/render also fails to re-require `read_company`
after a company-wide snapshot creator is downgraded to `read_own`. TASK-196/197/202 own
the authorization, workflow, lifecycle, Decimal/timezone and Unicode-PDF repairs.

## Demo platform entitlement foundation

Demo now follows the same platform-owned entitlement boundary as API mode. TASK-185
adds the deterministic platform-selected fixture/domain harness and TASK-186 removes
the tenant mutation surface:

- Demo seeds explicit Master entitlement and Company allocation for every registered
  business module; effective state is their intersection and missing state denies;
- one Master default allocation is stored and applied to newly created Demo Companies;
- Company Owner's MAC screen, `admin.modules.manage` grant and onboarding selector are
  absent; Demo calls to the legacy tenant API fail `platform_authority_required`;
- automated tests use an explicit Demo platform harness to change entitlement/allocation
  and prove dependency, migration and tenant isolation. It is not exposed as a tenant
  business control or backed by browser localStorage;
- API mode now provides Platform Superadmin login/workspace and exact-user simulation
  with the same authority/audit semantics. The static Demo fixture remains a
  deterministic entitlement harness, not a browser-login realm; TASK-188 completed the
  recorded final dual-mode browser and release-gate proof.

The fixture/API and TASK-186 tenant cutover are implementation evidence. TASK-188 adds
recorded dual-mode browser, security and release-gate evidence; neither statement
authorizes a production migration or deployment.

## EPIC-065 parity boundary: Platform bootstrap and provisioning

The static Demo intentionally does **not** expose a real Platform Superadmin login or
tokenless public bootstrap. Its PGlite fixture/harness can represent platform entitlement
and provisioning facts for deterministic tests, while API mode owns the production
`platform_principal` password/session, empty-database first claim, Master/Company wizards
and audit/idempotency behavior. Demo setup remains local and resettable; production
setup-state rows and independent platform cookies never enter the Demo bundle.

The shared contract still applies: commercial modules are selected by the Platform layer,
new Companies inherit Master defaults, tenant onboarding cannot select MAC, and Master
Admin/Company Owner authority is tested against the same permission templates. The
generated PGlite schema is version 98 and must remain in lockstep with Drizzle migration
0098; this is build/schema parity, not production deployment proof.

## API demo quick setup (2026-08-12)

The hosted API demo may opt into the editable Platform Superadmin quick-setup form with
the non-sensitive build flag `VITE_PLATFORM_DEMO_AUTOFILL=true`. Source and customer
deployments default to `false`; the current hosted demo is the explicit exception. When
enabled, the bootstrap, Master and first Company forms show public sample values and the
buttons read `Next: ...` / `Finish: ...`, so a visitor can advance without typing. Every
field remains editable, the dismissible banner warns that the credentials are public, and
the API continues to own validation, authorization, audit, transactions and idempotency.

The sample values are `platform-admin` / `demo-platform-1234` for the Platform principal,
`Acme Group` / `ACME` for the Master, and `Acme Singapore` / `SG` with `demo1234` for the
first Master Admin and Company Owner accounts. They are demonstration credentials only and
must be disabled before any real customer deployment. Existing Masters are taken as the
continuation point and an existing Company is never overwritten. The next-Company form uses
new editable defaults only after the operator selects `+ Create Company`: Company 2 is
`Acme Malaysia` / `MY` with `myowner`, while Company 3 and later use `Acme Company N` /
`ownerN` identities. Closed tenant control contains neither the optional form nor its Demo
passwords. The static PGlite/GitHub Pages demo does not gain a Platform login or tokenless
bootstrap from this flag.

### Current source/worktree presentation and resume behavior

The current source also provides a Demo-only one-click Platform login, password
Show/Hide controls and responsive workspace containment. `Remember me` is intentionally
available only for tenant login; the independent Platform realm always uses its bounded
session contract. Provisioning resumes from an existing Company without duplicating it,
with the optional form and action bar closed. `+ Create Company` opens a fresh
ordinal-specific Demo draft instead of reusing the previous Company's values; Cancel closes
the inline panel without a mutation and returns focus to the opener. Drafts are isolated by
selected Master and next Company ordinal, so user edits survive ordinary rerenders, Cancel
and Master switches without leaking into another tenant group. Successful creation selects
the API-returned `companyFn`, closes the panel and does not expose the next draft until a new
explicit open. The focused PGlite E2E proves those transitions, disabled-flag behavior and
single-request idempotency. The 2026-08-13 application-only release at `dff72c3` preserved
the production counts (99 migrations, 1 Platform principal, 1 Master, 2 Companies and 3
tenant users); public health returned 200. Live read-only smoke confirmed closed control,
explicit Company 3 autofill, editable fields, Cancel focus return and zero horizontal
overflow without sending the final Company mutation.

The hosted API Demo remains distinct from the static PGlite Demo. Public sample
credentials and autofill must be disabled for a customer deployment, and neither mode
is evidence that production PostgreSQL provisioning works under the required
non-superuser, non-BYPASSRLS runtime role; TASK-195 owns that P0 proof and repair.
