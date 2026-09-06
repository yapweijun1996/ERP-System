# Pending Task Breakdown — 2026-09-06

This is the actionable view of every non-Done task currently registered in
`tasks/tasks.jsonl`. It is intentionally separate from historical reviews: source and
tests are implementation evidence, while deployment, CI, production configuration and
physical-device checks remain separate evidence classes.

Current registry: **204 Done / 1 In Progress / 4 Todo / 4 Blocked / 213 Total**.

## Recommended order

- **1. Finish TASK-204's release gate:** obtain qualified tax-owner review of the
  versioned SG/MY configuration after the source-level fix and targeted regression proof.
- **2. Run TASK-199 and TASK-203 in parallel when external access is available:** restore
  public availability/deployment evidence and unblock GitHub Actions execution.
- **3. Close the Platform chain in dependency order:** TASK-209 remains the release proof
  after TASK-203/external deployment evidence. TASK-206's hidden actor/session foundation,
  TASK-207 authorization proof and TASK-208 browser/workspace proof are now done.
- **4. Complete operational/artifact depth (TASK-201/TASK-202/TASK-205).**
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
    MY SST balanced GL without an Input Tax leg, generated migrations `0100`/`0101` and
    Demo schema version `101`.
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

- **TASK-203 — Blocked (P0) — restore GitHub Actions execution**
  - Depends on: `TASK-194`.
  - Blocker: the latest workflow reported failed account payments or an exhausted
    spending limit and executed zero jobs.
  - Required action: repository owner restores billing/spending capacity, runs the current
    HEAD workflow, and records every required shard/typecheck/build result. A zero-step
    billing failure must remain a failed gate, never a green result.

- **TASK-209 — Blocked (P0) — release Platform tenant administration**
  - Depends on: `TASK-195`, `TASK-203`, `TASK-206`, `TASK-207`, `TASK-208`.
  - TASK-208 is complete; it remains blocked until executable CI, deployed revision and
    production evidence are available.
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

- **TASK-202 — Todo — Receipt Pack lifecycle, concurrency and localization**
  - Depends on: `TASK-196`, `TASK-197`.
  - Add concurrency-safe idempotency/conflict semantics, list/history, retention,
    legal-hold/purge/tombstone behavior, locale-aware Unicode PDF/fonts, Decimal-safe UI
    amounts, Company-calendar presets, HEIC/unsupported-original behavior and verified
    download/print semantics.

- **TASK-205 — Todo — governed Vision failure and production boundaries**
  - Depends on: `TASK-119`, `TASK-194`.
  - Test timeout, provider 4xx/5xx, malformed response, revoked credential, retry lease,
    idempotency, dead-letter/manual-review and the explicitly chosen fallback policy.
    Prove encrypted secret rotation/revocation without disclosure, while keeping source
    capability separate from a configured production gateway/account/region/retention.

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
