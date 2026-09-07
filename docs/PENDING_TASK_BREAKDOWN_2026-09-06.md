# Pending Task Breakdown — 2026-09-08 addendum

## Latest specialist follow-up

TASK-215 reconciles documentation/KB only. TASK-216 through TASK-223 are complete locally;
F08 is closed by the Promise-aware recovery audit in
[ERP_SPECIALIST_REVIEW_2026-09-07.md](ERP_SPECIALIST_REVIEW_2026-09-07.md).

| Task | Status | Required outcome |
| --- | --- | --- |
| TASK-216 | Done | Compact seed and Demo-pack v16 carry governed SG/MY tax snapshots; fresh/upgraded approval → receipt → invoice proof passes |
| TASK-217 | Done | Shared date-only due-date arithmetic and SG/MY boundary regression/browser proof |
| TASK-218 | Done | Derive invoice aging and fiscal-period KPIs from date-only presentation facts while preserving posting status |
| TASK-219 | Done | Close sales invoice translation gaps; canonical labels and current full i18n matrix pass |
| TASK-220 | Done | Correct filled-action contrast in both themes; focused action-token E2E passes |
| TASK-221 | Done | Make procurement next actions and receiving scope clear; built-Demo desktop/mobile full-receipt workflow passes |
| TASK-222 | Done | Improve mobile touch zoom and localized status usability; five-language desktop/mobile E2E and half-width reflow pass |
| TASK-223 | Done | Resolve payment voucher recovery audit timing uncertainty; full desktop/mobile route audit passes |

All depend on TASK-214 except TASK-218 additionally needs TASK-217 and TASK-221
needs TASK-216. Acceptance criteria are in the [task registry](../tasks/tasks.jsonl).
Prioritize seed/date/KPI correctness, then presentation/recovery; preserve the P0
production evidence chain below. [TEST_COVERAGE.md](TEST_COVERAGE.md) records what
was actually tested; earlier passing matrices below are historical checkpoints.

This is the actionable view of every non-Done task currently registered in
`tasks/tasks.jsonl`. It is intentionally separate from historical reviews: source and
tests are implementation evidence, while deployment, CI, production configuration and
physical-device checks remain separate evidence classes.

Current registry: **214 Done / 5 In Progress / 1 Todo / 3 Blocked / 223 Total**.

2026-09-07 TASK-216 completion: the compact seed and generated showcase pack v16 now
write governed GST/SST classification and recoverability snapshots. A deterministic
upgrade repairs only the untouched historical `PO-APP-2026-0001` SG row; it does not
rewrite received or invoiced records. Fresh and simulated-upgrade PGlite tests complete
approval → receipt → exactly one supplier invoice with balanced GL, while unclassified
and regime-incompatible lines remain rejected. The focused purchasing tests pass 3
files/11 tests, existing HTTP purchasing coverage passes `src/api/app.test.ts` 29/29,
and `npm run demo`, generated pack/schema and drift checks also pass. This is local
Demo/API shared-command evidence, not
production tax-owner approval or deployment evidence.

2026-09-07 TASK-217 completion: `screens-common.js` now exposes the shared
`addCalendarDays` date-only helper, and `screens-sales-hub.js` uses it for the 30-day
invoice term instead of serializing a local midnight through UTC. The focused browser
date test covers SG/MY-relevant month/year and leap-day boundaries plus invalid input;
the built Demo `#sales-invoices` route rendered without console errors and returned
`2026-07-28`, `2027-01-30` and `2028-02-29` for runtime boundary probes. Lint,
typechecks, Demo build/proof, generated checks, documentation links and diff checks pass;
no monetary posting code changed. This is local source/Demo evidence, not production or
remote-CI evidence.

2026-09-07 TASK-218 completion: sales invoice cards, filters, rows and detail-facing
documents now share `salesInvoiceViewFacts`. The selected fiscal period uses inclusive
`invoiceDate` bounds; overdue means an outstanding balance whose due date is before the
Demo business date; `rawStatus` remains the stored posting state while `status` and
`agingStatus` are derived display facts. Mixed past/future/paid/unpaid fixtures pass the
focused browser-date test. Built-Demo Playwright evidence confirms FY2026/P06 shows
Outstanding/Overdue S$174 and Posted this period 0, the Overdue filter retains the two
old invoices, Paid is empty, and the route has zero console errors. Demo, lint,
typechecks, generated checks, documentation links and diff checks pass. This is local
Demo/source evidence, not production or remote-CI evidence.

2026-09-08 TASK-219 completion: sales-invoice `Outstanding` and `Due date` now resolve
through `ar.outstanding` and `common.dueDate` in all five locale packs, with the generated
English bootstrap at 1,728 canonical keys. The built Demo live-locale E2E passes on desktop
and mobile with route/filter retention and focused draft controls; shared locale refresh
continues to capture/restore scroll state. The specialist seven-route matrix and the full
PGlite release audit pass at 129 routes × 5 languages × 2 viewports with zero blocking
findings. The i18n audit's dynamic-date allowlist now accepts locale-generated month names
such as `Sept` without classifying runtime business dates as untranslated system copy.
TASK-222 and TASK-223 are complete locally; remaining production, device and external-service gates are independent.

2026-09-08 TASK-220 completion: shared `--accent-action` and `--accent-action-hover`
tokens now govern white-text filled controls while `--accent` remains available for
accent text and charts. Primary buttons, PWA Install and related selected controls pass
the focused action-contrast E2E at 5.567:1 normal and 6.947:1 hover across light/dark
desktop/mobile, with visible focus and disabled states, zero browser errors and no mobile
horizontal overflow. The four matching screenshots were visually inspected and removed
after verification. TASK-222 and TASK-223 are complete locally; remaining production, device and external-service gates are independent.

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

2026-09-07 documentation gate addendum: the repository now includes the deterministic
`npm run docs:check` gate for README and `docs/` Markdown relative links and invokes it in
both the CI validation job and the Pages deploy workflow. It passes 39 Markdown files and
174 local links; `npm run lint`, workflow YAML parsing and `git diff --check` also pass.
The application-only release now rejects an explicitly supplied revision that differs from
the checkout HEAD. These local gates do not satisfy the still-pending remote CI, deployment,
production or physical-device evidence boundaries.

2026-09-07 deployment probe addendum: the latest GitHub Actions runs remain CI failure
`34017037310` and Pages success `34017037276`, both on remote head
`2188f56186e88e542351ec3a49e07d73057182bf`. A fresh read-only Node fetch returns the Pages
root as HTTP 200 HTML, but `/release.json`, `/health` and `/api/setup/status` are HTTP 404
HTML fallbacks. This is static-host availability only, not current revision or API health.

2026-09-07 production probe addendum: the same read-only fetch returns HTTP 502 from the
Cloudflare production origin `https://gmb01.xyz/erp` and `https://gmb01.xyz/erp/health`.
The proxy response identifies a Cloudflare `Host Error` and exposes no origin health
payload, so it does not establish the root cause. No tenant write, reset, reseed or
deployment was attempted; TASK-199 remains open for incident diagnosis, service
restoration and deployed-revision evidence.

2026-09-07 PDF robustness addendum: Receipt Pack register text now normalizes ASCII control
characters before Unicode PDF embedding, closing a source-level text-stream edge case. The
focused Pack tests, Demo build, Company Receipts browser E2E, typecheck, lint and
documentation/link checks pass. This does not change the open TASK-202 production
download/Print, release or authenticated UAT evidence boundary.

2026-09-07 release-checklist addendum: the release checklist now records the verified local
Receipt Pack and Platform workspace gates as complete while keeping production download/Print,
current-HEAD CI, deployment, scanner/storage UAT and authenticated release evidence open.
The current rerun also passes the Company Receipts API E2E and both Platform workspace E2E
flows; these remain disposable/local evidence, not production release proof.

2026-09-07 outbox addendum: authentication invitation/password-reset delivery now has the
same bounded-failure shape as document processing: five automatic attempts by default,
`OUTBOX_MAX_ATTEMPTS` clamped to 1–20, terminal `dead_lettered_at`, and a sanitized
integration-event status. The focused outbox suite passes 2 files / 5 tests; production SMTP, alerting
and operator recovery remain TASK-193/TASK-201 evidence rather than local claims.

2026-09-07 full-regression addendum: after the auth outbox, worker telemetry and
browser-boundary changes, `npm test -- --reporter=dot` passes 173 files / 705 tests
with two intentional file/test skips.
The malformed-JSON, locale-503 and unsafe-markup stderr lines are expected assertions;
they did not fail the suite. This updates the previous 697-test local baseline.

2026-09-07 worker telemetry addendum: `src/worker/telemetry.ts` now provides a
read-only, structured queue snapshot for the primary and calendar workers. It reports
pending/ready/in-flight/retrying/failed/dead-letter counts and oldest pending age for
outbox, reporting, tax-evidence, document scan/extraction and calendar/reminder queues.
The query uses the existing reporting/document/calendar worker RLS flags, returns no
tenant identifiers, payloads, credentials, worker locks or raw errors, and is emitted
as `erp.worker.telemetry` JSON every 60 seconds by both worker entry points (configurable
with `WORKER_TELEMETRY_POLL_MS`, minimum 10 seconds). The 2026-09-08 source slice now
dispatches telemetry single-flight without delaying the business tick and aligns ready/
active-lease counts with the outbox, report, document, calendar-connection and reminder
claim predicates. Focused telemetry tests pass 6/6;
production dashboards, alert thresholds, ownership, backup/restore, load budgets and
failure-recovery exercise remain TASK-201 production evidence.

2026-09-07 Demo-boundary addendum: `npm run build:demo` initially exposed a browser
bundle failure because the connector read path imported the server-only
`tokenCrypto -> node:crypto -> session` chain. Format validation now lives in the
browser-safe `src/auth/tokenEnvelope.ts`; `src/auth/tokenCrypto.ts` re-exports the
same public validator and envelope type, so server callers remain compatible. The
serial Demo build, root/Web typechecks, lint and affected auth/connector/telemetry
tests pass; `npm run smoke` also passes at desktop and 375px with zero console/page
errors. This is a local source/build correction, not a substitute for TASK-199 Pages
revision/API health evidence.

2026-09-07 production-image addendum: the local production Compose `web` image build
installed the project dependencies and reached the Dockerfile base-image stage, but
Docker Hub's `nginx:alpine` 20.09 MB layer stalled at 3.15 MB for roughly 274 seconds.
The build was stopped without starting containers, changing volumes, migrating data or
claiming image-build success. Compose overlay syntax and the repository API/Demo builds
remain green; TASK-199 still needs a target-host release and health proof.

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
  - Review preparation: [`TAX_OWNER_REVIEW_2026-09-07.md`](TAX_OWNER_REVIEW_2026-09-07.md)
    records the current seeded facts, official IRAS/MySST/MOF source observations and
    the exact approval decisions still required. It does not substitute for qualified
    tax-owner sign-off.
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

- **TASK-199 — In Progress (P0) — restore public availability and prove deployed revision**
  - Depends on: `TASK-192`, `TASK-194`.
  - Local source support now emits API `/health.revision` from `ERP_RELEASE_COMMIT` and
    static `release.json` with the commit plus SHA-256/byte-size evidence for each build
    file. Pages injects `github.sha`; the Docker application release derives Git HEAD.
    `deploy/release.sh` now checks `/health` from inside the web container through the
    Compose network because the production overlay removes DB/API host port publishing.
    The manifest writer now uses a private atomic replacement path with symlink/non-file
    rejection; focused replacement/failure/permission tests pass 4/4.
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
  - Depends on: `TASK-195`, `TASK-203`, `TASK-206`, `TASK-207`, `TASK-208`, `TASK-199`.
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
  - TASK-208 browser/workspace proof is now complete; TASK-209 remains blocked by current-HEAD green CI,
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
  - Source-level worker boundary now caps authentication outbox retries at five by default,
    exposes `dead_letter` through the sanitized integration-event read model and supports
    the bounded configuration `OUTBOX_MAX_ATTEMPTS` (1–20). This is not production alert
    or recovery evidence.
  - Source preparation now emits aggregate-only `erp.worker.telemetry` snapshots from
    both worker entry points for queue depth, readiness, leases, retries, failures,
    dead letters and oldest pending age across outbox/document/reporting/tax-evidence/
    calendar queues. Local tests pass 3/3; no production sink or alert is claimed.
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
  - Source security action completed: the connector domain now accepts only a validated
    AES-GCM envelope; reconfiguration replaces the old encrypted value, public/audit
    payloads exclude both old and new secrets, and pause disables worker use while retaining
    the append-only history boundary. Focused tests cover rotation and pause/revocation.
  - Remaining action: verify operational alert/recovery behavior, production key rotation/
    revocation operations and a configured production gateway/account/region/retention check.
    Encrypted connector capability and local rotation tests remain source evidence, not
    production proof.

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
