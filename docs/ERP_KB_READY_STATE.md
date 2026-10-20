# ERP verified state for parent KB update

Reuse existing ERP project KB; do not create a duplicate. Current source is a
contained local candidate, TASK-256 In Progress, no committed CI/deployment yet.

Goal: isolated rich fictional Demo and separately blank PostgreSQL Company target;
Company-owned BU/Position, usable staff/Leave workflows, explicit tenant-scoped
rights, five actual locale catalogs and responsive UI. MasterFN -> CompanyFN ->
staff/users ownership. Retain default denial and no automatic grants.

API/design: see HR_ORGANIZATION_SLICE.md. One live HR staff projection covers
generic and dedicated HR paths and governed permission-based Leave authority.
Company scope alone administers masters/organization assignments. BU/Position
require current active actor assignment and active same-tenant target. Self/team
retain existing account projection semantics. Approval policy/self-approval and
current ERP KB Leave balance/overlap/cancellation rules remain enforced.

Migration: append-only 0119 masters/nullable assignments and 0120 authorization
constraints; no grants/backfill/seed. Demo 121 migrations, version120. Disposable
PostgreSQL16 migration/RLS/concurrency/backup restore evidence passed.

QA and limits: evidence/TASK-256-organization-foundation.md. Current original
checkout and live configured DB unchanged. Existing /erp baseline revision
61240fec43c2aa58f9750ff8c666f5ec07fc9c4c. A separate blank production target is
still required; no tunnel/DNS/Access change. Next: isolate intended source commit,
exact-commit CI/source manifest, reviewed target restore/migration/restart and
grant activation, live QA. Do not mark production-ready from local evidence.
