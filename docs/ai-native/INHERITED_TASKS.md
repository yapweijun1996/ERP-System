# Inherited Tasks: Execution and External Evidence

Reviewed: 2026-09-08. These are the original eight open tasks, counted once.
Status/acceptance/dependencies remain in [tasks/tasks.jsonl](../../tasks/tasks.jsonl).
Use [PENDING_TASK_BREAKDOWN](../PENDING_TASK_BREAKDOWN_2026-09-06.md) for prior
evidence, [execution guide](../AI_NATIVE_EXECUTION.md) for testing and
[EVIDENCE_TEMPLATE](EVIDENCE_TEMPLATE.md) for a dated record.
The steps below do not add to the 60 AI execution checkpoints.

## TASK-017 — Physical-device acceptance

- Read [PWA.md](../PWA.md), the task's exact four acceptance items and latest Demo
  deployment identity. Do not rely on the task's historical service-worker version.
- Prepare a concrete phone checklist: dashboard/inventory/sales width, successful
  confirm, insufficient-stock rollback and Demo reset. Record real device/browser,
  release and observed result for each. Use synthetic Demo data only.
- A human or available authorized physical-device facility must actually perform
  these steps. Viewport emulation and an in-app desktop browser cannot close this task.
- Done requires all task acceptance observations. Until hardware evidence exists,
  retain Blocked and continue independent local tasks.

## TASK-193 — Administrator email recovery

- Read [auth lifecycle](../../src/auth/lifecycle.ts),
  [administrator lifecycle](../../src/auth/adminLifecycle.ts),
  [auth routes](../../src/api/routes/auth.ts) and
  [outbox worker](../../src/worker/outbox.ts). Identify existing reset primitives
  versus the missing Platform recovery scope before changing code.
- Implement the approved actor-specific reset authorization, expiring single-use
  token, rate limits, non-enumerating responses, session revocation, audit and
  email templates. Test success, replay, expiry, invalid principal and mail failure.
- Use an isolated mail sink for deterministic integration tests; separately prove
  real authorized SMTP delivery and recovery for each required administrator class.
  Never print reset links/tokens or provider credentials.
- Missing SMTP is a live-delivery block, not a reason to bypass token controls.
  Local source/test preparation can proceed within authorized scope; keep unmet
  email acceptance open.

## TASK-199 — Availability and exact release identity

- Read [DEPLOYMENT.md](../DEPLOYMENT.md),
  [release verifier](../../scripts/verify-release.mjs) and
  [release procedure](../../deploy/release.sh). Establish the authorized target
  and expected revision. Historical 502 evidence is not a fresh probe.
- Start with read-only root/health/setup/release/asset checks using the existing
  verifier against the explicitly selected origin and revision. Inspect HTTP,
  manifest and asset evidence; do not treat a static Demo as the API origin.
- With authorized origin access, diagnose actual container/tunnel/network/database
  health and prepare the smallest incident repair, backup and rollback plan.
  Perform production mutations only with applicable authorization.
- Done requires task acceptance including current health/revision, incident cause,
  storage/Compose/tunnel verification, monitoring and rollback evidence. If access
  is missing, record the exact unmet prerequisite and move to independent work.

## TASK-201 — Operational budgets and recovery

- Read [SCALABILITY.md](../SCALABILITY.md),
  [worker telemetry](../../src/worker/telemetry.ts) and task acceptance.
  Non-blocking emission is implemented; whole-table aggregate query cost still
  requires representative-volume measurement.
- After TASK-199, define numerical SLO/query/load/restore budgets and accountable
  owners. Connect the actual metric/alert sink; measure query plans, queue age,
  retry/dead-letter behavior and representative data/concurrency.
- Exercise encrypted database/document backup integrity and a timed restore on an
  isolated recovery target. Record achieved RPO/RTO and reconciliation; do not
  perform a destructive production restore.
- Done requires measured budgets, working alert ownership, restore proof and
  reviewed capacity/failover/runbooks. Source telemetry tests alone are insufficient.

## TASK-202 — Receipt Pack production acceptance

- Reuse [Pack commands](../../src/modules/expenses/companyReceiptPack.ts),
  [governance](../../src/modules/expenses/companyReceiptPackGovernance.ts) and
  [receipt API E2E](../../tests/e2e/company-receipts-api.spec.ts).
  Lifecycle, pagination, decimal/timezone handling and concurrency already have
  repository evidence; do not reimplement them from this historical task title.
- Rerun affected local checks if code changed. For the authorized released build,
  verify scoped history, view/download/Print, expected originals/placeholders,
  Unicode labels and current permission downgrade behavior.
- Record production revision, sanitized Pack/resource IDs, expected artifact/hash,
  browser/locale and observed results. Confirm printing/export behavior actually
  occurs; an HTTP test alone is not visual Print acceptance.
- Keep task open until its remaining production/release/UAT evidence is recorded.

## TASK-204 — Qualified tax-owner review

- Read [tax-owner review](../TAX_OWNER_REVIEW_2026-09-07.md),
  [LOCALIZATION.md](../LOCALIZATION.md) and
  [tax resolver](../../src/modules/localization/tax.ts).
- Prepare source-backed effective dates, classifications, recoverability, rates,
  exemptions, thresholds and transition examples with official references.
  Check relevant current official sources; never infer tax compliance from GL balance.
- Obtain and record qualified review of the actual production configuration,
  reviewer identity/role, date, configuration/evidence reference and approved scope.
  Apply any authorized correction through governed configuration and retest boundaries.
- An AI summary is not qualified sign-off. Preserve In Progress until review and
  all other task acceptance are met. Do not default MY SST to SG recoverable Input Tax.

## TASK-205 — Vision provider operations

- Read [AI_PROVIDERS.md](../AI_PROVIDERS.md),
  [processing](../../src/modules/documents/processing.ts),
  [drivers](../../src/modules/documents/processingDrivers.ts) and their tests.
  Timeout/error/revocation/dead-letter source tests already exist.
- Verify the chosen production gateway/account/model/region/retention and encrypted
  credential lifecycle using authorized fixtures or synthetic documents.
  Test key rotation/revocation and actual dead-letter alerts/manual recovery.
- Preserve one document/version/extraction provenance chain. Confirm manual retry
  behavior; do not silently use local OCR when the selected Vision service fails.
- Fixtures or encrypted storage alone do not prove live account/retention/recovery
  operations. Record missing provider access and leave affected criteria open.

## TASK-209 — Platform tenant administration release

- Confirm every dependency in the registry, especially TASK-199. Existing
  PostgreSQL and CI checkpoints must be tied to their actual revisions.
- Prepare the authorized migration/backup/rollback/RLS/application release using
  [DEPLOYMENT.md](../DEPLOYMENT.md) and
  [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md). Do not reset or reseed.
- Prove non-superuser PostgreSQL/FORCE-RLS and read-only production session/module/
  banner/return behavior on the chosen release; preserve existing Platform versus
  tenant boundaries and explicit accepted-risk documentation.
- Synchronize deployed evidence in STATUS, PROJECT_LOGIC and KB. Done requires
  all release acceptance, not merely a green historical CI run or current Demo.
