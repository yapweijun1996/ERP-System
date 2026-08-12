# MVP Definition

Reviewed: **2026-08-12**. MVP-1/MVP-2 below are the original release gates; the
implementation has progressed beyond them. Current code/status truth is in
[STATUS.md](STATUS.md), with the current 129 Canonical / 0 Preview boundary.

Two MVP gates, in order. Do not start MVP-2 items while MVP-1 exit criteria are open,
except where a task is explicitly cross-cutting (CI, tests).

## MVP-1 — Browser demo (zero backend)

**Goal:** anyone opens a public URL and experiences a believable ERP — no install, no
server, no account. All data lives in the browser (PGlite → IndexedDB; small UI prefs
in localStorage).

### In scope

| # | Capability | Status |
| --- | --- | --- |
| 1 | Boot with seeded demo companies (Acme SG, Acme MY) into PGlite/IndexedDB | ✅ done |
| 2 | Dashboard with figures derived from the database (not hardcoded) | ✅ done |
| 3 | Inventory: products, warehouses, stock on hand, movements | ✅ done |
| 4 | Sales: order list/detail, **Confirm order** → stock deducted → invoice → balanced GL, with insufficient-stock rollback | ✅ done |
| 5 | Finance: invoices, journal entries, chart of accounts, ledger drill-down, P&L, AR aging | ✅ done |
| 6 | Settings → Demo data reset (drop + reseed IndexedDB) | ✅ done |
| 7 | Installable PWA with update prompt; usable at 375 px mobile width | ✅ done |
| 8 | Static demo bundle suitable for Pages or another public host | ✅ build verified; Pages workflow disabled for this private repo |
| 9 | First-run **setup wizard** (language → company → country/tax → admin) | ✅ done (TASK-009, TASK-010) |
| 10 | Every routed screen opens without console errors; mock screens clearly labeled as "sample data" | ✅ Dated browser gates cover the route set through 129 Canonical / 0 Preview; current static inventory is 129 and TASK-200 owns a fresh HEAD rerun/API metadata exception |
| 11 | Real-device verification (iPhone/Android) of layout + confirm flow | ⬜ TASK-017 (permanently blocked — needs a physical phone) |

### Explicitly OUT of MVP-1

- Real authentication (demo login stub is acceptable, but must be labeled demo)
- Purchasing/CRM/HR/etc. backed by real tables (mock UI acceptable if labeled)
- Any server, API, or Docker component
- Multi-user anything — IndexedDB is single-browser by definition

### MVP-1 exit criteria

- Static demo artifact boots offline-capable PWA with seeded data in local/static preview;
  public hosting is a separate follow-up because this repository is private.
- Order → stock → invoice → GL demo works and rolls back on over-sell (SO-2 / SO-3).
- Setup wizard can create a fresh company and land on its empty dashboard.
- Zero console errors on every registered route in demo mode.

## MVP-2 — Docker production baseline

**Goal:** `docker compose up -d` gives a real multi-user deployment: static web +
Node API + PostgreSQL, sharing the exact schema/migrations/business logic already
proven in the demo.

### In scope

| # | Capability | Task |
| --- | --- | --- |
| 1 | Frontend data seam actually switches on `VITE_DATA_MODE=demo\|api` | ✅ done (TASK-019/026) — API mode uses the HTTP/PostgreSQL adapter for the current Canonical boundary |
| 2 | API server: `/health`, `GET /api/dashboard` ✅ (TASK-011); current Canonical business writes run server-side through the unified transactional dispatcher (TASK-040 and later domain work) ✅ |
| 3 | Docker Compose stack `web` + `api` + `db` with health checks | ✅ done (TASK-012) — built, run, and torn down for real |
| 4 | Drizzle migrations + seed run against PostgreSQL | ✅ done (TASK-011/012) — verified both on the host and inside the `api` container |
| 5 | `Makefile` / `scripts/setup.sh` aligned with the real compose assets (`make setup` works end-to-end) | ✅ done (TASK-021, 2026-07-17) — `scripts/setup.sh` run for real end-to-end plus every individual `make` target against a live, isolated stack |
| 6 | PostgreSQL parity + concurrency proof (`POSTGRES_URL npm run demo`; FOR UPDATE over-sell test: exactly one winner) | ✅ done (TASK-013) — proven against real Postgres twice |
| 7 | Minimal real auth: login validates against `app_user`, session scopes `master_fn`/`company_fn` server-side | ✅ done (TASK-024; later auth epics deepen the contract) |
| 8 | CI workflow validates typecheck/build/test gates | ✅ source implemented (TASK-014); current execution is blocked by TASK-203 billing |

### Explicitly OUT of MVP-2

- Kubernetes, horizontal scaling, read replicas (see SCALABILITY.md — later)
- SSO/OAuth, RBAC beyond the existing role table
- Converting all mock modules to real tables (Phase 7+)
- AI provider integration (docs exist; build after MVP-2)

### MVP-2 exit criteria

- Fresh machine: `make setup` → app at `:8080`, API `:3000`, DB `:5432`, migrated and
  empty of Demo business data; `make seed` is a separate explicit Demo-only action.
- Browser in api mode performs the confirm-order flow **through the API**; stock and
  money writes never execute client-side.
- Concurrency test passes against real PostgreSQL.
- The same `web/` bundle powers both Pages demo and Docker web service.

## Guiding rule

Demo (localStorage/IndexedDB via PGlite) and production (PostgreSQL) are **one product
with a swappable data backend** — every feature must state which mode(s) it targets,
and schema changes ship as one Drizzle migration used by both.

## Expenses & Tax v1 extension (core implemented)

The approved next product slice is deliberately smaller than the existing expense,
reimbursement and tax-evidence programme:

```text
Expenses & Tax
└── Company Receipts
    ├── Add Receipt
    ├── All Receipts
    └── Preview / Export PDF / Print
```

For this slice, done means an authorised company user can capture or upload a safe
receipt, confirm basic merchant/date/amount/currency/category facts, save it without an
Employee Claim, browse/search company receipts, select an inclusive transaction-date
range, preview the complete matching set and generate an A4-readable Receipt Pack.
Receipts without `transaction_date` are currently Ready records, must be visibly marked
and excluded from date-range packages, and still need a real correction UI. Mixed currencies must be totalled by
currency or not totalled at all.

This extension's core is **implemented and fixture-tested** as of 2026-08-12. TASK-177–181
deliver the Company Receipt model, confirmation, permission-scoped register, query-side
date/search and immutable Receipt Pack preview/PDF/Print in Demo and API paths. TASK-182
delivers platform entitlement/canonical authorization integration. TASK-183 is complete:
the register confirmation hand-off, actual PGlite clean-evidence persistence, authenticated
same-origin API/PGlite browser journey and the same journey against a newly created
disposable PostgreSQL 16 database are browser-proven. TASK-192 later deployed migrations
through 0098 and reset production to first-run state; no authenticated production receipt
UAT is claimed. TASK-196/197/202 own Pack authorization, complete correction/edit/void
UX and artifact-governance gaps.
Expense accounting, Tax
Treatment, automated Tax Evidence, Employee Reimbursement and MyInvois remain future
or optional phases and are not v1 exit criteria.
