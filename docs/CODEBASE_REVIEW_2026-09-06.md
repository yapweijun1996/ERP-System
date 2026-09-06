# ERP-System Codebase Review — 2026-09-06

This review is the current action list for `main` at `2339ad2` (`test: cover setup
wizard mobile layout`). Source and tests are the implementation truth; [STATUS.md](STATUS.md) is the current status summary; [SPEC.md](SPEC.md) and
[PROJECT_LOGIC.md](PROJECT_LOGIC.md) remain the binding domain references. The older
[ERP excellence review](ERP_EXCELLENCE_REVIEW.md) is retained as a dated historical
baseline.

## Current verified baseline

- The source contains **100 ordered migrations through schema version 99**, **252
  generated tables**, **315 permission codes**, **222 production-RLS policy tables** and
  **10 explicit infrastructure/control-plane exemptions**.
- The source inventory is **129 Canonical routes / 0 Preview routes**. **128 routes
  declare API-mode metadata** because `staff-calendar` is currently omitted from
  `API_SCREEN_ROUTES`; this is a decision gap, not proof that the API route is absent.
- Local static/generated checks pass: lint, root/Web typecheck, Demo schema, schema
  drift, permission registry, production-RLS coverage, i18n bootstrap/business checks
  and Demo showcase-pack verification. The current `test:e2e:setup-wizard` also passes
  desktop, iPhone-width and small-mobile layout checks. These checks do not prove live
  PostgreSQL provisioning, public deployment, or GitHub Actions execution.
- The task registry currently reports **197 Done / 1 In progress / 11 Todo / 4
  Blocked / 213 Total**. The actionable boundary is concentrated in TASK-195–205 and
  EPIC-067/TASK-206–209; the blocked items are external or operational, not silently
  treated as code failures.
- During this review the user-owned PWA/setup-wizard changes were committed as
  `2339ad2`: `package.json`, `web/public/assets/pwa.css` and
  `tests/e2e/setup-wizard-layout.spec.mjs`. The new E2E passes at desktop, iPhone and
  small-mobile widths. `.playwright-cli/` remains present but is not part of the commit;
  keep it out of release artifacts.

## Action backlog

### P0 — close before calling the Platform/Expenses release production-ready

- **TASK-195 — Platform provisioning is not proven compatible with enforced PostgreSQL
  RLS.**
  - **Evidence:** `runPlatformMutation()` in `src/api/routes/platform.ts` opens the
    idempotency transaction but does not establish `app.master_fn`/`app.company_fn`;
    `createCompanyWithin()` in `src/modules/setup/platformProvisioning.ts` then writes
    RLS-protected tenant tables. `withTenantTransaction()` does set those settings, but
    the Platform mutation path does not use it.
  - **Action:** establish a safe context strategy for the bootstrap → Master → Company
    sequence, provision explicit non-superuser/non-`BYPASSRLS` API and worker roles, and
    remove reliance on the Compose bootstrap superuser default.
  - **Acceptance:** the current Platform route passes under PostgreSQL `FORCE ROW
    LEVEL SECURITY` with the least-privilege roles; cross-tenant writes fail closed;
    `test:postgres` covers the current `createMasterWithin()` and
    `createCompanyWithin()` path rather than only the retired setup helper.

- **TASK-196 — Receipt Pack authorization is weaker than the frozen visibility.**
  - **Evidence:** `requireReceiptReadAccess()` chooses current `company` or `own`
    permission, but `readCompanyReceiptPackWithin()` only filters by active scope,
    pack id and creator. A creator can therefore retain access to a company-visible
    Pack after losing `read_company` while retaining `read_own`.
  - **Action:** revalidate the caller against the Pack's frozen visibility for read,
    preview, download and print; define who may export original evidence and record the
    decision in the audit trail.
  - **Acceptance:** a permission downgrade returns a safe denial for every Pack access
    surface; company and own visibility have explicit tests; export authority and audit
    fields are documented in `PROJECT_LOGIC.md` and `SPEC.md` if the contract changes.

- **TASK-197 — Company Receipts has backend commands but an incomplete normal workflow.**
  - **Evidence:** `src/api/routes/companyReceipts.ts` already exposes detail, PATCH and
    void operations, while `web/public/assets/screens-company-receipts.js` renders a
    register with confirmation and Pack actions but no detail/reopen/void path. Create
    is shown based on adapter availability rather than an effective capability. A
    Missing Date button routes to My Receipts, and confirmation loads only one page of
    employee evidence.
  - **Action:** capability-gate create and Pack controls, add detail and correction/void
    actions, make Missing Date open the exact record/editor, paginate or remove the
    Employee-dependent evidence picker, and expose honest loading/denial states.
  - **Acceptance:** Company Owner/read-only/uploader personas see only permitted
    actions; API and Demo adapters behave the same; a missing-date record can be
    corrected from Company Receipts; void and correction retain audit/evidence history.

- **TASK-204 — GST/SST validity and posting semantics are inconsistent.**
  - **Evidence:** `getEffectiveTaxRate()` treats `valid_to` as exclusive, while the
    Expense policy snapshot query uses an inclusive upper bound. Supplier-invoice
    posting always debits account `1200` labelled `GST/SST Input Tax`, without checking
    the Company's regime or an explicit recoverability classification.
  - **Action:** choose one `[valid_from, valid_to)` contract, validate non-overlapping
    intervals, and make posting regime/classification-aware. Malaysia SST must not be
    treated as recoverable Input Tax by a generic account mapping.
  - **Acceptance:** boundary-date tests cover both lookup paths; SG GST and MY SST
    tests assert different posting semantics; configured rates and tax codes are
    versioned/approved from the relevant official source rather than encoded as a
    narrative default.

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

- **TASK-200 — Canonical/API route parity is not explicitly resolved.**
  - **Evidence:** `staff-calendar` is in `CANONICAL_SCREEN_ROUTES` but not
    `API_SCREEN_ROUTES`; the access matrix and API implementation exist. This makes the
    metadata say Demo-only while the source has an API boundary.
  - **Action:** either add it to API metadata and rerun the authenticated route matrix,
    or document the intentional exception and its support boundary. Regenerate current
    route, permission, i18n and responsive evidence instead of reusing old 128/129 and
    666-test checkpoints.

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
  - **Action order:** finish PostgreSQL/RLS proof for TASK-195 and the hidden actor /
    elevated-session foundation in TASK-206; then complete authorization switching,
    break-glass and audit proof (TASK-207), browser/access/i18n integration (TASK-208),
    and only then release TASK-209. TASK-203 remains an independent CI gate.

### Blocked or human-owned follow-up

- **TASK-017:** real-device validation is still required for the PWA/mobile flow; a
  headless 375 px viewport cannot close that acceptance criterion.
- **TASK-193:** administrator email reset remains blocked until production SMTP,
  templates, rate limits, audit and end-to-end mail delivery are configured.

## Recommended execution order

- **First:** TASK-195, because it is a security boundary and blocks the Platform Admin
  release chain.
- **Next:** TASK-196, TASK-197 and TASK-204, because they affect authorization,
  evidence export and accounting correctness in already exposed ERP workflows.
- **Then:** TASK-199/TASK-203 for deployment/CI evidence, followed by TASK-200 and the
  remaining P1 operational/lifecycle proof.
- **Documentation rule:** this review found no approved domain-contract change by
  itself. Update `PROJECT_LOGIC.md`, `SPEC.md` and the relevant KB item in the same
  task whenever an implementation changes one of these contracts.

## Verification boundary

- Verified locally for this review: generated schema/drift, permissions, production-RLS
  coverage, i18n artifacts, Demo pack, lint and root/Web typecheck.
- The current full Vitest run completed with **170 passed files / 1 skipped file** and
  **674 passed tests / 1 skipped test**. The intentional stderr cases exercised
  malformed JSON and locale-load/markup failures; they did not fail the suite.
- Not claimed by this document: current public availability, exact deployed revision,
  GitHub Actions execution, production PostgreSQL Platform provisioning, physical-device
  behavior, or production SMTP/Vision configuration.
