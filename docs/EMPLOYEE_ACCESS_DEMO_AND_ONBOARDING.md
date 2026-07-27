# Employee Access, Enterprise Demo and Customer Onboarding

This is the authoritative EPIC-059 contract. It defines company-level access,
atomic Staff onboarding, the deterministic enterprise Demo and the production
customer Go Live boundary. The Chinese summary is
[EPIC_059_SUMMARY.md](zh/EPIC_059_SUMMARY.md).

## 1. Access model

The immutable system templates are Superadmin, Company Admin, Manager, Sales,
Buyer, Warehouse, Production, Finance Preparer, Finance Checker, HR, Service and
Viewer. An administrator copies a template into an editable role owned by the
active company; a role assigned in one legal entity grants nothing in another.

Effective permissions are an Allow-only union across active-company roles. Action
keys include read, create, edit, approve, post, pay and export. Resource scopes are
`self < team < department < company`; multiple roles use the widest applicable
scope. There is no explicit Deny. A restricted resource without a usable owner,
reporting line or department mapping fails closed. Navigation, search, quick-create,
buttons and sensitive fields derive from the same effective capability response,
while direct URLs and API calls remain protected by server-side 403/404 responses.

Modules are company-owned. `company_module` rows are explicit and missing rows mean
disabled. The central dependency graph is acyclic: Finance precedes Sales,
Purchasing, Project and Assets; Inventory precedes Warehouse, Quality and
Manufacturing; Warehouse also precedes Manufacturing; CRM precedes Service. Admin
cannot be disabled. Existing companies are expanded with their prior effective
state; new companies start with only the setup-safe Admin module enabled.

## 2. Staff onboarding and account lifecycle

The Add Staff wizard captures employee details, manager, login identity,
active company, one or more roles, leave opening and an initial password. HR may
save a non-secret `staff_onboarding_draft`; only activation accepts a password.
Activation is one transaction that creates or links the organization identity,
creates the company membership and role grants, links the employee, initializes
leave balance and appends audit evidence. Any failure rolls back every write.

Usernames are unique inside the organization. If the username already exists, the
workflow links that identity to the active company instead of creating a duplicate.
Initial passwords are hashed immediately, never returned or logged, expire at first
use or after seven days, and force a password change. Reset revokes active sessions;
offboarding disables the identity while preserving historical ownership. Setup-stage
employees cannot establish a session before the company is live.

Production has no impersonation endpoint. Demo-only persona switching establishes a
real session for each of the 12 personas and therefore exercises the same company,
role, scope and module checks as an ordinary login.

## 3. Deterministic enterprise Demo

The compact `seedDemo` fixture remains suitable for unit and integration tests. A
separate generated pack, `erp-system-showcase-v1.sql`, is loaded only by a new Demo
database. Its manifest fixes business date `2026-07-27`, version, record counts and
SHA-256. The browser verifies the hash, executes the pack inside one transaction and
records measured load time. Existing IndexedDB data is never replaced silently; the
user must confirm an irreversible reset or upgrade.

The pack contains independent Singapore and Malaysia legal entities (SGD/GST and
MYR/SST), 12 real personas, at least 100 employees, about 200 customers, 100
suppliers, 500 products and exactly 10,000 deterministic activity, inventory and GL
records. Stock movements are paired and journals balance by company and reference.
Cross-company Finance and HR assignments demonstrate legal-entity separation. The
target is at most 15 seconds for first load and p95 at most two seconds for common
pages and reports on a current Chrome browser and ordinary modern laptop.

Demo data is public sample data. It must contain no customer data, production URL or
secret. The production seed command requires both `ERP_ENV=demo` and
`ERP_DEMO_SEED=I_UNDERSTAND_DEMO_DATA`, rejects production configuration and refuses
a non-empty database.

## 4. Production onboarding and import

The deployment setup token creates only the organization, first company and
Superadmin. The authenticated company onboarding state advances sequentially through:

1. company and tax;
2. fiscal year and chart of accounts;
3. warehouses;
4. modules;
5. roles;
6. Staff accounts;
7. import;
8. opening-balance reconciliation;
9. UAT;
10. audited Go Live.

Before Go Live, only administrators may configure the company; employee sessions and
transaction writes are blocked. `onboarding_import_job` stages CSV/XLSX employee,
customer, supplier, product, account, warehouse, inventory, AR, AP and GL rows through
one server preflight pipeline. Limits are 10 MB and 25,000 rows. Validation covers
duplicates, references, tenant/company/currency, inventory quantity and value,
control accounts, period state and balanced GL. Zero errors are required, warnings
need explicit confirmation, source hashes prevent replay, and commit is all-or-nothing.

Go Live requires every prior stage, no invalid or uncommitted import, balanced opening
GL and an audit actor. The transition is optimistic-versioned and auditable.

## 5. Interfaces and compatibility

Public TypeScript contracts include `RoleTemplate`, `CompanyRole`,
`EffectiveCapability`, `DataScope`, `CompanyModuleState`, `StaffOnboardingDraft`,
`OnboardingStatus` and `ImportJob`. APIs cover role-template reads and copies,
permission/scope updates, Staff draft CRUD/activation, onboarding state and stage
completion, import preflight/commit and Go Live. Session payloads include effective
permissions, scopes, companies, modules and onboarding status; legacy `hasAdmin`
remains during compatibility migration.

Migration 0073 uses expand/backfill: legacy roles are copied per assigned company,
permissions and assignments are repointed, group module state expands per company and
existing tenants become live. Legacy nullable roles remain readable while persistent
PGlite completes its idempotent upgrade. All new tenant tables are covered by the
production RLS policy generator.

## 6. Release evidence

Required proof covers fresh and migrated PGlite, PostgreSQL forced RLS and company
isolation, Staff activation/rollback/password lifecycle, all 12 templates, multi-role
union, four data scopes, fail-closed ownership, module dependencies, CSV/XLSX
validation and atomicity, Demo manifest/hash/count/balance and repeatable reset. The
release gate is lint, both typechecks, full tests, Demo/PostgreSQL proof, schema drift,
both builds, smoke, 122 routes × five languages × desktop/375px and focused Chromium,
Firefox and WebKit flows. A simulated 375px viewport does not close physical-device
TASK-017.

### Verified release evidence — 2026-07-27

- Migration 0073 and the ordered PGlite v73/v74 compatibility path pass fresh install,
  persistent upgrade and obsolete-index repair. PostgreSQL and generated Demo schemas
  agree on 232 tables.
- `npm test` passes 134 files plus one expected skip: 518 tests pass, one skips and none
  fail. Lint, root/Web typechecks, generated-schema/pack/i18n checks and both builds pass.
- Demo/PGlite and the retained isolated PostgreSQL proof database
  `erp_epic059_20260727_1905` agree on business results; the non-superuser PostgreSQL
  suite proves forced RLS and cross-company denial. The Compose project
  `erp-uat-20260727` remains healthy for review on web/API/database ports
  18080/13000/15432.
- Desktop and 375px smoke pass. The independent screen audit passes all 122 Canonical
  routes, and the i18n audit passes 122 routes × en/ms/zh/ja/vi × both viewports with
  1,246 matching locale keys and 73 registered module packs.
- Staff create/activate, template copy, scope/module control, Demo reset, CSV import and
  Go Live pass Chromium, Firefox and WebKit. Browser UI import evidence uses a real
  `File` boundary with a controlled adapter; server tests independently prove parsing,
  preflight, replay protection and transaction rollback.
- Enterprise Demo cold load measured 8.905 seconds in current Chromium, below the
  15-second target. Thirty warmed navigation samples across ten common pages/reports
  measured p95 38.7 ms, below the two-second target. Firefox and WebKit cold-load
  measurements are compatibility evidence, not the Chrome performance acceptance.
- The production seed CLI exits before writes without both explicit Demo flags and also
  rejects the retained non-empty proof database. The separate, broader safety work for
  running `POSTGRES_URL npm run demo` against an arbitrary seeded database remains
  EPIC-058 TASK-147 and is not claimed complete here.

No customer credentials, production URL or secret is included in the generated pack or
documentation. SMTP, live bank/tax integrations and multi-year historical migration are
outside this Epic. A 375px emulator is not a physical phone; TASK-017 remains blocked.
