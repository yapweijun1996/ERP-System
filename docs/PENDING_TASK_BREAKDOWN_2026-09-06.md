# Pending Task Breakdown — 2026-09-07 addendum

This is the actionable view of every non-Done task currently registered in
`tasks/tasks.jsonl`. It is intentionally separate from historical reviews: source and
tests are implementation evidence, while deployment, CI, production configuration and
physical-device checks remain separate evidence classes.

Current registry: **204 Done / 4 In Progress / 2 Todo / 3 Blocked / 213 Total**.

2026-09-07 CI addendum: the latest GitHub Actions CI run `34017037310` on remote
head `2188f56186e88e542351ec3a49e07d73057182bf` executed all four Vitest shards and
the typecheck/transaction/build job. It failed only in the i18n browser matrix on
the hardcoded `timesheet: Projects` navigation label. The repository now supplies
`route.project-pl` translations for all five locales; the exact CI-equivalent
desktop and mobile matrices pass locally. A fresh remote run for the current local
HEAD is still required; no remote green result is claimed.

2026-09-07 processing addendum: migration `0103` adds bounded document scan/extraction
retry state. Five automatic attempts are allowed by default; terminal jobs and their
document signal enter `dead_letter`, while `retryDocumentProcessing` explicitly requeues
the existing document/version extraction chain without creating a replacement row. Local
focused tests pass this source boundary; production gateway/account/region/retention,
secret rotation and live dead-letter alert/recovery evidence remain open.

Release evidence boundary: TASK-196/TASK-197 source and UI implementation is present, but
the Pack permission-downgrade path and Company Receipt correction/edit/void/date-correction
workflow remain P0 UAT follow-up until authenticated browser/production evidence reconciles
the dated ERP excellence review. This follow-up does not create a second registry row.

2026-09-07 documentation gate addendum: current local HEAD `15bb0b2` adds the deterministic
`npm run docs:check` gate for README and `docs/` Markdown relative links and invokes it in
both the CI validation job and the Pages deploy workflow. It passes 38 Markdown files and
173 local links; `npm run lint`, workflow YAML parsing and `git diff --check` also pass.
This local gate does not satisfy the still-pending remote CI, deployment, production or
physical-device evidence boundaries.

## Recommended order

- **1. Finish TASK-204's release gate:** obtain qualified tax-owner review of the
  versioned SG/MY configuration after the source-level fix and targeted regression proof.
- **2. Run TASK-199 and TASK-203 in parallel when external access is available:** restore
  public availability/deployment evidence and run CI against the current pushed HEAD.
  The prior billing blocker is no longer observed, but the latest remote run exposed
  and now has a local source fix for the i18n matrix failure.
- **3. Close the Platform chain in dependency order:** TASK-209 remains the release proof
  after TASK-203/external deployment evidence. TASK-206's hidden actor/session foundation,
  TASK-207 authorization proof and TASK-208 browser/workspace proof are now done.
- **4. Complete operational/artifact depth (TASK-201/TASK-202/TASK-205); TASK-202's
  repository implementation is now complete through lifecycle/timezone/browser evidence,
  while production release/download/Print and P0 UAT reconciliation remain open. TASK-205
  source failure evidence is also in progress.**
- **5. Keep human-owned blockers separate:** TASK-017 needs a physical phone and TASK-193
  needs production SMTP/mail delivery.

## P0 and in-progress work

- **TASK-204 — In Progress — SG GST/MY SST validity and posting semantics**
  - Depends on: `TASK-123`, `TASK-194`.
  - Source action completed in the current worktree: tax rules and expense policies use
    `[valid_from, valid_to)`; policy overlap and boundary selection are exclusive; tax
    rules carry explicit classification, recoverability and source/approval facts; PO,
    supplier invoice, purchase return, supplier debit note and expense posting fail
    closed on unclassified or regime-incompatible facts.
  - Accounting behavior: SG `gst_standard` may create recoverable Input Tax; MY SST is
    non-recoverable by default and is capitalized/reversed with the underlying purchase
    cost; positive SST recovery requires explicit `sst_deductible` configuration.
  - Evidence added: Decimal resolver tests for standard/zero/exempt GST and SST service/
    deductible classifications, exclusive Expense policy boundary test, SG balanced GL,
    MY SST balanced GL without an Input Tax leg, generated tax migrations `0100`/`0101`
    and current Demo schema version `103`.
  - Remaining action: a qualified tax owner must review production configuration against
    the current IRAS and Royal Malaysian Customs/MOF sources, approve effective dates,
    exemptions, thresholds and transitional rules, and record the review evidence.
  - Risk: source-level tests do not prove production tax configuration or tax filing
    compliance. Do not mark Done until the external approval evidence is attached.

- **TASK-199 — Todo (P0) — restore public availability and prove deployed revision**
  - Depends on: `TASK-192`, `TASK-194`.
  - Steps: perform read-only `/health`, root and setup-status probes from two independent
    checks; identify the 502 cause; restore the service; capture running commit and
    static-asset hashes; verify Compose tunnel/database/storage/monitoring health; record
    rollback and recurrence criteria.
  - Guardrail: do not reset tenant data or reseed as a diagnostic shortcut. Source-present
    UI changes are not live evidence until the deployed revision is identified.

- **TASK-203 — In Progress (P0) — restore GitHub Actions execution and close the i18n failure**
  - Depends on: `TASK-194`.
  - Evidence: CI run `34017037310` executed all four Vitest shards and the
    typecheck/transaction/build job, but the i18n matrix reported one hardcoded
    `Projects` value on `timesheet`.
  - Source action completed locally: `route.project-pl` was added to en/ms/zh/ja/vi
    resources and `web/public/assets/i18n-en.js` was regenerated; the exact desktop
    and mobile 129-route × 5-language matrices pass locally.
  - Remaining action: commit/push the scoped fix and record a fresh current-HEAD CI
    run with every required shard/typecheck/build gate. Keep zero-step failures and
    source failures distinct; neither is a green gate.

- **TASK-209 — Blocked (P0) — release Platform tenant administration**
  - Depends on: `TASK-195`, `TASK-203`, `TASK-206`, `TASK-207`, `TASK-208`.
  - TASK-208 is complete; it remains blocked until a fresh current-HEAD CI result,
    deployed revision and production evidence are available.
  - Release steps: backup, apply migration/RLS without reset or seed, run non-superuser
    PostgreSQL adversarial proof, execute read-only production smoke, record exact
    revision, and synchronize STATUS, PROJECT_LOGIC, task registry and KB.

## Completed during this review

- **TASK-206 — Done 2026-09-06 — hidden Platform tenant actor and elevated-session foundation**
  - `startPlatformTenantAccess()` and `switchPlatformTenantScope()` now set the target
    Company's transaction-local RLS context before reconciling the hidden actor's
    `role_resource_scope` and system-managed membership. This closes the production-only
    failure that PGlite could not expose.
  - Disposable PostgreSQL proof runs the HTTP bootstrap → Master → two Company path as
    `NOSUPERUSER NOBYPASSRLS`, then verifies one actor per principal/Master, non-login and
    no app session, no tenant user/role/simulation/Employee-workspace exposure, both
    Company memberships, scope switch, Return and parent-session revoke. PGlite/API
    regression proof remains green.

- **TASK-207 — Done 2026-09-06 — Platform Admin authorization, switching and break-glass proof**
  - Master and Company entitlement gates now run inside the active tenant transaction, so
    PostgreSQL FORCE RLS does not misclassify an enabled module as disabled. Missing,
    unknown, Master-disabled and Company-unallocated states fail closed.
  - The central sensitive-operation classifier now protects Expense Approval decision and
    duplicate-override routes in addition to finance, payroll, payout, reimbursement and
    tax-evidence families.
  - PGlite/API proof uses the seeded purchase-order approval and approved budget to verify
    pre-window denial, valid break-glass, tenant permission denial, required decision note,
    invalid state/immutable budget, expiry, dual audit attribution and switched-Company
    user/order isolation. Disposable PostgreSQL 16 `NOSUPERUSER NOBYPASSRLS` proof adds a
    real Finance budget workflow and confirms the module gate works under FORCE RLS.
  - TASK-208 browser/workspace proof is now complete; TASK-209 remains blocked by CI billing,
    deployment and production release evidence.

- **TASK-208 — Done 2026-09-07 — Platform Admin and exact Employee workspace integration**
  - The isolated PGlite Playwright journey passes provisioning and entitlement controls at
    desktop/tablet/mobile widths, focus/sticky action behavior, separate Platform Admin and
    exact Employee modes, true-principal banners, locked Company scope and Return.
  - Access Matrix passes 59 canonical route contracts × 13 roles and 129 registered screens.
    The full i18n browser matrix passes 129 routes × 5 languages × desktop/mobile, and the
    Platform workspace has canonical locale keys plus a focused five-language 375px check.
    No credential bridge, disabled-module navigation leak, browser error or horizontal
    overflow was observed.

- **TASK-200 — Done — Canonical/API route parity and current-head evidence**
  - `staff-calendar` is implemented in both adapters and backed by `/api/hr/calendar/staff`;
    it is now included in `API_SCREEN_ROUTES`, so all 129 Canonical routes declare both
    Demo and API support.
  - `npm run audit:screens` passes all 129 routes at desktop and 375px with no
    console/page errors, overflow, active-tab or declared-layout failures. Its contract
    now fails closed if any Canonical route lacks API metadata.
  - Separate evidence passes: Staff Calendar API integration 6/6, Staff Calendar Demo
    E2E, Company Receipts authenticated API browser flow, permission registry/access
    matrix and the current 129 × 5 × 2 i18n browser matrix. TASK-017's physical-device
    acceptance remains independent.

## P1 work

- **TASK-201 — Todo — production SLO, scale and disaster-recovery proof**
  - Depends on: `TASK-195`, `TASK-199`.
  - Define and exercise availability/error/latency SLOs, alert ownership, encrypted
    backup retention/integrity, timed restore RPO/RTO, worker/outbox/document/calendar/
    reporting backlog and dead-letter metrics, and representative 100–800 GB query/load
    budgets. Checkpoint/runbooks must be source-controlled and reviewed.

- **TASK-202 — In Progress — Receipt Pack lifecycle, concurrency and localization**
  - Depends on: `TASK-196`, `TASK-197`.
  - Repository implementation completed 2026-09-07: unique-key insert races converge to
    deterministic replay/409 behavior; actor-scoped paginated history is available in API
    and Demo adapters; receipt amount display avoids Number() conversion; localized
    register labels/content cover en/ms/zh/ja/vi with an embedded Noto Sans CJK font;
    unsupported originals keep an explicit identity placeholder; Pack retention is derived
    from governed source evidence; legal-hold, two-person purge, immutable tombstone and
    key-reuse protection are exposed through shared domain commands and API/Demo runtime;
    Company IANA timezone defaults drive calendar-safe date presets.
  - Local proof completed: Pack governance unit/API tests, schema drift and RLS checks,
    Demo smoke, build/type/lint gates and the authenticated Company Receipts browser flow
    including a Singapore local-day boundary. Disposable PostgreSQL same-key concurrency
    is verified on a fresh PostgreSQL 16 database; remaining action is authenticated
    production download/Print and release checks plus P0 UAT reconciliation.

- **TASK-205 — In Progress — governed Vision failure and production boundaries**
  - Depends on: `TASK-119`, `TASK-194`.
  - Direct HTTP-driver tests now cover non-HTTP URL rejection, provider 4xx/5xx,
    malformed/empty response and transport timeout without accepting unsafe output.
  - Processing tests cover paused/revoked connector fail-closed behavior, one extraction
    row reused across a gateway failure/retry lease, and the selected **manual retry/review**
    policy. Vision failure never silently calls local OCR.
  - Source action completed: migration `0103` and `processing.ts` bound automatic retry at
    five attempts by default, record `dead_letter`/`dead_lettered_at` on scan and extraction
    jobs plus the document signal, and provide `retryDocumentProcessing` for an explicit
    same-chain manual retry. Focused tests cover the terminal state and recovery without
    creating a second extraction row.
  - Remaining action: verify operational alert/recovery behavior, secret rotation/revocation
    and a configured production gateway/account/region/retention check. Encrypted connector
    capability remains source evidence, not production proof.

## Human or external blockers

- **TASK-017 — Blocked — real-device mobile/PWA confirmation**
  - Depends on: `TASK-007`.
  - A human must open the deployed GitHub Pages build on a physical phone and verify
    375px layout, SW v3 update behavior, first-visit PGlite seed, SO-2 success, SO-3
    insufficient-stock rollback and Demo reset. Headless/emulated viewport evidence does
    not satisfy this acceptance criterion.

- **TASK-193 — Blocked — administrator email self-service password reset**
  - Depends on: `TASK-189`, `TASK-190`, `TASK-191`.
  - Requires production SMTP host/secrets, templates, rate limits, single-use expiring
    tokens, active-session revocation, independent Platform/Master/Company authorization,
    audit and end-to-end delivery/failure proof. Do not enable or claim delivery until
    the production mail path exists.

## Evidence boundary

- **Source implemented** means code, migration and local tests support the contract.
- **Tests passed** means the named test command actually ran and passed.
- **Deployed revision** means the running service/assets resolve to a recorded commit.
- **Production ready** additionally requires current configuration, infrastructure,
  security, operational and human acceptance evidence.

These states must remain separate in Markdown, `tasks/tasks.jsonl` and the project KB.
