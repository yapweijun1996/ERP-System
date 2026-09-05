# Task Index

Reviewed: **2026-09-05**

The machine-readable task source of truth is
[`../tasks/tasks.jsonl`](../tasks/tasks.jsonl). This file is a human-readable index,
not a second task registry.

## Current totals

- Done: **197**
- In progress: **1**
- Todo: **11**
- Blocked: **4**
- Total: **213**

## Current release-quality note

TASK-194 audited historical HEAD `00e2533`. The current EPIC-067 worktree is 100 migrations
through 0099, schema v99/252 tables, 129 Canonical / 0 Preview routes, 128 routes declaring
API mode, 1,546 English i18n keys/72 local packs, 315 permission codes and PWA v263. The sole
Canonical/API metadata difference is `staff-calendar`. HEAD collects 170 files / 666
tests at the prior audit. The final EPIC-067 worktree instead passes the full local
Vitest run at 169 files / 672 tests with one intentional file/test skip. Current source
also passes typechecks, lint, API/Demo builds, generated schema/drift/permission checks,
3 focused files / 12 tests, Platform layout E2E with both tenant modes, Demo autofill
E2E, the 59-route/13-role access matrix, 129-screen desktop/mobile audit and 129-route ×
5-language × 2-viewport audit. PostgreSQL/FORCE-RLS and executable CI remain release
blockers; public probes and older suite totals are historical evidence. TASK-211 is done:
the generated business i18n allowlist is synchronized and its CI drift check is configured;
remote workflow execution remains subject to TASK-203. TASK-212 is done: active-route
locale switching now refreshes the shell and route in place while preserving recoverable
filters, drafts, focus and scroll state; the dedicated desktop/mobile live-i18n E2E passes.
TASK-213 is done: `sales_enquiry_line` is now covered by the production FORCE-RLS overlay,
and `npm run check:production-rls` guards every generated table with both tenant keys
against accidental policy-list omission. This is source/static coverage evidence only;
least-privilege runtime-role and Platform provisioning proof remains TASK-195.

## CI and release maintenance

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-211 | Done | Regenerate the business i18n allowlist artifact and enforce its drift check in CI |
| TASK-212 | Done | Restore active-route live i18n rendering and preserve recoverable view state |

## Current authorization programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-169 | Done | Align architecture and documentation with current authorization code |
| TASK-170 | Done | Separate platform principals and time-bounded support access |
| TASK-171 | Done | Canonical permission registry and compatibility-key migration |
| TASK-172 | Done | Assignment-scoped grants, targets and expiry |
| TASK-173 | Done | Central authorization decision, explicit deny and safe explanation |
| TASK-174 | Done | Fail-closed module/resource registry and authorization versioning |
| TASK-175 | Done | Company Owner cutover, target migration 0089, production RLS re-application and application release verified |

## Completed Expenses & Tax core programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-176 | Done | Source-audit and document the approved Company Receipts-only v1 boundary; synchronize KB without code or deployment |
| TASK-177 | Done | Migration 0090, Company Receipt aggregate/domain/API, optimistic concurrency, audit and PGlite/PostgreSQL RLS proof |
| TASK-178 | Done | Migration 0091 exact-hash uniqueness and immutable OCR-provenance confirmation/manual-fallback context |
| TASK-179 | Done | Migration 0092, explicit own/company read grants, bounded Demo/API register and responsive five-language desktop/mobile UI |
| TASK-180 | Done | Query-side search and inclusive range behavior; source audit records Missing Date correction as pending TASK-197 |
| TASK-181 | Done | Migration 0093 immutable Receipt Pack snapshot, complete-set mixed-currency PDF preview/download/Print and audited Demo/API rendering |
| TASK-182 | Done | Migration 0097 canonical Company Receipt mutation grants, platform entitlement, Demo/API/UI fail-closed guards, accessMatrix and five-language parity |
| TASK-183 | Done | Dated Demo/API/PostgreSQL fixture proof; later audit corrects UI/Pack evidence gaps and TASK-192 is the later deployment checkpoint |

TASK-182 additionally depends on TASK-186 so Expenses & Tax adopts the platform-owned
entitlement model rather than extending the current tenant MAC authority. TASK-177–181
retain their existing dependency order and are not blocked by EPIC-064.

## Completed Platform Module Entitlement core programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-184 | Done | Source-audit current tenant MAC, record the approved target and synchronize docs/KB |
| TASK-185 | Done | Module Catalog, Master entitlement, Company allocation, platform API and Demo harness |
| TASK-186 | Done | Removed tenant MAC permission/UI/onboarding authority; legacy API denies and dual-layer enforcement/defaults are live |
| TASK-187 | Done | Independent Platform Superadmin login/workspace and audited exact-user simulation (migration 0096) |
| TASK-188 | Done | Migration, authorization, dual-mode, browser and release proof plus final docs/KB |

## Platform bootstrap and tenant provisioning programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-189 | Done | Empty-database Platform Superadmin registration, setup-state cutover and independent session |
| TASK-190 | Done | Platform Master/Company provisioning, Master Admin RBAC, defaults, idempotency and migration 0098 |
| TASK-191 | Done | Platform workspace UX plus API, browser, isolation and negative authorization tests |
| TASK-192 | Done | Production deployment, verified backups, complete PostgreSQL/document-storage reset and final proof |
| TASK-193 | Blocked | Administrator email self-service reset; SMTP is not configured in production |

TASK-189–192 are complete. At its dated checkpoint, TASK-192 deployed migration 0098/RLS,
preserved and restore-tested pre-reset data, removed only the two named ERP volumes,
recreated without seed, and left the site at first Platform registration. That checkpoint
had 249 public tables, 221 forced-RLS tables, zero non-migration rows/document entries and
healthy public probes. It is not current-live proof: TASK-194 probes returned 502 and the
exact deployed HEAD is unverified. Source CI run `31570902479` passed all four shards;
HEAD run `31603746668` was blocked before job start by GitHub Actions billing.
TASK-193 is intentionally blocked rather than claiming email
delivery: `SMTP_HOST` is empty and no password-reset mail path is enabled.

## Production Trust & ERP Excellence hardening programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-194 | Done | Audit HEAD, correct all source-of-truth layers and register verified hardening work |
| TASK-195 | Todo | Least-privilege runtime roles and RLS-compatible Platform provisioning proof |
| TASK-196 | Todo | Receipt Pack visibility downgrade repair and export governance |
| TASK-197 | Todo | Permission-aware Company Receipts correction/edit/void and capture UX |
| TASK-198 | Done | Approved the narrow dual-mode exception: reason/ticket for elevated Admin access, exact-user simulation without reason/ticket, and explicit no-MFA/no-step-up risk acceptance |
| TASK-199 | Todo | Restore public availability and prove exact deployed revision |
| TASK-200 | Todo | Resolve 129/128 route parity and rerun current HEAD release evidence |
| TASK-201 | Todo | Production SLO, scale, worker monitoring and RPO/RTO proof |
| TASK-202 | Todo | Receipt Pack lifecycle, concurrency, Decimal/timezone and Unicode i18n |
| TASK-203 | Blocked | GitHub Actions billing/spending prevents every job from starting |
| TASK-204 | Todo | Correct SG GST/MY SST validity, classification and posting semantics |
| TASK-205 | Todo | Prove Vision provider failures and production-configuration boundaries |
| TASK-213 | Done | Close production RLS coverage omission and add schema drift guard |

## Platform tenant administration programme

| Task | Status | Purpose |
| --- | --- | --- |
| TASK-206 | In progress | Migration 0099, hidden non-login bridge actor, immutable Platform Tenant Admin role/membership and bounded session foundation; PostgreSQL/RLS completion depends on TASK-195 |
| TASK-207 | Todo | Elevated tenant authorization, audited scope switching, Company-bound break-glass and adversarial workflow proof |
| TASK-208 | Todo | Platform/Tenant workspace dual-mode UX, MAC-effective Admin navigation and exact Employee integration |
| TASK-209 | Blocked | PostgreSQL/RLS, CI, browser, release, documentation and KB proof; blocked by TASK-195 and TASK-203 |

The registry therefore has **197 Done / 1 In progress / 11 Todo / 4 Blocked / 213 Total**.
The blockers are TASK-017 (physical phone), TASK-193 (SMTP/recovery), TASK-203 (CI
billing) and TASK-209 (release proof waiting for TASK-195/TASK-203). Dependencies and
epic references are valid.

TASK-213 closes the source-level RLS table-list omission for `sales_enquiry_line` and
adds a deterministic generated-schema coverage gate. It does not establish a
non-superuser PostgreSQL deployment role, Platform provisioning context or current
production availability; those boundaries remain explicitly owned by TASK-195/199/209.

TASK-185 delivered migration 0094 and the platform foundation. TASK-186 delivered
migration 0095, retired the tenant permission/API/UI/onboarding backdoors, applied Master
defaults to new Companies and cut registered tenant enforcement over to both layers.
TASK-187 delivered migration 0096, independent password/cookie Platform Superadmin login,
the shared API-mode realm chooser, Master/Company workspace and bounded exact-user
simulation with dual identity audit. TASK-188 completed source verification: focused platform
proof, root/Web typechecks, lint, schema drift, API/Demo builds, PGlite browser boot,
desktop/mobile Company Receipts E2E, direct PGlite/PostgreSQL 16 migration-preservation
replay, disposable PostgreSQL 16 non-superuser RLS proof, access-matrix, browser i18n and
desktop/375px smoke all pass. A same-origin 375px browser check covers Platform Superadmin
realm login, workspace rendering, exact-user simulation, explicit return and document-width
containment. The original TASK-188 single-worker proof passed 167 files and 660 tests
with one expected skip in 976.88 seconds. A later 2026-08-12 checkpoint
`npm test -- --reporter=dot` run passed 168 files and 663 tests with one expected skip
in 1304.96 seconds; it predates the current 170-file/666-test collection.
TASK-186's recorded focused authorization proof remains 8 files / 45 tests. TASK-187's
isolated proof passes 3 files / 12 tests, root/Web typechecks, API build and schema v96
drift; its browser check covers API-mode realm login and workspace only. No production
deployment or production-data mutation was authorized or performed for TASK-188.

TASK-177–179 implement the Expenses & Tax backend/capture/register foundation:
aggregate, exact-hash confirmation, explicit own/company list/detail permissions,
bounded Demo/API reads and responsive desktop/mobile register UI. TASK-180 adds
query-side search/date behavior; TASK-181 adds the immutable complete-result Receipt
Pack and one PDF for preview, download and Print. TASK-182 is complete: Expenses & Tax
uses the platform-owned Master entitlement plus Company allocation in API, Demo and UI;
Company Receipt create/edit/void now use registered canonical permissions rather than the
compatibility key. TASK-183 is complete: the confirmation entry, PGlite clean-evidence
browser persistence, isolated same-origin API/PGlite journey and a new disposable
PostgreSQL 16 browser journey passed at that checkpoint. The 168-file/663-test result is
dated TASK-183 evidence, not a HEAD rerun. TASK-192 later deployed migrations through
0098 and reset the target to first-run state; no authenticated production receipt UAT is
claimed. TASK-196/197/202 own the audit-discovered Pack and UX gaps.

## Latest implementation milestones

- **TASK-210 — Done (2026-09-05):** the PWA update toast now renders the exact waiting
  service-worker release code beside the localized **Update now** / **Later** actions;
  cache, script and source version references are aligned at v263 and the lifecycle audit
  asserts the displayed code. Narrow mobile boot loading is content-driven at 390px,
  375px and 320px without horizontal overflow or clipping. Lint, both typechecks, Demo
  transaction proof/build, PWA lifecycle audit, the full 129-route × 5-language ×
  2-viewport i18n matrix and desktop/mobile smoke all pass.
- **TASK-175 — Done:** migration
  `0089_company_owner_cutover.sql` creates or normalizes one immutable company-scoped
  Company Owner role per company, backfills 112 explicit registered permission rows and
  `* / company` scope, moves legacy Superadmin assignments idempotently, makes the
  legacy `is_superadmin` flag inert and preserves last-owner recovery compatibility.
  Central authorization now evaluates role permissions and scopes only; a legacy
  Superadmin-only assignment is denied. Focused cutover, authorization, lifecycle and
  setup tests pass. A disposable PostgreSQL 16 container passed Demo parity/true
  concurrency and the non-superuser RLS security suite. The target production database
  was backed up to `output/production-backup-20260810/erp-before-0089.dump`, migrations
  0084–0089 were applied, production RLS was re-applied and `deploy/release.sh`
  completed. Post-release checks confirmed 90 migration entries, 219 forced-RLS
  tenant tables/policies, zero active Superadmin flags/assignments, healthy services,
  public `/health` 200 and unauthenticated session 401.
- **TASK-173 — Done:** migration `0087_pink_shadowcat.sql` and
  `src/auth/authorization.ts` provide the central tenant decision boundary, safe public
  reason codes, explicit user-level override precedence and audited explanations. All
  approval slices now re-check their registered permission in the domain command. The
  versioned leave/expense workflow additionally binds permission decisions to the
  current locked step, server-resolved resource/module/scope context and policy
  snapshot; inactive named authorities are denied, and manager-owned steps cannot be
  taken over by an HR permission. Existing in-flight instances continue under their
  snapshotted authority with no implicit migration. Focused authorization, approval and
  API regressions passed 18/18 for that strict-step slice; root typecheck passed.
  The recorded 2026-08-12 full Vitest run passed 663 tests with 1 intentional skip
  across 168 test files; current HEAD instead collects 170/666 and was not run in full
  by TASK-194. The prior Team Calendar fixture failures were aligned to explicit HR approval
  permissions. Instance/step/resource/policy-bound delegation remains a follow-up
  hardening item.
- **TASK-172 — Done:** migration `0086_youthful_mac_gargan.sql` adds the stable
  `user_company_role.assignment_id` primary key, `[valid_from, valid_until)` validity,
  assignment/revocation provenance and `user_company_role_scope`. The role-assignment
  service/API supports multiple independently scoped assignments and validated
  `none/company/department/team/employee` targets; permission, approval, setup and
  impersonation checks share the active-assignment predicate. Existing
  `role_resource_scope` rows remain a dual-read fallback for assignments whose
  `scope_backfilled_at` is null. Expired and revoked assignments are denied immediately;
  TASK-173 is complete in migration 0087. Migration 0088 provides the Company
  authorization-version source; TASK-174 completes browser snapshot invalidation,
  Master-wide support bumps and stale-session/direct-URL proof.

## Latest completed authorization task

- **TASK-174 — Done:** TASK-174-A treats unknown business-module keys as
  disabled at the backend gate, registers payroll and explicitly keeps authenticated
  `account/*` service routes outside business-module switching while retaining their
  route permissions. TASK-174-B now has migration 0088's company-scoped
  `authorization_version`; core role, assignment, scope, module, override and
  invitation mutations bump it atomically, Master-wide support grant changes advance
  every Company marker, and session/effective-capability projections expose it. API
  requests carry the marker; stale state receives 409, recovers through the session
  endpoint and reloads without replay. Current server decisions query live permission,
  organization and workflow-policy rows. Focused TASK-174 coverage passes 19/19.

- **TASK-171 — Done:** `src/auth/permissionRegistry.ts` became the application-owned
  registry. At that task checkpoint it contained 299 static definitions (157 compatibility entries and 142
  canonical entries, including a separate platform-support domain); the resource
  registry projects exact canonical permissions for 116 resources and 62 actions,
  including 5 update contracts. Ordinary role evaluation and approval authority
  resolution use explicit registry candidates and fail closed for unknown keys;
  platform-domain keys are rejected before tenant role evaluation; the legacy
  Superadmin compatibility role is deprecated and no longer bypasses permissions.
  Role editing/template cloning, leave approval configuration and expense extra-
  approval configuration reject unregistered tenant permissions. Existing broad
  `role_permission` text keys remain compatible through explicit mapping metadata;
  TASK-172 owns the assignment migration; TASK-173 now owns the central decision and
  explicit-override boundary; migration 0088's source/marker and TASK-174 invalidation
  are implemented, while Company Owner cutover is delivered in migration 0089. The disposable
  PostgreSQL 16 parity, concurrency and RLS proof for TASK-175 are green, and target
  production migration and release verification are complete.
  `npm run check:permissions` is the CI gate for source literals, role templates,
  resource/action contracts and compatibility metadata. Current HEAD contains 314
  definitions. The recorded pre-HEAD full run passed 168 files plus 1 skipped file
  (663 passed, 1 skipped tests);
  the prior HR
  fixture failures were corrected without widening the production role templates.

- **TASK-170 — Done:** migration 0084/0085 adds platform principals, platform roles,
  hash-backed bearer/CSRF sessions, auditable support grants and exact master/company
  boundaries without making platform principals tenant users. Read-only, restricted-
  write and approval-referenced break-glass modes are bounded to 24 hours, default-deny
  sensitive fields, and revocable. `/api/platform` accepts only the separate platform
  session contract. Issuance was out of band at TASK-170; EPIC-064/065 later added
  interactive login and controlled empty-database bootstrap. The support evaluator
  remains a fail-closed decision/audit boundary, not an automatic customer
  data proxy. Domain/API tests cover tenant-cookie rejection, CSRF, expiry, revoke,
  cross-tenant and sensitive-field denial. The complete 151-file Vitest set passes in
  three resource-safe shards: 606 passed, one expected skip, zero failures.

- **TASK-168 — Done:** permission-aware shell navigation, global search, quick actions,
  module state, employee workspace behavior and the role matrix are verified against
  active-company capabilities. The authoritative Manager template and Demo v15 pack now
  use company scopes for generic sales/CRM/inventory/warehouse/project/service collections
  whose rows do not carry actor ownership. Actor-derived My Work and Team Calendar APIs
  continue to enforce direct/granted-tree boundaries. The complete 149-file Vitest set
  passes in three resource-safe shards: 599 passed, one expected skip, zero failures.

## Next dependency-ordered execution slices

These are implementation slices, not new task records. They preserve the task index
statuses above and keep each change independently testable:

1. **TASK-173-A1 — Done (2026-08-10):** direct Sales Order and Purchase Order
   approve/reject actions now require their dedicated registered approval permission and
   the domain commands require an active tenant actor plus the pending order/approval
   workflow state. Adversarial tests prove permission removal leaves both rows unchanged.
2. **TASK-173-A2 — Done (2026-08-10):** Purchase
   Requisition approve/reject now routes through `purchasing.approve` plus the current
   locked `submitted` state; Sales Commission run approval now routes through
   `sales.commission.approve` plus the current locked `draft` state; allowance approval
   now re-checks `expenses.allowance.manage` before its locked `calculated → approved`
   transition; budget approval now re-checks `finance.budget.approve` before its draft
   activation transition. The HR workflow now requires the current step authority and
   passes resolved resource/module/scope/policy context into the central evaluator; no
   implicit in-flight migration or takeover is allowed. Focused strict-step coverage
   passes 18/18.
3. **TASK-174-A — Done:** unknown business-module keys now fail closed, payroll
   is part of the registered module set, and authenticated `account/*` services are
   explicitly non-module-gated while retaining permission checks. Resource/action/
   ownership denial and the access-matrix CI/browser assertions are verified.
4. **TASK-174-B — Done:** migration 0088 and atomic bump paths are implemented;
   Master-wide support changes advance all Company markers, stale browser snapshots
   fail closed and direct-URL revocation is proven after session refresh.
5. **TASK-175 — Done:** migration 0089 replaces
   the tenant `is_superadmin` bypass with an immutable Company Owner role, 112 explicit
   tenant permission rows and company scope. Legacy flags/assignments are made inert or
   backfilled idempotently; last-owner recovery and platform isolation remain covered.
  Disposable PostgreSQL 16 parity, true concurrency and RLS proof are green. The
  production backup, migration, RLS re-application, application release and public
  health/session verification completed on 2026-08-10. No physical-device acceptance
  is implied.
6. **RELEASE-I18N-001 — Done.**
   Missing local-pack keys and hardcoded/dynamic system-authored UI text were resolved;
   `node scripts/audit-i18n.mjs` passes 1,533 canonical keys / 69 local packs; the
   full matrix now passes 128 routes × 5 languages × 2 viewports. This remains an
   execution slice, not a new machine-readable task record, and is independent of
   TASK-173–175.
7. **RELEASE-SMOKE-001 — Done.** `npm run smoke` passes at desktop and mobile after
   the assertion was scoped to visible semantic badges; hidden zero-count badges remain
   in the DOM for stable accessibility behavior.

## Blockers

- **TASK-017:** physical-phone PWA verification. Automated desktop and emulated 375 px
  checks do not satisfy the real-device acceptance criterion.
- **TASK-193:** administrator email recovery. Production SMTP and Platform recovery are
  not configured/proven.
- **TASK-203:** GitHub Actions billing/spending. The HEAD workflow starts zero jobs; no
  code failure or green CI result may be inferred.

See [ROLE_PERMISSION_ARCHITECTURE.md](ROLE_PERMISSION_ARCHITECTURE.md) for the current
implementation boundary and migration dependencies, and [EPICS.md](EPICS.md) for epic
acceptance criteria.
