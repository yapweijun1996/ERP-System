# Multi-Tenancy

The ERP is multi-tenant with a **three-level hierarchy**. Every business row is scoped by
two keys (`master_fn`, `company_fn`); users are the third level.

```
master_fn          group / holding / franchise master   (top tenant)
   └── company_fn   legal entity — ONE per country (SG entity, MY entity, …)
          └── user_id   a person who logs in
```

This mirrors the proven scope model already used in the KB-API
(`master_fn` / `company_fn` / user) and the production Globe3 ERP. We reuse it
deliberately rather than inventing a new one.

## 1. Canonical column names (single source of truth)

| Column | Level | On which tables | Notes |
| --- | --- | --- | --- |
| `master_fn` | Master/group | **every business table** | Top isolation boundary |
| `company_fn` | Company/legal entity | **every business table** | One company = one country entity |
| `user_id` | User | `app_user`, audit, ownership | The acting person |

> ⚠️ **Naming is fixed.** Earlier drafts used `company_id`; the canonical key is now
> `company_fn`, and a `master_fn` level sits above it. All docs and schema use these
> names. Do not reintroduce `company_id`.

## 2. What "company" means here

A **company (`company_fn`) is a legal entity in one country.** A group operating in both
Singapore and Malaysia has (at least) two companies under one master:

```
master_fn = ACME-GROUP
  ├── company_fn = ACME-SG   country=SG  currency=SGD  tax=GST
  └── company_fn = ACME-MY   country=MY  currency=MYR  tax=SST
```

Country, currency, and tax regime are **attributes of the company**, which is how the
same codebase serves Singapore and Malaysia simultaneously. See
[LOCALIZATION.md](LOCALIZATION.md).

## 3. Isolation model — app-level first, RLS as prod defense-in-depth

This is the key decision (and it interacts with the dual-mode architecture):

### Layer 1 — application scoping (BOTH modes, always)
Every query is filtered in the data-access layer by `master_fn` + `company_fn`, taken
from the **authenticated session, never from client input**:

```sql
WHERE master_fn = $session_master
  AND company_fn = $session_company
  AND ...
```

This is the **portable** isolation: it behaves identically in the PGlite demo and in
production PostgreSQL. It is mandatory and is the primary guarantee.

### Layer 2 — PostgreSQL Row Level Security (PRODUCTION ONLY)
[RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
adds defense-in-depth at the database level, so even a buggy query cannot leak across
tenants.

> ⚠️ **RLS is NOT in the shared schema.** It lives in a **production-only migration**,
> because:
> - PGlite (demo) runs as a single owner connection; Postgres **bypasses RLS for the
>   table owner** unless `FORCE ROW LEVEL SECURITY` is set, so an RLS policy would be
>   silently bypassed in the demo and the demo would behave differently from prod.
> - Putting RLS in the shared schema would violate the "identical schema both modes"
>   invariant ([ARCHITECTURE.md](ARCHITECTURE.md#1-goal)).
>
> **Gating check before adopting RLS:** verify in PGlite whether an RLS policy actually
> *blocks* a cross-tenant `SELECT` or is bypassed by the single owner connection. If
> bypassed (expected), keep RLS production-only. Same gating discipline as the
> [PGlite feature check](DEMO_MODE.md#5-known-limits).

Production RLS sketch (prod-only migration, with `FORCE`):

```sql
ALTER TABLE sales_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_order
  USING (master_fn = current_setting('app.master_fn')
     AND company_fn = current_setting('app.company_fn'));
-- the API sets app.master_fn / app.company_fn per connection from the session
```

## 4. User ↔ Company is many-to-many

A user is **not** locked to a single company. An accountant may handle both the SG and MY
entities under one master:

```
master              (master_fn, login_code, …)                 -- login tenant
app_user            (user_id, master_fn, username, email, …)   -- ONE master
user_company        (user_id, company_fn, role_id)              -- company membership
user_company_role   (assignment_id PK, user_id, company_fn, role_id,
                     valid_from, valid_until, revoked_at, provenance) -- active assignments
user_company_role_scope (assignment_id, resource_key, scope, target_type, target_id)
role                (role_id, master_fn, name, is_superadmin)
```

- A user always belongs to exactly **one `master_fn`**.
- Production login resolves the unique normalized `master.login_code` first and then
  the normalized `app_user.username`, whose uniqueness is scoped to that master.
- A user can be granted access to **many `company_fn`** within that master through
  `user_company`.
- `user_company_role` may assign several reusable roles, including multiple independent
  assignments of the same role, to one membership. Authorization unions only active
  assignments without widening the membership's company boundary. Assignment validity
  is `[valid_from, valid_until)` and `revoked_at` denies immediately; child scope rows
  carry validated `none/company/department/team/employee` targets.
- `user_company.role_id` remains a compatibility/default-role column for existing
  integrations; current authorization reads `user_company_role`. Migration 0046
  backfills exactly one role assignment from every existing membership.
- On login the user picks an **active company**; the session carries
  `(master_fn, active company_fn)` and scopes all queries.
- `is_superadmin` is currently a tenant/company-role permission bypass for the active
  company. It is not a platform principal and cannot cross masters.

## 5. Scoping rules (enforced everywhere)

1. `master_fn` + `company_fn` come from the **session**, never the request body.
2. Every business query filters by both — no exceptions.
3. They are the **leading columns** of composite indexes (most selective first) — see
   [SCALABILITY.md](SCALABILITY.md#3-partitioning-the-big-tables).
4. The active company can be switched in-session only to a company the user is granted in
   `user_company`.
5. Cross-company reporting (group consolidation) is an explicit, audited feature — never
   an accidental missing filter.

## 6. Why not schema-per-tenant or database-per-tenant?

| Model | Verdict at 100–800 GB, SG+MY |
| --- | --- |
| Database-per-tenant | Operationally heavy; backups/migrations × N; rejected |
| Schema-per-tenant | Migration sprawl across hundreds of schemas; rejected |
| **Shared schema + `master_fn`/`company_fn` + RLS** | ✅ One schema, one migration set, scales, matches dual-mode invariant |

Shared-schema row scoping is the only model compatible with "one schema, two modes" and
with consolidated group reporting across companies.

## Company-owned authorization

Roles and module state are legal-entity facts. A user's C-SG role cannot authorize a
C-MY request; company switch requires an explicit membership and recomputes roles,
actions, scopes and enabled modules. Data-scope resolution reads only active employees
inside the same master/company. Records without an ownership mapping are unavailable
to restricted roles. The migration copies legacy shared roles per assigned company
before repointing memberships, while existing tenants are explicitly marked live.

## Platform, tenant and company terminology

`master_fn` is the customer tenant/group security boundary. `company_fn` is one legal
entity inside it. A platform principal is neither a master user nor a company employee.
Migration 0084/0085 implements separate `platform_principal`, `platform_role`,
`platform_session` and `support_access_grant` tables. A support grant is master-scoped,
optionally company-scoped, time-bounded and audited; it does not by itself bypass the
tenant API or proxy customer data. Platform identity/session issuance remains outside
the tenant API.

Current roles, multiple-role union, assignment-owned scopes with legacy role-scope
fallback, and tenant Superadmin behavior are
documented as compatibility facts in
[ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md). TASK-171 now adds
the application-owned tenant permission registry, explicit compatibility mappings and
platform/tenant domain separation; TASK-172 adds the assignment lifecycle and scope
table. Remaining EPIC-062 tasks add centralized decisions, authorization-version
invalidation and explicit Company Owner permissions. Those target capabilities must
not be inferred from the current `is_superadmin` column.
