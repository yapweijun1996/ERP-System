# ERP-System Codebase Review — 2026-09-06

TASK-214 superseding execution note (2026-09-07): the baseline passes below are
prior checkpoints. Latest evidence includes seeded PO invoicing, invoice date/KPI,
i18n and contrast defects, a full-screen recovery assertion failure and an incomplete
full Vitest attempt. See [TEST_COVERAGE.md](TEST_COVERAGE.md); TASK-216 through TASK-219
are now Done with command-level seed/upgrade, browser date-only and invoice KPI proof,
TASK-219 is now Done with canonical sales-invoice locale bindings and full local browser
matrix evidence; TASK-220–223 remain open.

This review began from `main` at `2188f56` (`New`) and now records the completed
TASK-195–197 and TASK-206–208 follow-up plus the source-level TASK-204 and TASK-205
hardening in progress. Source and tests are the implementation truth; [STATUS.md](STATUS.md) is the current status summary; [SPEC.md](SPEC.md) and
[PROJECT_LOGIC.md](PROJECT_LOGIC.md) remain the binding domain references. The older
[ERP excellence review](ERP_EXCELLENCE_REVIEW.md) is retained as a dated historical
baseline.

Addendum reviewed 2026-09-08: TASK-202 repository implementation now covers Pack conflict
convergence, actor-scoped history, retention-derived governance, Legal Hold, two-person
purge/tombstone/key-reuse protection, localized Unicode PDF rendering, Decimal-safe browser
amounts and Company-calendar timezone presets. The disposable PostgreSQL same-key race
passes on a fresh PostgreSQL 16 database; production release evidence remains open.
The latest GitHub Actions CI run `34017037310` executed its Vitest shards and build gate
but failed the i18n browser matrix on one hardcoded `timesheet: Projects` label. The
current source and TASK-219 follow-up pass the full built-Demo PGlite matrix at 129 routes
× 5 languages × 2 viewports; a fresh remote run for the current local HEAD remains open.

## Current verified baseline

- The source contains **104 ordered migrations through schema version 103**, **255
  generated tables**, **315 permission codes**, **225 production-RLS policy tables** and
  **10 explicit infrastructure/control-plane exemptions**.
- The source inventory is **129 Canonical routes / 0 Preview routes**. All **129 routes
  declare API-mode metadata**, including `staff-calendar`, whose API adapter and
  `/api/hr/calendar/staff` endpoint are now part of the parity contract.
- Local static/generated checks pass: lint, root/Web typecheck, Demo schema, schema
  drift, permission registry, production-RLS coverage, i18n bootstrap/business checks
  and Demo showcase-pack verification. The current `test:e2e:setup-wizard` also passes
  desktop, iPhone-width and small-mobile layout checks. These checks do not prove live
  PostgreSQL provisioning, public deployment, or GitHub Actions execution.
- The task registry currently reports **210 Done / 4 In Progress / 6 Todo / 3 Blocked / 223 Total**. TASK-216 through TASK-219 are complete locally; the actionable boundary is concentrated in TASK-199–205 and
  EPIC-067/TASK-209; the blocked items are external or operational, not silently
  treated as code failures.
- TASK-204 source work is now in progress: migrations `0100`/`0101` add governed tax
  classification/recoverability/source facts and the Expense snapshot; the generated
  Demo schema is now version `103` after the TASK-202 governance and TASK-205 processing
  dead-letter migration. Its external
  tax-owner production review remains open.
- A read-only GitHub Pages root probe on 2026-09-07 returned HTTP 200, but the served
  HTML referenced cache-busted assets tagged 2026-08-13 and exposed no verifiable commit
  identity. This is static Demo availability evidence only; it does not prove current
  HEAD, production API health or the deployed revision.
- The current local i18n inventory is **1,728 English keys / 72 local five-language
  packs**. Exact CI-equivalent browser runs pass **129 routes × 5 languages × desktop**
  and **129 routes × 5 languages × mobile** after the `route.project-pl` fix.
- TASK-205 source failure hardening is now in progress: direct HTTP-driver tests cover
  provider status failures, malformed/empty output and transport timeout; processing
  tests cover paused/revoked connector denial, retry lease reuse and the explicit manual
  retry/review policy without automatic Vision-to-local-OCR fallback. The worker now bounds
  automatic attempts at five by default, records `dead_letter` plus `dead_lettered_at` on
  scan/extraction jobs and their document signal, and exposes an explicit same-version
  `retryDocumentProcessing` requeue path. Production gateway, account, region, retention,
  secret rotation and live dead-letter alert/restore operations remain unverified.
- The complete pending-task breakdown, including dependencies, next actions and evidence
  boundaries, is [PENDING_TASK_BREAKDOWN_2026-09-06.md](PENDING_TASK_BREAKDOWN_2026-09-06.md).
- During this review the user-owned PWA/setup-wizard changes were committed as
  `2339ad2`: `package.json`, `web/public/assets/pwa.css` and
  `tests/e2e/setup-wizard-layout.spec.mjs`. The new E2E passes at desktop, iPhone and
  small-mobile widths. `.playwright-cli/` remains present but is not part of the commit;
  keep it out of release artifacts. The temporary `.playwright-cli/` capture directory
  created during the follow-up browser smoke was removed after verification.

- TASK-195 is now **Done**: Platform Company provisioning sets transaction-local tenant
  context after generating the exact Company key; Compose separates migration,
  API and worker roles; the current HTTP bootstrap → Master → Company route passes
  PostgreSQL 16 FORCE-RLS with cross-tenant denial. Production revision, CI and
  elevated Platform Admin evidence remain separate gates.

- TASK-206 is now **Done**: elevated Platform Admin entry establishes the target
  Company's transaction-local RLS context before hidden actor role/membership writes.
  Disposable PostgreSQL non-superuser proof covers actor identity and no-login/session,
  tenant user/role/simulation/Employee-workspace visibility, one actor per
  principal/Master, two Company memberships, scope switch, Return and parent revoke.

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
  - **Evidence:** historical production probes remain dated. A current static GitHub
    Pages probe returned 200, but its dated asset tags and missing commit identity do not
    prove the current deployed revision or production API health. CI run `34017037310`
    did execute, but exposed a source i18n failure on remote head `2188f56`; the local
    fix passes both exact desktop/mobile matrices and has not yet been run remotely on
    the current local HEAD.
  - **Action:** diagnose public `/health`, root and setup availability read-only first;
    restore service if needed; record immutable deployment revision/assets. Commit/push
    the i18n fix and rerun the complete CI workflow on that exact HEAD.
  - **Acceptance:** public probes return the expected contract, the deployed revision
    is recorded and matches the release commit, CI executes (not merely queues or
    reports an infrastructure failure), and no tenant reset/seed is used as a
    diagnostic shortcut.

### P1 — close before the next broad release or operational scale claim

- **TASK-200 — Done 2026-09-06: Canonical/API route parity closed.**
  - `staff-calendar` is now included in `API_SCREEN_ROUTES`; the static audit rejects
    future Canonical/API metadata gaps.
  - The pre-TASK-214 checkpoint recorded route/API/access-matrix and i18n passes,
    including Staff Calendar API integration 6/6. TASK-214 subsequently found full-screen
    recovery and targeted invoice-i18n failures; see TEST_COVERAGE.md. Calendar browser
    creation is stubbed and is not persisted-create proof.

- **TASK-202 — Receipt Pack repository implementation is complete; release evidence remains.**
  - **Source action completed 2026-09-07:** unique-key insert races converge to
    deterministic replay/409 behavior; actor-scoped bounded history is available through
    API/Demo; receipt amount display avoids Number conversion; locale labels/content use
    en/ms/zh/ja/vi resources and an embedded Noto Sans CJK font; unsupported originals
    retain an identity placeholder; retention derives from governed source documents;
    Legal Hold, two-person purge, immutable tombstone/key-reuse protection and Company
    timezone presets are implemented in shared domain/API/Demo runtime paths.
  - **Remaining action:** record production release/download/Print/browser evidence and
    reconcile the authenticated P0 UAT boundary. Local authenticated browser proof and a
    fresh PostgreSQL 16 same-key race now pass; the local browser flow covers the
    Company-timezone boundary and Pack download/Print path.

- **TASK-201 — Production operations lack measurable SLO/DR proof.**
  - **Action:** define availability/error/latency SLOs, RPO/RTO, backup retention and
    restore drills, worker/outbox monitoring, and representative 100–800 GB query/load
    budgets. Deployment scripts and one disposable proof database are not substitutes
    for operational evidence.

- **TASK-205 — In Progress 2026-09-07: Vision failure behavior is source-tested, but
  production configuration remains open.**
  - **Evidence:** `processingDrivers.test.ts` covers non-HTTP URLs, 4xx/5xx, malformed or
    empty provider output and timeout propagation. `processing.test.ts` proves paused/
    revoked connector denial and one extraction/version reused across explicit retry;
    local OCR is not called after Vision failure.
  - **Source action completed:** automatic retry is bounded at five attempts by default;
    terminal scan/extraction jobs enter `dead_letter`, the document outbox signal records
    the same terminal state, and `retryDocumentProcessing` requeues the existing job without
    creating a new document/version/extraction row. Focused tests prove the terminal state,
    signal visibility and same-chain manual retry.
  - **Remaining action:** verify secret rotation/revocation and record a configured
    production gateway/account/region/retention check plus live dead-letter alert, operator
    retry and recovery evidence. Do not claim a third-party provider or automatic local-OCR
    fallback.

- **EPIC-067 / TASK-209 — Platform Admin release remains gated.**
  - **Action order:** TASK-206 authorization foundation, TASK-207 authorization/switching/
  break-glass proof and TASK-208 browser/access/i18n integration are done. TASK-203,
  deployed revision and production evidence still gate TASK-209; TASK-206 is done.

### Blocked or human-owned follow-up

- **TASK-017:** real-device validation is still required for the PWA/mobile flow; a
  headless 375 px viewport cannot close that acceptance criterion.
- **TASK-193:** administrator email reset remains blocked until production SMTP,
  templates, rate limits, audit and end-to-end mail delivery are configured.

## Recommended execution order

- **First:** complete the TASK-204 tax-owner review; its source-level fix is already in
  progress and the remaining risk is configuration/release evidence.
- **Next:** TASK-199/TASK-203 for deployment/current-HEAD CI evidence, then TASK-209 release proof.
  TASK-207 is source- and disposable-PostgreSQL-verified; TASK-208 is browser-verified.
- **Documentation rule:** this review found no approved domain-contract change by
  itself. Update `PROJECT_LOGIC.md`, `SPEC.md` and the relevant KB item in the same
  task whenever an implementation changes one of these contracts.

## Verification boundary

- Verified locally for this review: generated Demo schema, schema drift, permission and
  production-RLS coverage, lint, root/Web typechecks, Demo transaction proof, API/Demo
  builds and the targeted TASK-204 tax/Expense/purchasing tests. TASK-207 focused PGlite
  proof passes 2 files / 15 tests; disposable PostgreSQL 16 `npm run test:postgres` passes
  2 files / 2 tests, including the current Platform HTTP path, FORCE-RLS module gate,
  sensitive Finance workflow and runtime-role verification.
- TASK-196 focused proof passed: Company Receipt Pack domain tests (2), Company Receipts
  API integration tests (4), and PostgreSQL security tests (1) on disposable PostgreSQL
  16, including downgrade, revoked-read, active-tenant, cross-tenant, export-audit and
  no-store assertions.
- TASK-202 focused source proof passes 3 Pack unit tests and 5 Company Receipt API tests,
  including localized Unicode font embedding, governance/tombstone behavior and
  actor-scoped history; root/Web typecheck, lint, `build:demo`, `demo`, schema/RLS drift
  checks and the authenticated Company Receipts browser E2E pass.
- The earlier pre-TASK-214 Vitest checkpoint completed with **172 passed files / 2 skipped files** and
  **699 passed tests / 2 skipped tests**. The current additions cover tax classification,
  the exclusive Expense policy boundary and bounded document-processing dead-letter/requeue
  behavior. CI, current public health, exact deployed revision, production tax-owner
  approval, physical-device behavior, SMTP/Vision configuration and live dead-letter
  operations remain unverified. The focused TASK-205 run passes 2 files / 19 tests.
- TASK-208 browser evidence passes the isolated PGlite Platform workspace E2E at
  desktop/tablet/mobile widths, the 59-route × 13-role access matrix and the full
  129-route × 5-language × 2-viewport i18n matrix. The focused Platform extension also
  verifies four non-English Platform workspaces at 375px with no overflow or browser
  errors.
- Not claimed by this document: current public availability, exact deployed revision,
  GitHub Actions execution, a production database role rollout, physical-device behavior,
  or production SMTP/Vision configuration. The PostgreSQL proof used a disposable local
  instance and was removed after verification.
