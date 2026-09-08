# ERP Product Quality and Production Readiness Baseline

Goal tracking: [GOAL.md](../GOAL.md) maps the AI Native ERP target to 12
workstreams and 48 measurable DoD criteria. This baseline remains the shared
acceptance framework; goal planning adds no implementation or release evidence.

Confirmed product direction: 2026-09-07. This is the durable acceptance framework
requested by the product owner, not a claim that every gate has passed.
Current implementation evidence belongs in [STATUS.md](STATUS.md); dated findings
belong in [ERP_SPECIALIST_REVIEW_2026-09-07.md](ERP_SPECIALIST_REVIEW_2026-09-07.md).

## Goal

Deliver a user-friendly, AI-agent-friendly ERP for Singapore and Malaysia, with
complete business workflows, responsive and accessible interfaces, a reliable
static `web/dist/` Demo, and verified production operation, growth and upgrades.
Evaluate quality across the following dimensions together; route coverage alone
is not product acceptance.

| Dimension | Required acceptance evidence |
| --- | --- |
| Business workflows | Trace order-to-cash, procure-to-pay, record-to-report, inventory, HR/leave/payroll and expense/evidence workflows from entry to final business result. Check approvals, rejection, cancellation/reversal, duplicate submission, stale versions and failure rollback. Reconcile stock, AR/AP and balanced GL rather than trusting success messages. |
| Performance | Separate first visit, warm navigation, browser storage startup, network/API latency and background workers. Record device, dataset, concurrency, network, cache and release. Agree route/action p95 and error-rate budgets; measure representative production-sized data before making scale claims. |
| UI/UX layout | Clear hierarchy, one visible primary action, consistent document identity/status, accessible menus/dialogs, predictable focus and scrolling, recoverable forms and useful empty/error/loading states. Test real user journeys, not only route rendering. |
| Mobile responsiveness | Verify 320/375/390px, tablet and desktop; keyboard-open forms, portrait/landscape, drawer open/close, scrolling and safe areas. Keep tables inside their own scroll container and identifiers discoverable. Emulator evidence and physical iOS/Android acceptance are separate. |
| Internationalization | English, Malay, Simplified Chinese, Japanese and Vietnamese; live switching must preserve draft/filter/selection/focus state. Check complete sentences, status names, dates, number/currency formatting, overflow and exports. Allowlisted English is not automatically acceptable user-facing translation. |
| Light/dark theme and palette | Central semantic tokens, consistent success/warning/error meaning, readable charts and print output, visible focus, and contrast in both themes. Verify normal text at least 4.5:1 and large text 3:1; never convey business status by color alone. |
| User friendliness | New-user setup, contextual next actions, actionable validation, clear financial impact and recovery; distinguish disabled, unavailable and unauthorized actions. Use task completion, errors and correction effort as usability evidence. |
| SG/MY market fit | Company-specific country/currency/tax configuration, date-only correctness in SG/MY timezones, finance and payroll owner approval, required statutory outputs and e-invoicing integrations where applicable. Business posting support does not prove statutory compliance. |
| AI Agent friendliness | Machine-readable action/input/output/error contracts, bounded reads, stable identifiers, permission and side-effect declarations, independent least-privilege identity, idempotency and postcondition evidence. Agents must use governed APIs and existing approval controls, not direct database writes or shared administrator credentials. |
| Static Demo friendliness | Build and serve `web/dist/` at root and a deployment subpath; fresh browser setup, realistic fictional data, reload persistence, supported offline states and explicit fallback. No backend, production credentials or provider keys required. Large downloads and seed costs need measurable budgets. |
| Production readiness | Current CI, exact deployed revision, TLS/session/CSRF/tenant isolation, least-privilege PostgreSQL/RLS, migration/rollback, workers, secret rotation, audit, support access and recovery evidence. A successful Demo does not close these gates. |
| Scalability | Bounded cursor reads, measured query plans/indexes, connection budgets, queue backpressure and storage ownership. Default PostgreSQL bytea shares attachments through the database; the optional local filesystem backend needs shared durable storage before horizontal deployment. Validate backup/restore and target capacity; document single-node assumptions. |
| Client updates and release safety | Automatically discover new versions, show version and update state, preserve active work, verify API/schema compatibility, staged rollout, rollback and multi-tab behavior. Existing PWA behavior is automatic detection with explicit user activation; unattended forced reload is not the current contract. |
| Operations and maintainability | Clear module ownership, one domain/schema contract, generated-artifact checks, repeatable installation/release commands, sanitized telemetry, accountable alerts and measured recovery. Keep client upgrades compatible with durable data. |

## Decision and evidence rules

- Classify each result as reproduced defect, source-confirmed capability limit,
  improvement proposal, passed check, or unverified operational prerequisite.
- Record environment, source revision, actor/company, steps, expected/actual result,
  business impact, source references, priority and follow-up acceptance criteria.
- Prioritize incorrect financial/tenant outcomes before cosmetic refinements.
  Preserve business-rule ownership: date, aging and balance calculations must have
  an authoritative contract rather than independent screen-specific guesses.
- Existing tests can prove different boundaries: static checks, domain tests,
  adapter-driven browser tests, real UI workflows, authenticated API workflows and
  production operations. Report them separately.
- No release approval is inferred from a route count, passing unit suite, a working
  home page, a successful PWA update or a sample dataset benchmark.
- Product audits may document a defect without changing runtime behavior. Fixes
  receive explicit scoped implementation and regression verification.

## Market and accessibility references

Checked on 2026-09-07; recheck applicability for each client before release.

- [IRAS GST InvoiceNow requirement](https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/gst-invoicenow-requirement): phased GST invoice-data submission requirements. Assess the client's applicable phase and integration evidence.
- [HASiL e-Invoice guidelines](https://www.hasil.gov.my/en/perundangan/garis-panduan/): use current general/specific guidance and client eligibility; do not freeze a generic turnover threshold as universal ERP logic.
- [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): validate computed foreground/background colors, text size and state, not screenshot appearance alone.

See [LOCALIZATION.md](LOCALIZATION.md), [TAX_OWNER_REVIEW_2026-09-07.md](TAX_OWNER_REVIEW_2026-09-07.md),
[SCALABILITY.md](SCALABILITY.md), [DEPLOYMENT.md](DEPLOYMENT.md) and [PWA.md](PWA.md)
for current implementation limits and operational procedures.
