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

Because PGlite *is* Postgres, the demo runs the **same SQL, schema, and migrations** as
production. No second query dialect.

The demo frontend must be static-hosting friendly. It cannot rely on a Node server,
server rewrites, cookies from a backend, or production-only secrets. It should use mock
or sample data only.

### Current Aria bridge (Phase 2 — PGlite-backed)

The cloned Aria ERP frontend is a classic-script app. `web/public/assets/erp-system-data-adapter.js`
now boots the CANONICAL demo database in PGlite (persisted to IndexedDB at
`idb://erp-system-demo`) and reads all screen data back with async SQL:

```
web/public/db/erp-system-schema.sql    (byte copy of drizzle/0000_init.sql)
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
API mode; both drive the five-language responsive register. Receipt Pack generation
remains pending and current Tax Evidence package generation remains API-only.

TASK-180–183 must continue using the shared schema/domain contract in both adapters.
Browser PGlite proof
must run through `npm run build:demo` plus preview so IndexedDB/WASM persistence is real;
static fallback rows or a dev-server fallback cannot satisfy capture, refresh, range,
preview or export acceptance.

## Planned Demo platform entitlement behavior

Current Demo Company Owner can operate the tenant Module Activation screen; that is
legacy/current behavior and TASK-184 does not remove it. EPIC-064 replaces it with a
deterministic platform-selected fixture:

- Demo seeds explicit Master entitlement and Company allocation for every registered
  business module; effective state is their intersection and missing state denies;
- one Master default allocation initializes newly created Demo Companies;
- Company Owner has no MAC screen, `admin.modules.manage` grant or onboarding selector;
- automated tests use an explicit Demo platform harness to change entitlement/allocation
  and prove dependency, migration and tenant isolation. It is not exposed as a tenant
  business control or backed by browser localStorage;
- Platform Superadmin login/workspace and exact-user simulation must preserve the same
  authority/audit semantics in Demo and API modes when TASK-187 lands.

Until TASK-185/186 is verified, the existing Company-controlled Demo behavior remains
Canonical and must not be described as platform-owned implementation.
