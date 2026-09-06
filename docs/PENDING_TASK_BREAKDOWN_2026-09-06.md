# Pending Task Breakdown — 2026-09-06

This is the actionable view of every non-Done task currently registered in
`tasks/tasks.jsonl`. It is intentionally separate from historical reviews: source and
tests are implementation evidence, while deployment, CI, production configuration and
physical-device checks remain separate evidence classes.

Current registry: **200 Done / 2 In Progress / 7 Todo / 4 Blocked / 213 Total**.

## Recommended order

- **1. Finish TASK-204's release gate:** obtain qualified tax-owner review of the
  versioned SG/MY configuration after the source-level fix and targeted regression proof.
- **2. Run TASK-199 and TASK-203 in parallel when external access is available:** restore
  public availability/deployment evidence and unblock GitHub Actions execution.
- **3. Close the Platform chain in dependency order:** TASK-206 → TASK-207 → TASK-208,
  then release proof in TASK-209.
- **4. Rerun current-head route evidence (TASK-200), then complete operational/artifact
  depth (TASK-201/TASK-202/TASK-205).**
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

- **TASK-206 — In Progress — hidden Platform tenant actor and elevated-session foundation**
  - Depends on: `TASK-195`, `TASK-198`.
  - Existing source: migration `0099`, hidden non-login bridge actor, system-managed
    Platform Tenant Admin membership, bounded elevated session and Company-bound
    break-glass record.
  - Remaining actions: prove one actor per principal/Master, immutable membership
    ownership, no tenant login/reset/invite/Employee/simulation exposure, expiry/revoke
    on parent logout or scope change, and hidden-actor/session-specific PostgreSQL
    FORCE-RLS behavior under non-superuser runtime roles.
  - Verification: add adversarial PostgreSQL/API evidence and rerun migration/PGlite
    replay checks; keep the existing TASK-195 runtime-role proof as supporting evidence,
    not as a substitute for this task's hidden-actor proof.

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

- **TASK-207 — Todo (P0) — Platform Admin authorization, switching and break-glass proof**
  - Depends on: `TASK-206`.
  - Steps: prove Master-enabled/Company-allocated module gating, ordinary tenant RBAC,
    sensitive-operation denial until a valid Company window exists, maker-checker and
    workflow invariants under break-glass, dual attribution, scope isolation and revoke/
    expiry behavior.
  - Evidence: API/PGlite plus adversarial PostgreSQL tests with safe reason codes and
    append-only audit facts; no hidden actor or Platform permission may enter Employee
    simulation.

- **TASK-208 — Todo (P0) — Platform Admin and Employee workspace integration**
  - Depends on: `TASK-207`.
  - Steps: validate separate `Open as Platform Admin` and `Login as employee` actions,
    persistent true-principal/scope banners, audited Company selectors, sensitive unlock,
    Return/logout behavior, MAC-effective navigation and exact Employee permissions.
  - Evidence: desktop and mobile browser journeys, accessibility, five-language copy,
    access-matrix and API-mode parity; verify no credential/bridge/disabled-module leak.

- **TASK-209 — Blocked (P0) — release Platform tenant administration**
  - Depends on: `TASK-195`, `TASK-203`, `TASK-206`, `TASK-207`, `TASK-208`.
  - Blocked until the dependency chain and executable CI are complete.
  - Release steps: backup, apply migration/RLS without reset or seed, run non-superuser
    PostgreSQL adversarial proof, execute read-only production smoke, record exact
    revision, and synchronize STATUS, PROJECT_LOGIC, task registry and KB.

## P1 work

- **TASK-200 — Todo — Canonical/API route parity and current-head evidence**
  - Depends on: `TASK-194`.
  - Decide whether `staff-calendar` belongs in `API_SCREEN_ROUTES`; implement the choice
    or document the intentional exception. Then rerun all 129 route decisions, the
    128/129 API boundary, permissions, i18n, responsive desktop/375px and authenticated
    API-mode proof. Do not reuse the historical 666-test or 128-route checkpoint as
    current-head evidence.

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
