# Architecture

Authorization terminology and the current-to-target migration are specified separately
in [ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md). In diagrams,
`master` means customer tenant/group and `company` means legal entity; they are not
interchangeable. Platform operators use the separate `platform_principal` domain
implemented by TASK-170 and are never modeled as customer-company employees by
implication. Its support grant is a bounded authorization decision, not an implicit
customer-data proxy. TASK-171 adds the application-owned tenant permission registry
and canonical resource/action projections. TASK-172 now changes the role-assignment
tables to carry stable identity, validity, provenance and assignment-owned scope rows.
TASK-173 now centralizes the tenant permission decision path, explicit user-level
overrides, safe/audited explanations and strict current-step context for mapped generic
approvals; the current access matrix adds a shared route/module/permission regression
contract. Unknown business-module keys now fail closed; authenticated `account/*`
service routes are explicitly non-module-gated but still permission-protected. Migration
0088 supplies the company authorization-version marker and first atomic bump paths;
0089 now delivers the explicit, immutable company-scoped Company Owner cutover and
removes the legacy Superadmin authorization bypass. Centralized invalidation, deeper
delegation binding and broader organization/policy/support coverage remain open under
TASK-174. Disposable PostgreSQL 16 parity, true concurrency and non-superuser RLS proof
are green. The target database was backed up, migrations 0084–0089 applied, production
RLS re-applied and the application released; public health/root/session probes returned
200/200/401. Physical-device acceptance remains separate.

## 1. Goal

One codebase, two runtime modes, identical behavior:

```
                       ┌───────────────────────────────────────┐
                       │   UI  (Vite web app)                   │
                       ├───────────────────────────────────────┤
                       │   Business logic  (shared TypeScript)  │
                       │   order → deduct stock → invoice → GL  │
                       ├───────────────────────────────────────┤
                       │   Data access  (Drizzle ORM)           │
                       │   one schema · one set of migrations   │
                       └───────────────────────────────────────┘
                           │                          │
              VITE_DATA_MODE=demo          VITE_DATA_MODE=api
                           │                          │
              ┌────────────▼───────────┐  ┌───────────▼─────────────┐
              │ PGlite (Postgres WASM) │  │ Node API (Express)      │
              │  → IndexedDB           │  │  → node-postgres driver │
              │  → mock seed data      │  │  → PostgreSQL 100–800GB │
              │  【dist/ demo】         │  │  【Docker production】   │
              └────────────────────────┘  └─────────────────────────┘
```

The seam is the **data access layer**. Everything above it is written once.

## 2. The three-tier model

The system follows the classic ERP three-tier separation used by both SAP and Odoo:

| Tier | This project | SAP | Odoo |
| --- | --- | --- | --- |
| Presentation | Vite web app | Fiori | OWL / QWeb |
| Business logic | Shared TypeScript | ABAP / Java | Python |
| Data | PostgreSQL / PGlite | HANA | PostgreSQL |

### Reference systems

- **SAP S/4HANA** — proprietary, closed source. We learn its *business-process modeling*
  and module boundaries, not its code.
- **Odoo** — open source. We borrow its **modular architecture + ORM + PostgreSQL**
  pattern directly. ([Odoo architecture docs](https://www.odoo.com/documentation/19.0/developer/tutorials/server_framework_101/01_architecture.html))

We do **not** copy their implementation language — the stack here is TypeScript/Node,
matching the team's strength. We copy the *structure*, not the syntax.

## 3. Why PGlite, not Dexie

The demo runs with no backend server (GitHub Pages is static). It needs an in-browser
database. Two options:

| Option | Consequence |
| --- | --- |
| Dexie (IndexedDB wrapper) | Demo uses IndexedDB query API; production uses SQL → **every query written twice**, repository forced to lowest common denominator |
| **PGlite** (Postgres in WASM, persists to IndexedDB) | Demo and production run the **same SQL, schema, and migrations** → near-zero duplication |

[PGlite](https://github.com/electric-sql/pglite) is ~3 MB gzipped, is *actual* PostgreSQL
(not an emulation), and persists to IndexedDB in the browser. It satisfies the
"IndexedDB for demo" requirement literally, while collapsing the two code paths into one.

**Gating check before committing:** confirm PGlite supports every SQL feature the schema
needs (extensions, specific functions) for the target version. If a required feature is
missing, fall back to Dexie behind a repository interface. See
[DEMO_MODE.md](DEMO_MODE.md#5-known-limits).

## 4. Where business logic runs — a deliberate decision

An ERP's value is **cross-module transactional flow**. That flow must be *correct* under
concurrency in production. So:

- **Demo mode:** business logic runs **client-side** (no server exists). PGlite gives
  real transactions in the browser, so the flow is demonstrable and correct for a single
  user.
- **Production mode:** critical multi-step transactions (stock deduction, GL posting)
  run **server-side in the Node API**, inside a real PostgreSQL transaction with proper
  locking. The API is **not** a dumb CRUD proxy — invariants are enforced there, not in
  the client.

The shared TypeScript logic layer is written to be **isomorphic**: it calls the Drizzle
data interface and avoids server-only assumptions, so the same code executes in both
contexts. Where a transaction genuinely needs server-only guarantees (advisory locks,
`SELECT … FOR UPDATE`), that path is gated behind the API adapter.

> **Rule:** never let a write that affects stock or money bypass the server in
> production. The client is a convenience; the server is the source of truth.

## 5. Module structure

Each module is self-contained and registered into the core:

```
src/
  core/            # app shell, routing, auth, module registry
  data/            # Drizzle schema + adapters (pglite | api)
  shared/          # isomorphic business logic (cross-module flows)
  modules/
    inventory/     # products, stock, warehouses
    sales/         # quotes, orders, deliveries
    purchasing/    # suppliers, purchase orders
    finance/       # invoices, payments, ledger
    settings/      # users, roles (superadmin), companies
```

A module owns: its schema slice, its repository functions, its UI, its business rules.
Adding a module must not require editing another module — only registering it in
`core/module-registry`.

### Frontend implementation rule

The frontend must be built incrementally in `web/` using the user's Aria ERP design as
the visual baseline. The pasted Aria ERP prototype lives in `references/ui/aria-erp/`.
Clone its shell, navigation, spacing, and component look, while avoiding unrelated mock
data, duplicate schemas, and static screens outside the current milestone.

Current implementation note: `web/index.html` directly runs the cloned Aria classic-script
layout. `web/public/assets/erp-system-data-adapter.js` and
`web/public/assets/erp-system-api-adapter.js` are the two active `ErpSystemData`
implementations: Demo uses PGlite/IndexedDB and API uses HTTP against PostgreSQL. The
legacy Aria `DB` shape is a compatibility projection, not a temporary substitute; current
Canonical route/resource depth is tracked in STATUS.md.

The source of truth stays split as follows:

- UI shell and pages: `web/`
- schema and migrations: `src/data/schema/` + `drizzle/`
- business transactions: `src/modules/`
- production server guarantees: Node API + PostgreSQL

See [FRONTEND_PLAN.md](FRONTEND_PLAN.md).

## 6. Multi-tenancy

Three-level tenancy: **`master_fn` → `company_fn` → `user_id`**. Every business row carries
`master_fn` + `company_fn`; all queries are scoped by both (from the session, never client
input). A **company is one legal entity per country** (SG entity, MY entity), so the same
codebase serves Singapore and Malaysia at once. Isolation is **app-level in both modes**;
PostgreSQL RLS is a **production-only** defense-in-depth layer (it would be bypassed in the
PGlite demo). This mirrors the production ERP pattern (Globe3-style row scoping). Full
detail in [MULTI_TENANCY.md](MULTI_TENANCY.md) and [LOCALIZATION.md](LOCALIZATION.md).

## 7. Build outputs

| Command | `VITE_DATA_MODE` | Output | Where it runs |
| --- | --- | --- | --- |
| `npm run build:demo` | `demo` | `dist/` (static) | GitHub Pages |
| `npm run build` | `api` | `dist/` + API image | Docker |

The only difference baked into the bundle is which data adapter is wired in.

## 8. Scale assumption

This architecture is designed for a **production database of 100 GB to 800 GB**. That
assumption drives schema, indexing, pagination, and deployment choices throughout — it is
not an afterthought. See [SCALABILITY.md](SCALABILITY.md).

## 9. Expenses & Tax vertical slice

Expenses & Tax v1 is being built as a normal registered ERP module, not a disconnected
receipt mini-app. Its Company Receipt aggregate owns confirmed company-scoped metadata and
reference the existing managed-document/version boundary for bytes, scan, OCR, hash,
retention and audit. The existing Employee Claim and Tax Evidence aggregates remain
separate consumers/flows; Company Receipts must work without either one.

TASK-177/178 deliver migrations 0090/0091, a tenant-scoped
`company_receipt` table, transactional create/read/list/update/void commands and
`/api/company-receipts`. The route derives tenant/uploader identity from Session,
requires current clean managed-document evidence, uses optimistic concurrency and
audits mutations and protects immutable extraction/hash provenance. TASK-179 adds
migration 0092 plus registered own/company read permissions; list/detail authorization
selects a tenant-predicated `own | company` domain query, while mutation/confirmation
remain uploader-only under `employee.receipts.write` until TASK-182.

Demo/API adapters and the responsive five-language Company Receipts list are now
implemented with bounded cursor pagination, eight desktop fields and labelled mobile
cards. TASK-180 adds query-side search/date range. TASK-181 adds migration 0093,
immutable complete-result snapshots and one audited/no-store PDF path for Preview,
download and Print. The PDF starts with a landscape register and appends lossless PDF
pages or embedded JPEG/PNG evidence; unsupported originals use an explicit identity
placeholder. The sellable module is not yet implemented.
Final registration must land together across the backend Module Catalog,
resource/action authorization, route/access matrix, Demo/API adapters and PWA
navigation so unknown or disabled access continues to fail closed. See
[SPEC.md](SPEC.md) and [EPICS.md](EPICS.md) for the remaining boundary.

## 10. Commercial Module Catalog foundation and platform realm

TASK-185 introduces a commercial Module Catalog beside, not instead of, the existing
route access matrix and resource registry. Routes/resources reference catalog keys;
the catalog defines sellable business modules, hard dependencies and baseline services.
The platform entitlement domain rejects unknown/missing state and dependency-breaking
mutations. Tenant route/resource mapping and enforcement cut over in TASK-186.

The versioned platform path now exists: Platform → Master entitlement
(`master_module`) → Company allocation (`company_module`), with optimistic conflict
checks, authorization-version invalidation and dual-layer `effectiveEnabled`. Migration
0094 preserves Company rows and normalizes Master rows from their enabled union.
Existing tenant enforcement still reads only `company_module`; `/api/admin/modules`,
onboarding module selection and Module Activation UI remain until TASK-186.

The web entry may reuse the visual login component, but platform authentication is a
separate realm, credential store, session and CSRF boundary. Its minimal workspace lists
Masters/Companies and MAC; it is not a Company Owner shell. Explicit end-user simulation
creates a bounded linked support session whose decisions run exactly as the active
target user and whose audit retains the real platform principal.

TASK-185 is current code; tenant cutover, platform password login/workspace and
simulation remain TASK-186–188 target architecture. See
[ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md) and
[SECURITY.md](SECURITY.md) for authority and residual-risk requirements.
