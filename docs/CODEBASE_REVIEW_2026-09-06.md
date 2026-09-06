# ERP-System Codebase Review — 2026-09-06

This review began from `main` at `2188f56` (`New`) and now records the completed
TASK-195–197 follow-up plus the source-level TASK-204 hardening in progress. Source and tests are the implementation truth; [STATUS.md](STATUS.md) is the current status summary; [SPEC.md](SPEC.md) and
[PROJECT_LOGIC.md](PROJECT_LOGIC.md) remain the binding domain references. The older
[ERP excellence review](ERP_EXCELLENCE_REVIEW.md) is retained as a dated historical
baseline.

## Current verified baseline

- The source contains **102 ordered migrations through schema version 101**, **252
  generated tables**, **315 permission codes**, **222 production-RLS policy tables** and
  **10 explicit infrastructure/control-plane exemptions**.
- The source inventory is **129 Canonical routes / 0 Preview routes**. All **129 routes
  declare API-mode metadata**, including `staff-calendar`, whose API adapter and
  `/api/hr/calendar/staff` endpoint are now part of the parity contract.
- Local static/generated checks pass: lint, root/Web typecheck, Demo schema, schema
  drift, permission registry, production-RLS coverage, i18n bootstrap/business checks
  and Demo showcase-pack verification. The current `test:e2e:setup-wizard` also passes
  desktop, iPhone-width and small-mobile layout checks. These checks do not prove live
  PostgreSQL provisioning, public deployment, or GitHub Actions execution.
- The task registry currently reports **201 Done / 2 In Progress / 6 Todo / 4
  Blocked / 213 Total**. The actionable boundary is concentrated in TASK-199–205 and
  EPIC-067/TASK-206–209; the blocked items are external or operational, not silently
  treated as code failures.
- TASK-204 source work is now in progress: migrations `0100`/`0101` add governed tax
  classification/recoverability/source facts and the Expense snapshot; the generated
  Demo schema is version `101`. Its external tax-owner production review remains open.
- The complete pending-task breakdown, including dependencies, next actions and evidence
  boundaries, is [PENDING_TASK_BREAKDOWN_2026-09-06.md](PENDING_TASK_BREAKDOWN_2026-09-06.md).
- During this review the user-owned PWA/setup-wizard changes were committed as
  `2339ad2`: `package.json`, `web/public/assets/pwa.css` and
  `tests/e2e/setup-wizard-layout.spec.mjs`. The new E2E passes at desktop, iPhone and
  small-mobile widths. `.playwright-cli/` remains present but is not part of the commit;
  keep it out of release artifacts.

- TASK-195 is now **Done**: Platform Company provisioning sets transaction-local tenant
  context after generating the exact Company key; Compose separates migration,
  API and worker roles; the current HTTP bootstrap → Master → Company route passes
  PostgreSQL 16 FORCE-RLS with cross-tenant denial. Production revision, CI and
  elevated Platform Admin evidence remain separate gates.

## Action backlog

### P0 — close before calling the Platform/Expenses release production-ready

- **TASK-195 — Done 2026-09-06: Platform provisioning/RLS boundary closed.**
  - `setTenantContext()` is called immediately after server-side `companyFn`
    generation, before the first `role_resource_scope` write.
  - Compose provisions separate migration/bootstrap, API and worker roles; the
    profiled migrator is the only path using the owner connection. Role provisioning
    and verification scripts do not print passwords.
  - `src/api/platformProvisioning.postgres.integration.test.ts` exercises the current
    HTTP bootstrap → Master → Company path as a `NOSUPERUSER NOBYPASSRLS` role and
  proves RLS-filtered reads plus `42501` cross-tenant write denial. The existing
  full security suite remains for broader lifecycle coverage rather than being the
  only Platform proof.

- **TASK-196 — Done 2026-09-06: Receipt Pack authorization and export governance closed.**
  - Pack metadata and PDF routes now pass current own/company visibility into the domain;
    company snapshots require current `read_company`, while own snapshots allow own or
    company access. Downgrade, revoked-read and active-tenant changes return safe denial.
  - Preview and original-evidence download/print have explicit access-purpose audit
    fields, a no-store response and current domain/API/PostgreSQL coverage, including
    cross-tenant Pack and source-evidence denial.

- **TASK-197 — Done 2026-09-06: Company Receipts normal workflow is now permission-aware.**
  - **Evidence:** the list API and Demo adapter return canonical create/edit/void
    capabilities; the UI hides unauthorized actions, opens a versioned detail editor,
    corrects Missing Date in place and submits retained reasoned voids. The new
    `/api/company-receipts/evidence` contract and Demo equivalent return only current,
    clean, uploader-owned, unbound receipt evidence with bounded search/cursor paging.
  - **Boundary:** direct Company Receipt confirmation remains Employee-independent;
    governed binary capture/upload remains in My Receipts and therefore still requires
    its existing Employee Self Service boundary. This is explicit v1 product behavior,
    not an accidental picker dependency.
  - **Verification:** domain/API integration, Demo/API browser journeys, responsive
    desktop/mobile assertions, read-only UI denial and five-language copy all pass; API
    mutation permission and optimistic-conflict coverage remains enforced server-side.

- **TASK-204 — In Progress 2026-09-06: source-level GST/SST correctness hardened.**
  - `tax_rule` and expense policy use one `[valid_from, valid_to)` interval; policy
    overlap/boundary tests and database checks reject zero-length ranges.
  - Explicit tax classification, recoverability percentage, official source URL/effective
    date and review facts are stored. Purchase order, supplier invoice, purchase return,
    supplier debit note and Expense policy/posting paths fail closed on unclassified or
    regime-incompatible rules; MY SST is non-recoverable by default.
  - Decimal tests cover GST standard/zero/exempt, SST service/deductible and boundary
    behavior; SG and MY purchase posting tests remain balanced with different GL legs.
  - Remaining release gate: a qualified tax owner must review the production configuration
    against current IRAS and Royal Malaysian Customs/MOF sources. This is not claimed by
    local source tests.

- **TASK-199 + TASK-203 — Release evidence is incomplete even when local checks pass.**
  - **Evidence:** the repository records historical public 502 probes and a GitHub
    Actions run that started zero jobs because of account billing/spending limits. The
    current source is not evidence of the deployed revision or current public health.
  - **Action:** diagnose public `/health`, root and setup availability read-only first;
    restore service if needed; record immutable deployment revision/assets. Separately
    restore CI billing/runner execution and rerun required checks.
  - **Acceptance:** public probes return the expected contract, the deployed revision
    is recorded and matches the release commit, CI executes (not merely queues or
    reports an infrastructure failure), and no tenant reset/seed is used as a
    diagnostic shortcut.

### P1 — close before the next broad release or operational scale claim

- **TASK-200 — Done 2026-09-06: Canonical/API route parity closed.**
  - `staff-calendar` is now included in `API_SCREEN_ROUTES`; the static audit rejects
    future Canonical/API metadata gaps.
  - Current `audit:screens` passes all 129 routes at desktop and mobile. API integration,
    authenticated API browser, Staff Calendar Demo E2E, access-matrix and the full
    129 × 5 × 2 i18n browser matrix pass separately from the Demo route audit. The
    Staff Calendar API integration suite passes 6/6 tests.

- **TASK-202 — Receipt Pack lifecycle is not yet a complete governed artifact.**
  - **Action:** after TASK-196, define concurrent idempotency behavior, list/history,
    retention/legal-hold/purge rules, locale-aware Unicode PDF rendering, Decimal-safe
    UI amounts and company-calendar date presets. Add regression tests for replay,
    concurrent access and artifact/source hash integrity.

- **TASK-201 — Production operations lack measurable SLO/DR proof.**
  - **Action:** define availability/error/latency SLOs, RPO/RTO, backup retention and
    restore drills, worker/outbox monitoring, and representative 100–800 GB query/load
    budgets. Deployment scripts and one disposable proof database are not substitutes
    for operational evidence.

- **TASK-205 — Vision provider failure behavior is under-specified.**
  - **Action:** test BYOK Vision gateway failure, retry/manual-review/fallback behavior,
    configuration absence and audit boundaries. Do not imply a Vision-to-local-OCR
    fallback until the code and user-facing state actually implement it.

- **EPIC-067 / TASK-206–209 — Platform Admin work has a dependency chain.**
  - **Action order:** complete the hidden actor / elevated-session foundation in
    TASK-206; then complete authorization switching,
    break-glass and audit proof (TASK-207), browser/access/i18n integration (TASK-208),
    and only then release TASK-209. TASK-203 remains an independent CI gate.

### Blocked or human-owned follow-up

- **TASK-017:** real-device validation is still required for the PWA/mobile flow; a
  headless 375 px viewport cannot close that acceptance criterion.
- **TASK-193:** administrator email reset remains blocked until production SMTP,
  templates, rate limits, audit and end-to-end mail delivery are configured.

## Recommended execution order

- **First:** complete the TASK-204 tax-owner review; its source-level fix is already in
  progress and the remaining risk is configuration/release evidence.
- **Next:** TASK-199/TASK-203 for deployment/CI evidence, then the TASK-206 → 207 → 208
  Platform dependency chain before TASK-209 release proof.
- **Documentation rule:** this review found no approved domain-contract change by
  itself. Update `PROJECT_LOGIC.md`, `SPEC.md` and the relevant KB item in the same
  task whenever an implementation changes one of these contracts.

## Verification boundary

- Verified locally for this review: generated Demo schema, schema drift, permission and
  production-RLS coverage, lint, root/Web typechecks, Demo transaction proof, API/Demo
  builds and the targeted TASK-204 tax/Expense/purchasing tests. TASK-195 also passed
  the disposable PostgreSQL 16 `npm run test:postgres` run (2 files / 2 tests), including
  the current Platform HTTP path and runtime-role verification.
- TASK-196 focused proof passed: Company Receipt Pack domain tests (2), Company Receipts
  API integration tests (4), and PostgreSQL security tests (1) on disposable PostgreSQL
  16, including downgrade, revoked-read, active-tenant, cross-tenant, export-audit and
  no-store assertions.
- The current full Vitest run completed with **171 passed files / 2 skipped files** and
  **683 passed tests / 2 skipped tests**. The additional file/tests cover tax
  classification and the exclusive Expense policy boundary. CI, current public health,
  exact deployed revision, production tax-owner approval, physical-device behavior and
  SMTP/Vision configuration remain unverified.
- Not claimed by this document: current public availability, exact deployed revision,
  GitHub Actions execution, a production database role rollout, physical-device behavior,
  or production SMTP/Vision configuration. The PostgreSQL proof used a disposable local
  instance and was removed after verification.
