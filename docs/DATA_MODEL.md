# Data Model

One Drizzle schema, shared by both modes. Same tables, same types, same migrations in
PGlite (demo) and PostgreSQL (production).

## 1. Modules and core tables

```
tenancy/     master, company, app_user, role, user_company
localization/ tax_rule (effective-dated), currency, fx_rate
inventory/   product, warehouse, stock_level, stock_movement
sales/       customer, sales_order, sales_order_line, delivery, invoice, payment
purchasing/  supplier, purchase_order, purchase_order_line, goods_receipt
finance/     account (chart of accounts), gl_entry
system/      audit_log
```

`master` / `company` define the tenant hierarchy ([MULTI_TENANCY.md](MULTI_TENANCY.md));
`company` also holds country/currency/tax_regime ([LOCALIZATION.md](LOCALIZATION.md)).

Each module owns its tables. Cross-module references are by id (e.g. `sales_order_line.product_id`).

## 2. Conventions

| Convention | Rule |
| --- | --- |
| Primary key | `bigint GENERATED ALWAYS AS IDENTITY` (room to grow past int4 at 800 GB) |
| Money | `numeric(18,2)` — never `float` |
| Timestamps | `timestamptz`, UTC; `created_at`, `updated_at` on every table |
| Tenant columns | `master_fn` + `company_fn` (NOT NULL) on every business table |
| Soft delete | `deleted_at timestamptz NULL` where history matters; hard delete only via partition detach |
| Document number | human-facing `doc_no` (e.g. `SO-2026-000123`), separate from `id` |

## 3. Multi-tenant scoping

Three-level tenancy: **`master_fn` → `company_fn` → `user_id`** (full model in
[MULTI_TENANCY.md](MULTI_TENANCY.md)). Every business table has `master_fn` + `company_fn`.
**Every query filters by both**, and they are the **leading columns** of composite indexes:

```sql
CREATE INDEX idx_so_tenant_status_created
  ON sales_order (master_fn, company_fn, status, created_at DESC);
```

The data-access layer injects `master_fn` + `company_fn` from the authenticated session —
never from client input. A missing tenant filter on a large table is a correctness *and* a
performance bug (full-tenant scan). See [SCALABILITY.md](SCALABILITY.md#2-keyset-pagination-the-offset-replacement).

## 4. Cross-module flow (the ERP core)

The canonical transaction, enforced server-side in production:

```
Confirm Sales Order
  ├─ insert sales_order (status = confirmed)
  ├─ for each line: decrement stock_level, insert stock_movement (out)
  ├─ create invoice (status = unpaid)
  └─ post gl_entry (debit AR, credit revenue)         ← all in ONE transaction
```

If any step fails, the whole transaction rolls back. This is the single source of truth
in action — one user action, consistent state across four modules.

## 5. Big tables (partitioned — see SCALABILITY.md)

These are expected to dominate the 800 GB footprint and are **range-partitioned by date**:

- `gl_entry` (ledger)
- `stock_movement`
- `audit_log`
- `sales_order_line` / `purchase_order_line` (if line volume is high)

## 6. Audit log

`audit_log` records who changed what, when. Append-only, partitioned by month, never
updated. Columns: `master_fn, company_fn, actor_user_id, entity, entity_id, action, diff jsonb, at`.

## 7. Tenancy, roles & permissions

```
master         (master_fn, name)                          -- top tenant
company        (company_fn, master_fn, country, currency, tax_regime, ...)
app_user       (user_id, master_fn, email, language, ...)  -- user belongs to ONE master; language = UI i18n pref
role           (role_id, master_fn, name, is_superadmin)
user_company   (user_id, company_fn, role_id)             -- M:N: user ↔ many companies
```

A user belongs to one `master_fn` but can be granted **many companies** (the
`user_company` junction), each with a role — e.g. an accountant covering both the SG and
MY entities. `is_superadmin` (master-level) sees all companies under its master. Full
rules and the app-level-vs-RLS isolation model are in
[MULTI_TENANCY.md](MULTI_TENANCY.md). The demo ships a sample user with access to both the
SG and MY demo companies; production wires real auth.

## 8. Migrations

Drizzle migrations live in `drizzle/` and run identically in both modes:

- Demo: applied into PGlite on first load.
- Production: `npm run migrate` against PostgreSQL.

Never hand-edit the live schema — change the Drizzle schema, generate a migration, apply
it. This keeps demo and production schemas in lockstep.

## 9. ER overview (textual)

```
master 1───* company 1───* (all business data below, scoped by master_fn + company_fn)
master 1───* app_user *───* company   (via user_company junction, with role)
company 1───* product 1───* stock_level *───1 warehouse
company 1───* customer 1───* sales_order 1───* sales_order_line *───1 product
                                  │
                                  ├──* delivery
                                  ├──* invoice 1───* payment
                                  └──* gl_entry
company 1───* supplier 1───* purchase_order 1───* purchase_order_line *───1 product
```

A diagram (`docs/er-diagram.png`) will be added once the schema stabilizes.
